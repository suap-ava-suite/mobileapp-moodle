/**
 * app-views.js
 * Renderização das telas: painel (lista de cursos) e detalhe do curso.
 */
(function (window) {
    "use strict";

    const MM = (window.MobileMoodle = window.MobileMoodle || {});
    const App = (MM.App = MM.App || {});

    const ACTIVITY_ICONS = {
        assign: "create-outline",
        forum: "chatbubbles-outline",
        quiz: "help-circle-outline",
        resource: "document-text-outline",
        url: "link-outline",
        page: "document-outline",
        folder: "folder-outline",
        book: "book-outline",
        label: "pricetag-outline",
        lesson: "school-outline",
        scorm: "cube-outline",
        h5pactivity: "game-controller-outline",
        workshop: "people-outline",
        choice: "list-outline",
        feedback: "chatbox-ellipses-outline",
        glossary: "library-outline",
        wiki: "globe-outline",
        data: "server-outline",
        chat: "chatbubble-outline",
        bigbluebuttonbn: "videocam-outline",
        attendance: "checkmark-done-outline",
    };

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
        const favBtn = fragment.querySelector(".painel-card-details-info-favourite");

        link.href = "#/curso/" + encodeURIComponent(String(course.id));
        cardTitle.textContent = course.name || ("Curso " + course.id);
        shortname.textContent = course.shortname || ("Curso " + course.id);
        bar.style.width = progress + "%";
        label.textContent = progress + "% concluído";

        if (env && course.moodle) {
            env.textContent = course.moodle;
        }

        if (favBtn && course.isfavourite) {
            favBtn.classList.remove("painel-card-details-info-favourite");
            favBtn.classList.add("painel-card-details-info-unfavourite");
            const icon = favBtn.querySelector("ion-icon");

            if (icon) {
                icon.setAttribute("name", "star");
            }
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

    function activityIcon(modname) {
        const key = String(modname || "").toLowerCase();

        return ACTIVITY_ICONS[key] || "document-text-outline";
    }

    function activityLabel(modname) {
        const key = String(modname || "").toLowerCase();

        if (!key) {
            return "Atividade";
        }

        const map = {
            assign: "Tarefa",
            forum: "Fórum",
            quiz: "Questionário",
            resource: "Arquivo",
            url: "URL",
            page: "Página",
            folder: "Pasta",
            book: "Livro",
            label: "Rótulo",
            lesson: "Lição",
            scorm: "SCORM",
            h5pactivity: "H5P",
            workshop: "Workshop",
            choice: "Escolha",
            feedback: "Pesquisa",
            glossary: "Glossário",
            wiki: "Wiki",
            data: "Banco de dados",
            chat: "Chat",
            bigbluebuttonbn: "BigBlueButton",
            attendance: "Frequência",
        };

        return map[key] || key;
    }

    function buildActivity(activity) {
        const fragment = App.cloneTemplate("tpl-curso-activity");

        if (!fragment) {
            return document.createTextNode("");
        }

        const icon = fragment.querySelector(".activity-item__icon ion-icon");
        const name = fragment.querySelector(".activity-item__name");
        const mod = fragment.querySelector(".activity-item__mod");
        const status = fragment.querySelector(".activity-item__status");
        const modname = activity.modname || activity.module || activity.type || "";

        if (icon) {
            icon.setAttribute("name", activityIcon(modname));
        }

        name.textContent = activity.name || activity.title || "Atividade";
        mod.textContent = activityLabel(modname);

        if (status && typeof activity.completion === "boolean") {
            status.hidden = false;
            status.textContent = activity.completion ? "Concluída" : "Pendente";
            status.classList.toggle("activity-item__status--pending", !activity.completion);
        }

        return fragment;
    }

    function bindSectionToggle(article) {
        const header = article.querySelector(".topic-card__header");

        if (!header) {
            return;
        }

        header.addEventListener("click", function () {
            const open = article.classList.toggle("is-open");

            header.setAttribute("aria-expanded", open ? "true" : "false");
        });
    }

    /** Desenha a página de um curso (progresso + seções + atividades). */
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

        const envTag = document.getElementById("curso-env-tag");

        if (envTag && course.moodle) {
            envTag.textContent = course.moodle;
        }

        const summary = course.summary || course.description || "";
        const summaryBlock = document.getElementById("curso-summary-block");
        const summaryEl = document.getElementById("curso-summary");

        if (summary && summaryBlock && summaryEl) {
            summaryEl.textContent = String(summary).replace(/<[^>]+>/g, " ").trim();
            summaryBlock.hidden = !summaryEl.textContent;
        }

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
            const activities = section.activities || section.modules || section.cms || [];
            const countEl = item.querySelector(".topic-card__count");
            const list = item.querySelector(".activity-list");
            const article = item.querySelector(".topic-card");

            item.querySelector(".topic-index").textContent = String(index + 1);
            item.querySelector(".topic-name").textContent = section.name || ("Tópico " + (index + 1));

            const count = activities.length;

            countEl.textContent = count === 1
                ? "1 atividade"
                : (count > 0 ? count + " atividades" : "Tópico da sala virtual");

            if (!count) {
                const empty = document.createElement("p");

                empty.className = "activity-empty";
                empty.textContent = "Nenhuma atividade nesta seção.";
                list.appendChild(empty);
            } else {
                activities.forEach(function (activity) {
                    list.appendChild(buildActivity(activity));
                });
            }

            // Abre a primeira seção por padrão (como o Moodle costuma destacar o tópico atual).
            if (index === 0 && article) {
                article.classList.add("is-open");
                item.querySelector(".topic-card__header").setAttribute("aria-expanded", "true");
            }

            bindSectionToggle(article);
            batch.appendChild(item);
        });
        sectionsHost.appendChild(batch);
    }

    App.setUser = setUser;
    App.renderPainel = renderPainel;
    App.renderCurso = renderCurso;
})(window);
