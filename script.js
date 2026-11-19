
"use strict";

// CONFIGURACION
const LINEAS = ["400", "500", "540", "520", "300", "800"];
const CLAVE_HISTORIAL = "historial_codificados_v1";
const LIMITE_REGISTROS = 25;

let lineaActual = null;
let fotoActual = null;
let streamCamara = null;
let historial = cargarHistorial();
let sesionCamara = 0;

const video = document.getElementById("camara");
const vistaFoto = document.getElementById("vista-foto");
const canvas = document.getElementById("canvas-foto");
const mensajeCamara = document.getElementById("mensaje-camara");
const btnCapturar = document.getElementById("btn-capturar");
const btnRepetir = document.getElementById("btn-repetir");
const resultadoBox = document.getElementById("resultado");

// NAVEGACION
function mostrarPantalla(id) {
  document.querySelectorAll(".pantalla").forEach(p => {
    p.classList.remove("activa");
  });

  document.getElementById(id).classList.add("activa");
  window.scrollTo(0, 0);
}

function seleccionarLinea(linea) {
  if (!LINEAS.includes(linea)) return;

  lineaActual = linea;

  document.getElementById("titulo-linea").textContent =
    "Línea " + linea;

  document.getElementById("titulo-validar").textContent =
    "Validar producto · Línea " + linea;

  document.getElementById("titulo-historial").textContent =
    "Historial · Línea " + linea;

  mostrarPantalla("pantalla-opciones");
}

document.querySelectorAll("[data-linea]").forEach(boton => {
  boton.addEventListener("click", () => {
    seleccionarLinea(boton.dataset.linea);
  });
});

document.querySelectorAll("[data-destino]").forEach(boton => {
  boton.addEventListener("click", () => {
    detenerCamara();
    mostrarPantalla(boton.dataset.destino);
  });
});

// OPCIONES
document.getElementById("btn-validar").addEventListener(
  "click", async () => {
    mostrarPantalla("pantalla-validar");
    await iniciarCamara();
  }
);

document.getElementById("btn-historial").addEventListener(
  "click", () => {
    mostrarHistorial();
    mostrarPantalla("pantalla-historial");
  }
);

// CAMARA
async function iniciarCamara() {

  generacionOCR++;
procesandoOCR = false;

document.getElementById("panel-ocr").classList.add("oculto");
document.getElementById("texto-ocr").value = "";
document.getElementById("estado-ocr").textContent =
  "Esperando fotografía...";
  detenerCamara();

  const sesion = sesionCamara;

  
  fotoActual = null;

  // Restablecer la interfaz de captura
  vistaFoto.classList.add("oculto");
  video.classList.remove("oculto");

  resultadoBox.className = "resultado oculto";

  // Mostrar nuevamente el botón de captura
  btnCapturar.classList.remove("oculto");

  // Ocultar el botón de repetir fotografía
  btnRepetir.classList.add("oculto");

  // Desactivar captura hasta que la cámara esté lista
  btnCapturar.disabled = true;


  mensajeCamara.textContent = "Preparando cámara...";

  if (!navigator.mediaDevices?.getUserMedia) {
    mensajeCamara.textContent =
      "La cámara requiere un navegador compatible y HTTPS o localhost.";
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    });

    // Evitar activar una cámara después de salir de la pantalla.
    if (sesion !== sesionCamara) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }

    streamCamara = stream;
    video.srcObject = stream;
    await video.play();

    if (sesion !== sesionCamara) return;

    mensajeCamara.textContent =
      "Coloca la unidad y el corrugado dentro del encuadre.";

    btnCapturar.disabled = false;

  } catch (error) {
    if (sesion !== sesionCamara) return;

    detenerCamara();

    console.error("Error de cámara:", error);

    mensajeCamara.textContent =
      "No fue posible abrir la cámara. Revisa los permisos del navegador.";
  }
}

function detenerCamara() {
  sesionCamara++;

  if (streamCamara) {
    streamCamara.getTracks().forEach(track => track.stop());
    streamCamara = null;
  }

  video.pause();
  video.srcObject = null;
  btnCapturar.disabled = true;
}

