/**
 * app-views.js
 * Renderização das telas: painel (lista de cursos) e detalhe do curso.
 */
(function (window) {
    "use strict";

    const MM = (window.MobileMoodle = window.MobileMoodle || {});
    const App = (MM.App = MM.App || {});

    /** Atualiza avatar e nome no menu / toolbar (estilo AVA). */
    function setUser(dashboard) {
        const nome = dashboard.nome || "Estudante";
        const letter = App.initials(nome);
        const foto = dashboard.foto_url || dashboard.foto || dashboard.avatar_url || "";

        App.sidebarUserName = nome;

        if (App.toolbarAvatar) {
            App.toolbarAvatar.textContent = letter;
        }

        const nameEl = document.getElementById("sidebar-user-name");

        if (nameEl) {
            nameEl.textContent = nome;
        }

        if (App.menuUserInfo && App.menuUserInfo !== nameEl) {
            App.menuUserInfo.textContent = nome;
        }

        const profileBtn = document.getElementById("btn-toggle-profile");

        if (profileBtn) {
            let avatar = document.getElementById("menu-user-avatar");

            if (foto) {
                if (!avatar || avatar.tagName !== "IMG") {
                    const img = document.createElement("img");

                    img.id = "menu-user-avatar";
                    img.className = "profile-image";
                    img.alt = "Imagem de perfil";

                    if (avatar) {
                        avatar.replaceWith(img);
                    } else {
                        profileBtn.insertBefore(img, profileBtn.firstChild);
                    }

                    avatar = img;
                }

                avatar.src = foto;
            } else {
                if (!avatar || avatar.tagName === "IMG") {
                    const div = document.createElement("div");

                    div.id = "menu-user-avatar";
                    div.className = "profile-image profile-image--initials";
                    div.setAttribute("aria-hidden", "true");

                    if (avatar) {
                        avatar.replaceWith(div);
                    } else {
                        profileBtn.insertBefore(div, profileBtn.firstChild);
                    }

                    avatar = div;
                }

                avatar.className = "profile-image profile-image--initials";
                avatar.textContent = letter;
            }
        }

        if (typeof App.applyUserFilter === "function") {
            App.applyUserFilter(dashboard);
        }
    }

    /** Monta um card de curso a partir do template tpl-painel-card. */
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

        // Clique no card abre #/curso/{id}
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

    /** Desenha a lista de cursos do dashboard. */
    function renderPainel(dashboard) {
        App.title.textContent = "Painel AVA";
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

        // Sem cursos → estado vazio do template.
        if (!courses.length) {
            const empty = App.cloneTemplate("tpl-empty-cursos");

            if (empty) {
                cardsHost.appendChild(empty);
            }
        } else {
            // Fragment evita vários reflows ao inserir vários cards.
            const batch = document.createDocumentFragment();

            courses.forEach(function (course) {
                batch.appendChild(buildCourseCard(course));
            });
            cardsHost.appendChild(batch);
        }

        // Pull-to-refresh do Ionic.
        const refresher = document.getElementById("painel-refresher");

        if (refresher) {
            refresher.addEventListener("ionRefresh", function (event) {
                App.loadRoute(true).finally(function () {
                    event.target.complete();
                });
            });
        }
    }

    /** Desenha a página de um curso (progresso + seções/tópicos). */
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
            // ion-progress-bar usa valor de 0 a 1.
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
