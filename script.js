
"use strict";

// ========================================
// CONFIGURACION GENERAL
// ========================================

const LINEAS = ["400", "500", "540", "520", "300", "800"];
const STORAGE = "codificados_demo_dos_fotos_v3";

const $ = id => document.getElementById(id);

let lineaActual = null;
let etapa = "unidad";

let streamCamara = null;
let timerCalidad = null;
let sesionCamara = 0;
let generacionOCR = 0;

let workerPromise = null;
let procesando = false;

let capturas = {
  unidad: null,
  corrugado: null
};

let lecturas = {
  unidad: "",
  corrugado: ""
};

let muestraAnterior = null;

// ========================================
// NAVEGACION
// ========================================

function mostrarPantalla(id) {
  document.querySelectorAll(".pantalla").forEach(p => {
    p.classList.toggle("activa", p.id === id);
  });

  window.scrollTo(0, 0);
}

function seleccionarLinea(numero) {
  detenerCamara();
  cancelarLectura();

  lineaActual = numero;

  $("linea-titulo").textContent = "Línea " + numero;

  $("historial-titulo").textContent =
    "Historial · Línea " + numero;

  mostrarPantalla("opciones");
}

// Crear botones de las seis líneas
LINEAS.forEach(numero => {
  const boton = document.createElement("button");

  boton.textContent = "Línea " + numero;

  boton.addEventListener("click", () => {
    seleccionarLinea(numero);
  });

  $("lineas").appendChild(boton);
});

// Botones volver
document.querySelectorAll("[data-volver]").forEach(boton => {
  boton.addEventListener("click", () => {
    detenerCamara();
    cancelarLectura();
    mostrarPantalla(boton.dataset.volver);
  });
});

$("ir-validar").addEventListener("click", () => {
  limpiarInspeccion();
  abrirEtapa("unidad");
});

$("ir-historial").addEventListener("click", () => {
  detenerCamara();
  mostrarHistorial();
  mostrarPantalla("historial");
});

// ========================================
// LIMPIAR INSPECCION
// ========================================

function limpiarInspeccion() {
  capturas = {
    unidad: null,
    corrugado: null
  };

  lecturas = {
    unidad: "",
    corrugado: ""
  };
}

function cancelarLectura() {
  generacionOCR++;
  procesando = false;
}

// ========================================
// CONTROL DE CAMARA
// ========================================

function detenerCamara() {
  sesionCamara++;

  if (timerCalidad) {
    clearInterval(timerCalidad);
    timerCalidad = null;
  }

  if (streamCamara) {
    streamCamara.getTracks().forEach(track => {
      track.stop();
    });

    streamCamara = null;
  }

  const video = $("camara");

  video.pause();
  video.srcObject = null;

  $("capturar").disabled = true;
}

// ========================================
// ABRIR ETAPA
// ========================================

async function abrirEtapa(tipo) {
  detenerCamara();
  cancelarLectura();

  etapa = tipo;
  muestraAnterior = null;

  const esUnidad = tipo === "unidad";

  $("etapa-titulo").textContent = esUnidad
    ? "Fotografía 1 de 2 · Unidad"
    : "Fotografía 2 de 2 · Corrugado";

  $("etapa-ayuda").textContent = esUnidad
    ? "Coloca el codificado de la unidad dentro del recuadro."
    : "Coloca el codificado del corrugado dentro del recuadro.";

  // Restablecer interfaz
  $("foto-previa").classList.add("oculto");
  $("camara").classList.remove("oculto");

  $("panel-ocr").classList.add("oculto");
  $("recorte-ocr").removeAttribute("src");
  $("foto-previa").removeAttribute("src");
  $("repetir").classList.add("oculto");
  $("siguiente").classList.add("oculto");
  $("ver-resumen").classList.add("oculto");

  $("capturar").classList.remove("oculto");
  $("capturar").disabled = true;

  $("luz").textContent = "Luz: analizando...";
  $("nitidez").textContent = "Nitidez: analizando...";
  $("estabilidad").textContent = "Estabilidad: analizando...";

  $("mensaje-camara").textContent =
    "Preparando cámara...";

  mostrarPantalla("validar");

  const sesion = sesionCamara;

  if (!navigator.mediaDevices?.getUserMedia) {
    $("mensaje-camara").textContent =
      "La cámara requiere HTTPS o localhost.";
    return;
  }

  try {
    let nuevoStream;

    // Preferir cámara trasera
    try {
      nuevoStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
    } catch (error) {
      if (error.name !== "OverconstrainedError") {
        throw error;
      }

      nuevoStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: true
      });
    }

    // Evitar activar cámara si se abandonó la pantalla
    if (sesion !== sesionCamara) {
      nuevoStream.getTracks().forEach(t => t.stop());
      return;
    }

    streamCamara = nuevoStream;

    const video = $("camara");
    video.srcObject = nuevoStream;

    await video.play();

    if (sesion !== sesionCamara) return;

    $("capturar").disabled = false;

    $("mensaje-camara").textContent =
      "Encuadra el codificado y mantén estable el celular.";

    // Analizar imagen aproximadamente cada 650 ms
    timerCalidad = setInterval(analizarCalidad, 650);

  } catch (error) {
    if (sesion !== sesionCamara) return;

    console.error("Error de cámara:", error);

    $("mensaje-camara").textContent =
      "No se pudo abrir la cámara. Revisa los permisos.";
  }
}

