(function (window) {
    "use strict";

    const MM = (window.MobileMoodle = window.MobileMoodle || {});
    const App = (MM.App = MM.App || {});

    function setUser(dashboard) {
        const nome = dashboard.nome || "Estudante";
        const username = dashboard.username || "";
        const letter = App.initials(nome);

        App.toolbarAvatar.textContent = letter;

        const menuAvatar = document.getElementById("menu-user-avatar");

        if (menuAvatar) {
            menuAvatar.textContent = letter;
        }

        App.menuUserInfo.innerHTML =
            "<strong>" + App.escapeHtml(nome) + "</strong>" +
            (username ? "<span>@" + App.escapeHtml(username) + "</span>" : "");
    }

    function buildCourseCard(course) {
        const fragment = App.cloneTemplate("tpl-painel-card");

        if (!fragment) {
            return document.createTextNode("");
        }

        const progress = Math.max(0, Math.min(100, Number(course.progress || 0)));
        const link = fragment.querySelector(".painel-card-link");
        const cardTitle = fragment.querySelector(".painel-card-title");
        const shortname = fragment.querySelector(".painel-card-header-shortname");
        const bar = fragment.querySelector(".painel-progress-bar");
        const label = fragment.querySelector(".painel-progress-label");
        const env = fragment.querySelector(".painel-card-header-env");

        link.href = "#/curso/" + encodeURIComponent(String(course.id));
        cardTitle.textContent = course.name || ("Curso " + course.id);
        shortname.textContent = course.shortname || ("Curso " + course.id);
        bar.style.width = progress + "%";
        label.textContent = progress + "% concluído";

        if (env && course.moodle) {
            env.textContent = course.moodle;
        }

        return fragment;
    }

    function renderPainel(dashboard) {
        App.title.textContent = "Meus cursos";
        setUser(dashboard);

        const total = dashboard.total_courses || 0;
        const label = total === 1 ? "curso matriculado" : "cursos matriculados";
        const courses = dashboard.courses || [];
        const page = App.cloneTemplate("tpl-painel");

        App.content.innerHTML = "";
        App.content.appendChild(page);

        const intro = document.getElementById("painel-intro-text");
        const badge = document.getElementById("tab-badge-cursos");
        const cardsHost = document.getElementById("painel-cards");

        if (intro) {
            intro.innerHTML =
                "Você possui <strong>" + total + "</strong> " + label + " no AVA IFRN.";
        }

        if (badge) {
            badge.textContent = String(total);
        }

        if (!courses.length) {
            const empty = App.cloneTemplate("tpl-empty-cursos");

            if (empty) {
                cardsHost.appendChild(empty);
            }
        } else {
            const batch = document.createDocumentFragment();

            courses.forEach(function (course) {
                batch.appendChild(buildCourseCard(course));
            });
            cardsHost.appendChild(batch);
        }

        const refresher = document.getElementById("painel-refresher");

        if (refresher) {
            refresher.addEventListener("ionRefresh", function (event) {
                App.loadRoute(true).finally(function () {
                    event.target.complete();
                });
            });
        }
    }

    function renderCurso(course, dashboard) {
        App.title.textContent = course.name || "Curso";
        setUser(dashboard);

        const progress = Math.max(0, Math.min(100, Number(course.progress || 0)));
        const page = App.cloneTemplate("tpl-curso");

        App.content.innerHTML = "";
        App.content.appendChild(page);

        document.getElementById("curso-breadcrumb-name").textContent = course.name || "";
        document.getElementById("curso-title").textContent = course.name || "";
        document.getElementById("curso-teacher").textContent = course.teacher || "—";
        document.getElementById("curso-workload").textContent = course.workload || "—";
        document.getElementById("curso-progress-text").textContent = progress + "%";
        document.getElementById("curso-progress-label").textContent = progress + "% concluído";

        const progressBar = document.getElementById("curso-progress-bar");

        if (progressBar) {
            progressBar.value = progress / 100;
        }

        const sectionsHost = document.getElementById("curso-sections");
        const sections = course.sections || [];

        if (!sections.length) {
            sectionsHost.innerHTML = '<div class="empty-state"><p>Nenhuma seção disponível.</p></div>';

            return;
        }

        const batch = document.createDocumentFragment();

        sections.forEach(function (section, index) {
            const item = App.cloneTemplate("tpl-curso-section");

            item.querySelector(".topic-index").textContent = String(index + 1);
            item.querySelector(".topic-name").textContent = section.name || ("Tópico " + (index + 1));
            batch.appendChild(item);
        });
        sectionsHost.appendChild(batch);
    }

    App.setUser = setUser;
    App.renderPainel = renderPainel;
    App.renderCurso = renderCurso;
})(window);
