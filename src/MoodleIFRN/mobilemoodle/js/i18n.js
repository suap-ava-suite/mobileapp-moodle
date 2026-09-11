/**
 * i18n.js
 * Tradução do painel Mobile Moodle, que é uma página JavaScript independente do Angular.
 */
(function (window) {
    "use strict";

    const MM = (window.MobileMoodle = window.MobileMoodle || {});
    const App = (MM.App = MM.App || {});
    const requestedLanguage = new URLSearchParams(window.location.search).get("lang") || navigator.language || "pt-BR";

    App.language = requestedLanguage.toLowerCase().startsWith("es") ? "es" : "pt-BR";

    const spanish = {
        "app.title": "Panel AVA · IFRN",
        "panel.title": "Panel AVA",
        "loading.panel": "Cargando el panel...",
        "loading.course": "Cargando el curso...",
        "loading": "Cargando...",
        "profile": "Perfil",
        "accessibility": "Accesibilidad",
        "help": "Ayuda",
        "addfilters": "Añadir filtros",
        "filteredby": "FILTRADO POR:",
        "filter": "FILTRO",
        "alljournals": "Todos los diarios (lento)",
        "logout": "Cerrar sesión",
        "helpcenter": "Centro de ayuda",
        "academicsecretariat": "Secretaría Académica",
        "suapservice": "Centro de servicio SUAP",
        "supportcenters": "Centros de atención",
        "quickreading": "Ajuste rápido de lectura en este dispositivo.",
        "textsize": "Tamaño del texto",
        "decreasetext": "Reducir texto",
        "defaulttext": "Texto predeterminado",
        "increasetext": "Aumentar texto",
        "highcontrast": "Alto contraste",
        "highlightlinks": "Destacar enlaces",
        "inprogress": "En curso",
        "favourites": "Favoritos",
        "hidden": "Ocultos",
        "applyfilter": "Filtrar",
        "clearfilters": "Limpiar filtros",
        "mycourses": "Mis cursos",
        "journals": "Diarios",
        "selfenrolment": "Autoinscripción",
        "completed": "completado",
        "academicava": "AVA Académico",
        "published": "Publicado",
        "favourite": "Favorito",
        "noresults": "No se encontraron resultados en esta pestaña.",
        "nocourses": "Es posible que la Secretaría Académica aún no te haya inscrito en ningún diario; en ese caso, espera.",
        "teacher": "Profesor:",
        "workload": "Carga horaria:",
        "progress": "Progreso:",
        "coursecontent": "Contenido del curso",
        "backtopanel": "Volver al panel",
        "virtualtopic": "Tema del aula virtual",
        "notfound": "Página no encontrada",
        "notfoundmessage": "La dirección que intentaste abrir no existe o fue eliminada.",
        "retry": "Intentar de nuevo",
        "cannotopenpanel": "No fue posible abrir el panel",
        "unexpectederror": "Error inesperado.",
        "somethingwrong": "Algo salió mal",
        "loginagain": "Inicia sesión nuevamente en la aplicación.",
        "unauthorized": "Acceso no autorizado",
        "tokennotfound": "No se encontró el token de acceso. Inicia sesión en la aplicación.",
        "sessionended": "Sesión cerrada",
        "student": "Estudiante",
        "profileimage": "Imagen de perfil",
        "course": "Curso",
        "enrolledcourse": "curso matriculado",
        "enrolledcourses": "cursos matriculados",
        "youhave": "Tienes <strong>{{total}}</strong> {{label}} en el AVA IFRN.",
        "nosections": "No hay secciones disponibles.",
        "topic": "Tema",
        "invalidcourseid": "Identificador de curso no válido.",
        "invalidapipath": "Ruta de API no válida.",
        "networkfailure": "Error de red. Comprueba la conexión e inténtalo de nuevo.",
        "invalidserverresponse": "Respuesta no válida del servidor.",
        "status.401": "Sesión caducada. Inicia sesión de nuevo.",
        "status.404": "No se encontró el recurso solicitado.",
        "status.408": "La solicitud tardó demasiado. Inténtalo de nuevo.",
        "status.429": "Demasiados intentos. Espera e inténtalo de nuevo.",
        "status.500": "Se produjo un error interno en el servidor. Inténtalo de nuevo en unos momentos.",
        "status.502": "El servicio no está disponible temporalmente (puerta de enlace). Comprueba la conexión e inténtalo de nuevo.",
        "status.503": "El servicio está en mantenimiento o sobrecargado. Inténtalo de nuevo pronto.",
        "status.504": "Se agotó el tiempo en el servidor. La conexión es lenta o el servicio no respondió.",
        "status.server": "Error del servidor ({{status}}). Inténtalo de nuevo en unos momentos.",
        "status.default": "No fue posible cargar los datos del panel.",
        "title.404": "No encontrado",
        "title.timeout": "Tiempo agotado",
        "title.429": "Demasiados intentos",
        "title.500": "Error interno del servidor",
        "title.502": "Servicio no disponible",
        "title.503": "Servicio en mantenimiento",
        "title.network": "Error de conexión",
        "title.server": "Error del servidor"
    };

    function t(key, fallback, params) {
        let value = App.language === "es" ? (spanish[key] || fallback || key) : (fallback || key);

        Object.keys(params || {}).forEach(function (name) {
            value = value.replace("{{" + name + "}}", String(params[name]));
        });

        return value;
    }

    function translatePage(root) {
        if (App.language !== "es" || !root || !root.querySelectorAll) {
            return;
        }

        root.querySelectorAll("[data-i18n]").forEach(function (element) {
            const translated = spanish[element.getAttribute("data-i18n")];
            if (translated) {
                element.textContent = translated;
            }
        });

        root.querySelectorAll("[data-i18n-aria-label]").forEach(function (element) {
            const translated = spanish[element.getAttribute("data-i18n-aria-label")];
            if (translated) {
                element.setAttribute("aria-label", translated);
            }
        });
    }

    App.t = t;
    App.translatePage = translatePage;
})(window);