// ========================================
// ANALISIS DE CALIDAD EN TIEMPO REAL
// ========================================

function analizarCalidad() {
  const video = $("camara");

  if (!streamCamara || video.readyState < 2) return;

  const canvas = document.createElement("canvas");

  canvas.width = 160;
  canvas.height = 120;

  const ctx = canvas.getContext("2d", {
    willReadFrequently: true
  });

  ctx.drawImage(video, 0, 0, 160, 120);

  const pixeles = ctx.getImageData(
    0, 0, 160, 120
  ).data;

  const grises = new Float32Array(160 * 120);

  let brilloTotal = 0;
  let saturados = 0;

  // Convertir imagen a escala de grises
  for (let i = 0, j = 0; i < pixeles.length; i += 4, j++) {
    const gris =
      0.299 * pixeles[i] +
      0.587 * pixeles[i + 1] +
      0.114 * pixeles[i + 2];

    grises[j] = gris;
    brilloTotal += gris;

    if (gris > 245) saturados++;
  }

  const brillo = brilloTotal / grises.length;
  const porcentajeSaturado = saturados / grises.length;

  // ILUMINACION
  if (brillo < 65) {
    $("luz").textContent =
      "⚠️ Poca luz. Mejora la iluminación.";
  } else if (brillo > 215 || porcentajeSaturado > 0.25) {
    $("luz").textContent =
      "⚠️ Exceso de luz. Evita los reflejos.";
  } else {
    $("luz").textContent =
      "✓ Iluminación aceptable (estimación).";
  }

  // NITIDEZ: varianza del Laplaciano
  let suma = 0;
  let sumaCuadrados = 0;
  let cantidad = 0;

  for (let y = 1; y < 119; y += 2) {
    for (let x = 1; x < 159; x += 2) {
      const k = y * 160 + x;

      const laplaciano =
        4 * grises[k] -
        grises[k - 1] -
        grises[k + 1] -
        grises[k - 160] -
        grises[k + 160];

      suma += laplaciano;
      sumaCuadrados += laplaciano * laplaciano;
      cantidad++;
    }
  }

  const varianza =
    sumaCuadrados / cantidad -
    Math.pow(suma / cantidad, 2);

  if (varianza < 110) {
    $("nitidez").textContent =
      "⚠️ Posible desenfoque. Ajusta el enfoque.";
  } else {
    $("nitidez").textContent =
      "✓ Nitidez aceptable (estimación).";
  }

  // ESTABILIDAD: diferencia entre muestras
  const muestra = [];

  for (let y = 8; y < 120; y += 16) {
    for (let x = 8; x < 160; x += 16) {
      muestra.push(grises[y * 160 + x]);
    }
  }

  if (muestraAnterior) {
    let diferencia = 0;

    for (let i = 0; i < muestra.length; i++) {
      diferencia += Math.abs(
        muestra[i] - muestraAnterior[i]
      );
    }

    diferencia /= muestra.length;

    $("estabilidad").textContent = diferencia > 18
      ? "⚠️ Posible movimiento. Mantén estable el celular."
      : "✓ Estabilidad aceptable (estimación).";
  }

  muestraAnterior = muestra;
}



/* ==========================================
   RECORTE AUTOMATICO Y PREPROCESAMIENTO
========================================== */

