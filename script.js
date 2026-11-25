
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");

const camaraContenedor =
    document.getElementById("camaraContenedor");

const recuadro = document.getElementById("recuadro");

const vistaPrevia =
    document.getElementById("vistaPrevia");

const imagenCapturada =
    document.getElementById("imagenCapturada");

const controlesCamara =
    document.getElementById("controlesCamara");

const controlesRevision =
    document.getElementById("controlesRevision");

const resultadoFinal =
    document.getElementById("resultadoFinal");

const pasoTexto =
    document.getElementById("pasoTexto");

const tipoObjeto =
    document.getElementById("tipoObjeto");

const tituloCaptura =
    document.getElementById("tituloCaptura");

const instrucciones =
    document.getElementById("instrucciones");

const mensajeEstado =
    document.getElementById("mensajeEstado");

let pasoActual = 1;
let stream = null;
let fotoTemporal = null;

let fotoUnidad = null;
let fotoCorrugado = null;


// ===============================
// INICIAR CAMARA
// ===============================

async function iniciarCamara() {

    try {

        detenerCamara();

        if (!navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia) {

            throw new Error(
                "La cámara requiere HTTPS o localhost."
            );
        }

        stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                facingMode: {
                    ideal: "environment"
                },
                width: {
                    ideal: 1920
                },
                height: {
                    ideal: 1080
                }
            }
        });

        video.srcObject = stream;

        await video.play();

        mensajeEstado.textContent =
            "Cámara lista. Coloca el código dentro del recuadro.";

    } catch (error) {

        console.error(error);

        mensajeEstado.textContent =
            "No se pudo abrir la cámara. " +
            "Revisa los permisos y utiliza HTTPS.";

    }
}


// ===============================
// DETENER CAMARA
// ===============================

function detenerCamara() {

    if (stream) {

        stream.getTracks().forEach(track => {
            track.stop();
        });

        stream = null;
    }

    video.srcObject = null;
}


// ===============================
// CONFIGURAR PASO
// ===============================

function configurarPaso() {

    pasoTexto.textContent =
        `Paso ${pasoActual} de 2`;

    camaraContenedor.classList.remove("oculto");

    vistaPrevia.classList.add("oculto");

    controlesCamara.classList.remove("oculto");

    controlesRevision.classList.add("oculto");

    resultadoFinal.classList.add("oculto");

    if (pasoActual === 1) {

        tipoObjeto.textContent = "UNIDAD";

        tituloCaptura.textContent =
            "Captura el código de la unidad";

        instrucciones.textContent =
            "Coloca el lotificado de la unidad " +
            "dentro del recuadro pequeño.";

        recuadro.className = "recuadro unidad";

    } else {

        tipoObjeto.textContent = "CORRUGADO";

        tituloCaptura.textContent =
            "Captura el código del corrugado";

        instrucciones.textContent =
            "Coloca toda la información del " +
            "lotificado dentro del recuadro grande.";

        recuadro.className = "recuadro corrugado";
    }

    iniciarCamara();
}


// ===============================
// CAPTURAR Y RECORTAR
// ===============================

function capturarFotografia() {

    if (!stream ||
        video.readyState < 2 ||
        !video.videoWidth ||
        !video.videoHeight) {

        mensajeEstado.textContent =
            "Espera a que la cámara esté lista.";

        return;
    }

    // Medidas de la vista previa
    const videoRect =
        video.getBoundingClientRect();

    const roiRect =
        recuadro.getBoundingClientRect();

    // Resolución real de la cámara
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    // object-fit: cover
    // Calculamos la escala utilizada para llenar
    // el contenedor sin deformar la imagen.

    const escala = Math.max(
        videoRect.width / videoWidth,
        videoRect.height / videoHeight
    );

    const anchoMostrado = videoWidth * escala;
    const altoMostrado = videoHeight * escala;

    const desplazamientoX =
        (anchoMostrado - videoRect.width) / 2;

    const desplazamientoY =
        (altoMostrado - videoRect.height) / 2;

    // Coordenadas del recuadro dentro del video
    const xPantalla =
        roiRect.left - videoRect.left;

    const yPantalla =
        roiRect.top - videoRect.top;

    // Convertir a coordenadas de la imagen real
    let sx =
        (xPantalla + desplazamientoX) / escala;

    let sy =
        (yPantalla + desplazamientoY) / escala;

    let sw = roiRect.width / escala;
    let sh = roiRect.height / escala;

    // Limitar recorte al tamaño real
    sx = Math.max(0, sx);
    sy = Math.max(0, sy);

    sw = Math.min(sw, videoWidth - sx);
    sh = Math.min(sh, videoHeight - sy);

    if (sw <= 0 || sh <= 0) {
        mensajeEstado.textContent =
            "No se pudo calcular el recorte.";
        return;
    }

    // Crear imagen del recuadro
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);

    const contexto = canvas.getContext("2d");

    contexto.drawImage(
        video,
        sx,
        sy,
        sw,
        sh,
        0,
        0,
        canvas.width,
        canvas.height
    );

    fotoTemporal = canvas.toDataURL(
        "image/jpeg",
        0.95
    );

    imagenCapturada.src = fotoTemporal;

    camaraContenedor.classList.add("oculto");
    controlesCamara.classList.add("oculto");

    vistaPrevia.classList.remove("oculto");
    controlesRevision.classList.remove("oculto");

    mensajeEstado.textContent =
        "Revisa que el código esté completo y legible.";

    detenerCamara();
}


