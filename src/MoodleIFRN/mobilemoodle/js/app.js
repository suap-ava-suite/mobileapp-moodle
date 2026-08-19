(function () {
    const content = document.getElementById("page-content");
    const title = document.getElementById("page-title");
    const menuUser = document.getElementById("menu-user");
    const toolbarAvatar = document.getElementById("toolbar-avatar");

    let dashboardCache = null;

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function initials(name) {
        const letters = String(name || "U").trim().charAt(0).toUpperCase();

        return letters || "U";
    }

    function setUser(dashboard) {
        const nome = dashboard.nome || "Estudante";
        const username = dashboard.username || "";

        toolbarAvatar.textContent = initials(nome);
        menuUser.innerHTML =
            "<strong>" + escapeHtml(nome) + "</strong>" +
            (username ? "<span>@" + escapeHtml(username) + "</span>" : "");
    }

    function parseRoute() {
        const hash = window.location.hash.replace(/^#/, "") || "/painel";
        const courseMatch = hash.match(/^\/curso\/(\d+)/);

        if (courseMatch) {
            return { name: "curso", courseId: Number(courseMatch[1]) };
        }

        return { name: "painel" };
    }

    function showLoading(message) {
        content.innerHTML =
            '<div class="page-loading">' +
                '<ion-spinner name="crescent" color="primary"></ion-spinner>' +
                "<p>" + escapeHtml(message || "Carregando...") + "</p>" +
            "</div>";
    }

    function showError(message) {
        content.innerHTML =
            '<div class="page-error">' +
                "<h3>Não foi possível abrir o painel</h3>" +
                "<p>" + escapeHtml(message) + "</p>" +
            "</div>";
    }

    function renderPainel(dashboard) {
        title.textContent = "Meus cursos";
        setUser(dashboard);

        const total = dashboard.total_courses || 0;
        const label = total === 1 ? "curso matriculado" : "cursos matriculados";
        const courses = dashboard.courses || [];

        let cards = courses.map(function (course) {
            const progress = Number(course.progress || 0);

            return (
                '<ion-card class="course-card">' +
                    '<ion-card-content>' +
                        '<span class="env-chip">' +
                            '<ion-icon name="folder-outline"></ion-icon>' +
                            "AVA Acadêmico" +
                        "</span>" +
                        '<p class="course-shortname">Sala virtual · ' +
                            escapeHtml(course.shortname || ("Curso " + course.id)) +
                        "</p>" +
                        '<h3 class="course-title">' + escapeHtml(course.name) + "</h3>" +
                        '<div class="course-progress">' +
                            '<ion-progress-bar value="' + (progress / 100) + '"></ion-progress-bar>' +
                            "<span>" + progress + "% concluído</span>" +
                        "</div>" +
                        '<div class="course-actions">' +
                            '<span class="status-chip">Publicado</span>' +
                            '<ion-button href="#/curso/' + course.id + '">Entrar no curso</ion-button>' +
                        "</div>" +
                    "</ion-card-content>" +
                "</ion-card>"
            );
        }).join("");

        if (!cards) {
            cards =
                '<div class="empty-state">' +
                    "<h3>Nenhum curso encontrado</h3>" +
                    "<p>Quando a Secretaria Acadêmica vincular você a um diário, ele aparecerá aqui.</p>" +
                "</div>";
        }

        content.innerHTML =
            '<ion-refresher slot="fixed" id="painel-refresher">' +
                "<ion-refresher-content></ion-refresher-content>" +
            "</ion-refresher>" +
            '<div class="painel-page">' +
                '<div class="tabs-row">' +
                    '<ion-chip color="primary">Meus cursos · ' + total + "</ion-chip>" +
                    '<ion-chip disabled>Diários</ion-chip>' +
                    '<ion-chip disabled>Autoinscrição</ion-chip>' +
                "</div>" +
                '<section class="page-intro">' +
                    "<h2>Meus cursos</h2>" +
                    "<p>Você possui <strong>" + total + "</strong> " + label + " no AVA IFRN.</p>" +
                "</section>" +
                cards +
            "</div>";

        const refresher = document.getElementById("painel-refresher");

        if (refresher) {
            refresher.addEventListener("ionRefresh", function (event) {
                dashboardCache = null;
                if (window.MobileMoodleApi && window.MobileMoodleApi.invalidateCache) {
                    window.MobileMoodleApi.invalidateCache();
                }
                loadRoute().finally(function () {
                    event.target.complete();
                });
            });
        }
    }

    function renderCurso(course, dashboard) {
        title.textContent = course.name;
        setUser(dashboard);

        const progress = Number(course.progress || 0);
        const sections = (course.sections || []).map(function (section, index) {
            return (
                '<article class="topic-card">' +
                    '<span class="topic-index">' + (index + 1) + "</span>" +
                    "<div>" +
                        "<h3>" + escapeHtml(section.name) + "</h3>" +
                        "<p>Tópico da sala virtual</p>" +
                    "</div>" +
                "</article>"
            );
        }).join("");

        content.innerHTML =
            '<div class="curso-page">' +
                '<nav class="breadcrumb">' +
                    '<a href="#/painel">Painel AVA</a>' +
                    "<span>/</span>" +
                    "<strong>" + escapeHtml(course.name) + "</strong>" +
                "</nav>" +
                '<ion-card class="course-hero">' +
                    '<ion-card-content>' +
                        '<span class="env-chip">AVA Acadêmico</span>' +
                        "<h2 class='course-title'>" + escapeHtml(course.name) + "</h2>" +
                        '<ul class="course-meta">' +
                            "<li><strong>Professor:</strong> " + escapeHtml(course.teacher) + "</li>" +
                            "<li><strong>Carga horária:</strong> " + escapeHtml(course.workload) + "</li>" +
                            "<li><strong>Progresso:</strong> " + progress + "%</li>" +
                        "</ul>" +
                        '<div class="course-progress">' +
                            '<ion-progress-bar value="' + (progress / 100) + '"></ion-progress-bar>' +
                            "<span>" + progress + "% concluído</span>" +
                        "</div>" +
                    "</ion-card-content>" +
                "</ion-card>" +
                '<h2 class="section-title">Conteúdo do curso</h2>' +
                (sections || '<div class="empty-state"><p>Nenhuma seção disponível.</p></div>') +
                '<ion-button expand="block" href="#/painel" fill="outline">Voltar ao painel</ion-button>' +
            "</div>";
    }

    async function loadDashboard(force) {
        if (!force && dashboardCache) {
            return dashboardCache;
        }

        dashboardCache = await window.MobileMoodleApi.getDashboard();

        return dashboardCache;
    }

    async function loadRoute() {
        if (!window.MobileMoodleApi.getToken()) {
            showError("Token de acesso não encontrado. Faça login no aplicativo.");

            return;
        }

        const route = parseRoute();

        showLoading(route.name === "curso" ? "Carregando curso..." : "Carregando painel...");

        try {
            const dashboard = await loadDashboard(false);

            if (route.name === "curso") {
                const course = await window.MobileMoodleApi.getCourse(route.courseId);

                renderCurso(course, dashboard);

                return;
            }

            renderPainel(dashboard);
        } catch (error) {
            showError(error.message || "Erro inesperado.");
        }
    }

    window.addEventListener("hashchange", loadRoute);
    window.addEventListener("DOMContentLoaded", function () {
        if (!window.location.hash) {
            window.location.hash = "/painel";

            return;
        }

        loadRoute();
    });
})();