// Recorta exactamente la zona visible del recuadro.
// Compatible con object-fit: contain y object-fit: cover.
function recortarCodificado(video) {
  const contenedor = document.getElementById("contenedor-camara");
  const marco = document.getElementById("marco-codificado");

  const cajaVideo = video.getBoundingClientRect();
  const cajaMarco = marco.getBoundingClientRect();

  const anchoOriginal = video.videoWidth;
  const altoOriginal = video.videoHeight;

  if (!anchoOriginal || !altoOriginal) {
    throw new Error("La cámara no tiene dimensiones válidas.");
  }

  const estilo = getComputedStyle(video);
  const ajuste = estilo.objectFit;

  const escala = ajuste === "cover"
    ? Math.max(
        cajaVideo.width / anchoOriginal,
        cajaVideo.height / altoOriginal
      )
    : Math.min(
        cajaVideo.width / anchoOriginal,
        cajaVideo.height / altoOriginal
      );

  const anchoVisible = anchoOriginal * escala;
  const altoVisible = altoOriginal * escala;

  // Posición de la imagen dentro del elemento video.
  // Nuestro CSS utiliza el centrado predeterminado.
  const desplazamientoX =
    (cajaVideo.width - anchoVisible) / 2;

  const desplazamientoY =
    (cajaVideo.height - altoVisible) / 2;

  const izquierdaMarco = cajaMarco.left - cajaVideo.left;
  const arribaMarco = cajaMarco.top - cajaVideo.top;

  const x1 = Math.max(
    0,
    (izquierdaMarco - desplazamientoX) / escala
  );

  const y1 = Math.max(
    0,
    (arribaMarco - desplazamientoY) / escala
  );

  const x2 = Math.min(
    anchoOriginal,
    (izquierdaMarco + cajaMarco.width - desplazamientoX) / escala
  );

  const y2 = Math.min(
    altoOriginal,
    (arribaMarco + cajaMarco.height - desplazamientoY) / escala
  );

  const x = Math.floor(x1);
  const y = Math.floor(y1);

  const ancho = Math.ceil(x2) - x;
  const alto = Math.ceil(y2) - y;

  if (ancho < 30 || alto < 20) {
    throw new Error(
      "El recuadro no coincide con el área visible de la cámara."
    );
  }

  const canvas = document.createElement("canvas");

  canvas.width = ancho;
  canvas.height = alto;

  const contexto = canvas.getContext("2d");

  contexto.drawImage(
    video,
    x, y, ancho, alto,
    0, 0, ancho, alto
  );

  return canvas;
}

// Amplía y mejora el contraste del recorte.
function prepararRecorteOCR(canvasOriginal) {
  const escala = Math.min(
    3,
    2400 / Math.max(
      canvasOriginal.width,
      canvasOriginal.height
    )
  );

  const canvas = document.createElement("canvas");

  canvas.width = Math.max(
    1,
    Math.round(canvasOriginal.width * escala)
  );

  canvas.height = Math.max(
    1,
    Math.round(canvasOriginal.height * escala)
  );

  const contexto = canvas.getContext("2d", {
    willReadFrequently: true
  });

  contexto.imageSmoothingEnabled = true;
  contexto.imageSmoothingQuality = "high";

  contexto.drawImage(
    canvasOriginal,
    0, 0,
    canvas.width,
    canvas.height
  );

  const imagen = contexto.getImageData(
    0, 0,
    canvas.width,
    canvas.height
  );

  const datos = imagen.data;

  // Escala de grises y contraste moderado.
  const contraste = 1.45;

  for (let i = 0; i < datos.length; i += 4) {
    const gris =
      0.299 * datos[i] +
      0.587 * datos[i + 1] +
      0.114 * datos[i + 2];

    const ajustado = Math.max(
      0,
      Math.min(
        255,
        (gris - 128) * contraste + 128
      )
    );

    datos[i] = ajustado;
    datos[i + 1] = ajustado;
    datos[i + 2] = ajustado;
  }

  contexto.putImageData(imagen, 0, 0);

  return canvas.toDataURL("image/png");
}


// ========================================
// CAPTURAR FOTOGRAFIA
// ========================================

$("capturar").addEventListener("click", async () => {
  const video = $("camara");

  if (
    !streamCamara ||
    procesando ||
    video.readyState < 2
  ) {
    return;
  }

  procesando = true;

  try {
    const tipo = etapa;

    // 1. Recortar exactamente el recuadro.
    const canvasRecorte = recortarCodificado(video);

    // 2. Guardar la región original.
    const recorteOriginal = canvasRecorte.toDataURL(
      "image/png"
    );

    // 3. Preparar versión mejorada para OCR.
    const imagenOCR = prepararRecorteOCR(
      canvasRecorte
    );

    // 4. Conservar el recorte de esta etapa.
    capturas[tipo] = recorteOriginal;
    lecturas[tipo] = "";

    // 5. Mostrar la región capturada.
    $("foto-previa").src = recorteOriginal;
    $("foto-previa").classList.remove("oculto");
    $("camara").classList.add("oculto");

    // 6. Detener cámara.
    detenerCamara();

    // 7. Actualizar botones.
    $("capturar").classList.add("oculto");
    $("repetir").classList.remove("oculto");
    $("repetir").disabled = true;

    $("siguiente").classList.add("oculto");
    $("ver-resumen").classList.add("oculto");

    // 8. Mostrar panel OCR.
    $("panel-ocr").classList.remove("oculto");

    $("texto-ocr").value = "";

    $("recorte-ocr").src = imagenOCR;

    $("estado-ocr").textContent =
      "Procesando el recorte del codificado...";

    // 9. Ejecutar OCR sobre la región procesada.
    await reconocerOCR(imagenOCR, tipo);

  } catch (error) {
    console.error("Error al capturar:", error);

    $("mensaje-camara").textContent =
      "No fue posible procesar el recorte. Intenta nuevamente.";

    procesando = false;
    $("capturar").disabled = false;
  }
});