// ===============================
// REPETIR FOTOGRAFIA
// ===============================

function repetirFotografia() {

    fotoTemporal = null;

    vistaPrevia.classList.add("oculto");
    controlesRevision.classList.add("oculto");

    camaraContenedor.classList.remove("oculto");
    controlesCamara.classList.remove("oculto");

    iniciarCamara();
}


// ===============================
// CONFIRMAR FOTOGRAFIA
// ===============================

function confirmarFotografia() {

    if (!fotoTemporal) {
        return;
    }

    if (pasoActual === 1) {

        fotoUnidad = fotoTemporal;

        fotoTemporal = null;

        pasoActual = 2;

        configurarPaso();

    } else {

        fotoCorrugado = fotoTemporal;

        fotoTemporal = null;

        mostrarResultadoFinal();
    }
}


// ===============================
// RESULTADO FINAL
// ===============================

function mostrarResultadoFinal() {

    detenerCamara();

    camaraContenedor.classList.add("oculto");
    vistaPrevia.classList.add("oculto");

    controlesCamara.classList.add("oculto");
    controlesRevision.classList.add("oculto");

    resultadoFinal.classList.remove("oculto");

    pasoTexto.textContent = "Inspección completada";
    tipoObjeto.textContent = "FINALIZADO";

    tituloCaptura.textContent =
        "Capturas realizadas";

    instrucciones.textContent =
        "Ambos códigos están listos para su procesamiento.";

    document.getElementById(
        "resultadoUnidad"
    ).src = fotoUnidad;

    document.getElementById(
        "resultadoCorrugado"
    ).src = fotoCorrugado;

    mensajeEstado.textContent =
        "Puedes descargar los recortes.";
}


// ===============================
// DESCARGAR IMAGEN
// ===============================

function descargarImagen(imagen, nombre) {

    const enlace = document.createElement("a");

    enlace.href = imagen;
    enlace.download = nombre;

    document.body.appendChild(enlace);

    enlace.click();

    enlace.remove();
}


// ===============================
// DESCARGAR AMBOS RECORTES
// ===============================

function descargarRecortes() {

    if (!fotoUnidad || !fotoCorrugado) {
        return;
    }

    descargarImagen(
        fotoUnidad,
        "codigo_unidad.jpg"
    );

    descargarImagen(
        fotoCorrugado,
        "codigo_corrugado.jpg"
    );
}


// ===============================
// NUEVA INSPECCION
// ===============================

function nuevaInspeccion() {

    fotoUnidad = null;
    fotoCorrugado = null;
    fotoTemporal = null;

    pasoActual = 1;

    configurarPaso();
}


// ===============================
// EVENTOS
// ===============================

document.getElementById(
    "btnCapturar"
).addEventListener(
    "click",
    capturarFotografia
);

document.getElementById(
    "btnRepetir"
).addEventListener(
    "click",
    repetirFotografia
);

document.getElementById(
    "btnConfirmar"
).addEventListener(
    "click",
    confirmarFotografia
);

document.getElementById(
    "btnDescargar"
).addEventListener(
    "click",
    descargarRecortes
);

document.getElementById(
    "btnNuevaInspeccion"
).addEventListener(
    "click",
    nuevaInspeccion
);

window.addEventListener("pagehide", detenerCamara);


// ===============================
// INICIAR APLICACION
// ===============================

configurarPaso();