// CAPTURA
btnCapturar.addEventListener("click", () => {
  if (!streamCamara || video.readyState < 2) {
    alert("La cámara todavía no está lista.");
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const contexto = canvas.getContext("2d");
  contexto.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Fotografía de demostración.
  fotoActual = canvas.toDataURL("image/jpeg", 0.8);

  vistaFoto.src = fotoActual;
  vistaFoto.classList.remove("oculto");
  video.classList.add("oculto");

  detenerCamara();

  btnCapturar.classList.add("oculto");
  btnRepetir.classList.remove("oculto");

  mensajeCamara.textContent = "Fotografía capturada.";

  // La validación se ejecuta con ocr
  reconocerTextoOCR();
});

// NUEVA CAPTURA
btnRepetir.addEventListener("click", async () => {
  btnCapturar.classList.remove("oculto");
  await iniciarCamara();
});

// TRES RESULTADOS SIMULADOS
const RESPUESTAS = [
  {
    estado: "CORRECTO",
    titulo: "Codificado correcto",
    observacion: "Validación simulada satisfactoria.",
    clase: "correcto"
  },
  {
    estado: "INCORRECTO",
    titulo: "Codificado incorrecto",
    observacion: "Se detectó una inconsistencia simulada.",
    clase: "incorrecto"
  },
  {
    estado: "NO_RECONOCIDA",
    titulo: "Fotografía no reconocida",
    observacion: "No fue posible reconocer la fotografía. Capture de nuevo.",
    clase: "no-reconocida"
  }
];

function validarAleatoriamente() {
  // Selección uniforme entre los tres resultados.
  const indice = Math.floor(Math.random() * RESPUESTAS.length);
  const respuesta = RESPUESTAS[indice];

  const fecha = new Date();

  const registro = {
    id: Date.now(),
    linea: lineaActual,
    estado: respuesta.estado,
    titulo: respuesta.titulo,
    observacion: respuesta.observacion,
    fecha: fecha.toLocaleDateString("es-MX"),
    hora: fecha.toLocaleTimeString("es-MX"),
    foto: fotoActual
  };

  mostrarResultado(registro, respuesta.clase);
  guardarRegistro(registro);
}

// MOSTRAR RESULTADO
function mostrarResultado(registro, clase) {
  resultadoBox.className = "resultado " + clase;

  document.getElementById("resultado-titulo").textContent =
    registro.titulo;

  document.getElementById("resultado-observacion").textContent =
    registro.observacion;

  document.getElementById("resultado-fecha").textContent =
    registro.fecha + " · " + registro.hora;
}

// HISTORIAL
function cargarHistorial() {
  try {
    const datos = JSON.parse(
      localStorage.getItem(CLAVE_HISTORIAL) || "[]"
    );

    return Array.isArray(datos) ? datos : [];
  } catch {
    return [];
  }
}

function guardarRegistro(registro) {
  historial.unshift(registro);
  historial = historial.slice(0, LIMITE_REGISTROS);

  try {
    localStorage.setItem(
      CLAVE_HISTORIAL,
      JSON.stringify(historial)
    );
  } catch (error) {
    alert(
      "Se mostró el resultado, pero no fue posible guardar el historial."
    );
  }
}

function mostrarHistorial() {
  const contenedor = document.getElementById("lista-historial");
  contenedor.replaceChildren();

  const registros = historial.filter(
    registro => registro.linea === lineaActual
  );

  if (registros.length === 0) {
    const mensaje = document.createElement("p");
    mensaje.textContent = "Todavía no hay registros para esta línea.";
    contenedor.appendChild(mensaje);
    return;
  }

  registros.forEach(registro => {
    const tarjeta = document.createElement("div");
    tarjeta.className = "registro";

    const titulo = document.createElement("strong");
    titulo.textContent = registro.titulo;

    const fecha = document.createElement("p");
    fecha.textContent = registro.fecha + " · " + registro.hora;

    const observacion = document.createElement("p");
    observacion.textContent = registro.observacion;

    tarjeta.append(titulo, fecha, observacion);

    if (registro.foto) {
      const imagen = document.createElement("img");
      imagen.src = registro.foto;
      imagen.alt = "Fotografía de inspección";
      tarjeta.appendChild(imagen);
    }

    contenedor.appendChild(tarjeta);
  });
}


/* ==========================================
   RECONOCIMIENTO OCR CON TESSERACT.JS
========================================== */

let trabajadorOCR = null;
let procesandoOCR = false;
let generacionOCR = 0;

// Inicializar Tesseract una sola vez
async function obtenerTrabajadorOCR() {
  if (!trabajadorOCR) {
    trabajadorOCR = Tesseract.createWorker("eng")
      .catch(error => {
        trabajadorOCR = null;
        throw error;
      });
  }

  return await trabajadorOCR;
}

// Procesar fotografía capturada
async function reconocerTextoOCR() {
  if (!fotoActual || procesandoOCR) return;

  const generacion = ++generacionOCR;
  const lineaCapturada = lineaActual;
  const imagenCapturada = fotoActual;

  procesandoOCR = true;

  const panel = document.getElementById("panel-ocr");
  const estado = document.getElementById("estado-ocr");
  const texto = document.getElementById("texto-ocr");

  panel.classList.remove("oculto");
  texto.value = "";
  estado.textContent = "Cargando motor OCR...";

  btnRepetir.disabled = true;

  try {
    if (typeof Tesseract === "undefined") {
      throw new Error("No se pudo cargar Tesseract.js.");
    }

    const trabajador = await obtenerTrabajadorOCR();

    if (generacion !== generacionOCR) return;

    estado.textContent = "Reconociendo caracteres...";

    const respuesta = await trabajador.recognize(imagenCapturada);

    if (generacion !== generacionOCR) return;

    const textoDetectado = respuesta.data.text.trim();

    texto.value = textoDetectado;

    if (textoDetectado) {
      estado.textContent = "Reconocimiento finalizado.";

      guardarLecturaOCR({
        linea: lineaCapturada,
        foto: imagenCapturada,
        texto: textoDetectado,
        estado: "LECTURA_OCR"
      });
    } else {
      estado.textContent =
        "No se detectó texto. Intenta tomar otra fotografía.";
    }

  } catch (error) {
    if (generacion === generacionOCR) {
      console.error("Error OCR:", error);
      estado.textContent =
        "Error al procesar la imagen. Revisa la conexión y la consola.";
    }
  } finally {
    if (generacion === generacionOCR) {
      procesandoOCR = false;
      btnRepetir.disabled = false;
    }
  }
}

// Guardar lectura de prueba en el historial existente
function guardarLecturaOCR(datos) {
  const fecha = new Date();

  const registro = {
    id: Date.now(),
    linea: datos.linea,
    estado: datos.estado,
    titulo: "Lectura OCR realizada",
    observacion: datos.texto,
    fecha: fecha.toLocaleDateString("es-MX"),
    hora: fecha.toLocaleTimeString("es-MX"),
    foto: datos.foto
  };

  guardarRegistro(registro);
}



// INICIO
mostrarPantalla("pantalla-inicio");