// ========================================
// TESSERACT.JS
// ========================================

async function obtenerWorker() {
  if (typeof Tesseract === "undefined") {
    throw new Error("No se cargó Tesseract.js");
  }

  if (!workerPromise) {
    workerPromise = Tesseract.createWorker("eng")
      .catch(error => {
        workerPromise = null;
        throw error;
      });
  }

  return workerPromise;
}

async function reconocerOCR(fotografia, tipo) {
  const generacion = ++generacionOCR;

  try {
    const worker = await obtenerWorker();

    if (generacion !== generacionOCR) return;

    $("estado-ocr").textContent =
      "Reconociendo caracteres...";

    const respuesta = await worker.recognize(fotografia);

    if (generacion !== generacionOCR) return;

    const texto = (respuesta.data.text || "").trim();

    lecturas[tipo] = texto;
    $("texto-ocr").value = texto;

    if (texto) {
      $("estado-ocr").textContent =
        "Reconocimiento terminado. Lectura sin validar.";

      if (tipo === "unidad") {
        $("siguiente").classList.remove("oculto");
      } else {
        $("ver-resumen").classList.remove("oculto");
      }
    } else {
      $("estado-ocr").textContent =
        "No se detectó texto. Toma otra fotografía.";
    }

  } catch (error) {
    if (generacion !== generacionOCR) return;

    console.error("Error OCR:", error);

    lecturas[tipo] = "";

    $("estado-ocr").textContent =
      "Error de OCR. Comprueba la conexión e inténtalo de nuevo.";

  } finally {
    if (generacion === generacionOCR) {
      procesando = false;
      $("repetir").disabled = false;
    }
  }
}

// ========================================
// REPETIR Y CONTINUAR
// ========================================

$("repetir").addEventListener("click", () => {
  cancelarLectura();
  abrirEtapa(etapa);
});

$("siguiente").addEventListener("click", () => {
  abrirEtapa("corrugado");
});

$("ver-resumen").addEventListener("click", () => {
  detenerCamara();

  $("res-unidad").textContent =
    lecturas.unidad || "(Sin lectura)";

  $("res-corrugado").textContent =
    lecturas.corrugado || "(Sin lectura)";

  $("estado-guardado").textContent = "";

  mostrarPantalla("resumen");
});

$("reiniciar").addEventListener("click", () => {
  limpiarInspeccion();
  abrirEtapa("unidad");
});

// ========================================
// HISTORIAL LOCAL
// ========================================

$("guardar").addEventListener("click", () => {
  if (!lecturas.unidad || !lecturas.corrugado) {
    $("estado-guardado").textContent =
      "Se necesitan ambas lecturas para guardar.";
    return;
  }

  const registro = {
    linea: lineaActual,
    fecha: new Date().toISOString(),
    unidad: lecturas.unidad,
    corrugado: lecturas.corrugado,
    estado: "PENDIENTE_DE_VALIDACION"
  };

  try {
    const historial = JSON.parse(
      localStorage.getItem(STORAGE) || "[]"
    );

    historial.unshift(registro);

    localStorage.setItem(
      STORAGE,
      JSON.stringify(historial.slice(0, 50))
    );

    $("estado-guardado").textContent =
      "Prueba guardada localmente.";

  } catch (error) {
    $("estado-guardado").textContent =
      "No se pudo guardar el historial.";
  }
});

function mostrarHistorial() {
  const contenedor = $("registros");

  contenedor.replaceChildren();

  let registros = [];

  try {
    registros = JSON.parse(
      localStorage.getItem(STORAGE) || "[]"
    ).filter(r => r.linea === lineaActual);
  } catch (error) {
    registros = [];
  }

  if (!registros.length) {
    contenedor.textContent =
      "No hay registros para esta línea.";
    return;
  }

  registros.forEach(registro => {
    const tarjeta = document.createElement("div");
    tarjeta.className = "registro";

    const titulo = document.createElement("strong");
    titulo.textContent =
      new Date(registro.fecha).toLocaleString("es-MX");

    const unidad = document.createElement("p");
    unidad.textContent =
      "Unidad: " + registro.unidad;

    const corrugado = document.createElement("p");
    corrugado.textContent =
      "Corrugado: " + registro.corrugado;

    const estado = document.createElement("p");
    estado.textContent = "Pendiente de validación";

    tarjeta.append(titulo, unidad, corrugado, estado);
    contenedor.appendChild(tarjeta);
  });
}

// ========================================
// INICIO
// ========================================

window.addEventListener("pagehide", () => {
  detenerCamara();
  cancelarLectura();
});

mostrarPantalla("inicio");
