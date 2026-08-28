"use strict";
/**
 * app-views.ts
 * Renderização do painel e do detalhe do curso.
 */
(function (window) {
    'use strict';
    const MM = (window.MobileMoodle = window.MobileMoodle || {});
    const App = (MM.App = MM.App || {});
    const ACTIVITY_ICONS = {
        assign: 'create-outline',
        forum: 'chatbubbles-outline',
        quiz: 'help-circle-outline',
        resource: 'document-text-outline',
        url: 'link-outline',
        page: 'document-outline',
        folder: 'folder-outline',
        book: 'book-outline',
        label: 'pricetag-outline',
        lesson: 'school-outline',
        scorm: 'cube-outline',
        h5pactivity: 'game-controller-outline',
        workshop: 'people-outline',
        choice: 'list-outline',
        feedback: 'chatbox-ellipses-outline',
        glossary: 'library-outline',
        wiki: 'globe-outline',
        data: 'server-outline',
        chat: 'chatbubble-outline',
        bigbluebuttonbn: 'videocam-outline',
        attendance: 'checkmark-done-outline',
    };
    const TAB_META = {
        diarios: {
            title: 'Meus Diários',
            empty: 'É possível que a Secretaria Acadêmica ainda não tenha lhe inserido em diário algum; neste caso, aguarde.',
        },
        autoinscricoes: {
            title: 'Cursos com Autoinscrição',
            empty: 'Não há cursos com autoinscrição disponíveis no momento. Ajuste os filtros ou volte mais tarde.',
        },
    };
    function setUser(dashboard) {
        const nome = dashboard.nome || 'Estudante';
        const letter = App.initials(nome);
        const foto = dashboard.foto_url || dashboard.foto || dashboard.avatar_url || '';
        App.sidebarUserName = nome;
        if (App.toolbarAvatar) {
            App.toolbarAvatar.textContent = letter;
        }
        const nameEl = document.getElementById('sidebar-user-name');
        if (nameEl) {
            nameEl.textContent = nome;
        }
        if (App.menuUserInfo && App.menuUserInfo !== nameEl) {
            App.menuUserInfo.textContent = nome;
        }
        const profileBtn = document.getElementById('btn-toggle-profile');
        if (profileBtn) {
            let avatar = document.getElementById('menu-user-avatar');
            if (foto) {
                if (!avatar || avatar.tagName !== 'IMG') {
                    const img = document.createElement('img');
                    img.id = 'menu-user-avatar';
                    img.className = 'profile-image';
                    img.alt = 'Imagem de perfil';
                    if (avatar) {
                        avatar.replaceWith(img);
                    }
                    else {
                        profileBtn.insertBefore(img, profileBtn.firstChild);
                    }
                    avatar = img;
                }
                avatar.src = foto;
            }
            else {
                if (!avatar || avatar.tagName === 'IMG') {
                    const div = document.createElement('div');
                    div.id = 'menu-user-avatar';
                    div.className = 'profile-image profile-image--initials';
                    div.setAttribute('aria-hidden', 'true');
                    if (avatar) {
                        avatar.replaceWith(div);
                    }
                    else {
                        profileBtn.insertBefore(div, profileBtn.firstChild);
                    }
                    avatar = div;
                }
                avatar.className = 'profile-image profile-image--initials';
                avatar.textContent = letter;
            }
        }
        if (typeof App.applyUserFilter === 'function') {
            App.applyUserFilter(dashboard);
        }
    }
    function getPainelLists(dashboard) {
        const diarios = dashboard.diarios || dashboard.courses || [];
        const autoinscricoes = dashboard.autoinscricoes || dashboard.self_enrolments || [];
        return {
            diarios: Array.isArray(diarios) ? diarios : [],
            autoinscricoes: Array.isArray(autoinscricoes) ? autoinscricoes : [],
        };
    }
    function itemName(item) {
        return item.name || item.fullname || ('Curso ' + (item.id || ''));
    }
    function itemEnv(item) {
        return item.moodle || item.environment || (item.ambiente && item.ambiente.titulo) || 'AVA Acadêmico';
    }
    function buildCourseCard(course) {
        const fragment = App.cloneTemplate('tpl-painel-card');
        if (!fragment) {
            return document.createTextNode('');
        }
        const progress = Math.max(0, Math.min(100, Number(course.progress || 0)));
        const link = fragment.querySelector('.painel-card-link');
        const cardTitle = fragment.querySelector('.painel-card-title');
        const shortname = fragment.querySelector('.painel-card-header-shortname');
        const bar = fragment.querySelector('.painel-progress-bar');
        const label = fragment.querySelector('.painel-progress-label');
        const env = fragment.querySelector('.painel-card-header-env');
        const favBtn = fragment.querySelector('.painel-card-details-info-favourite');
        const progressBlock = fragment.querySelector('.painel-card-details-progress');
        if (link) {
            link.href = '#/curso/' + encodeURIComponent(String(course.id));
        }
        if (cardTitle) {
            cardTitle.textContent = itemName(course);
        }
        if (shortname) {
            shortname.textContent = course.shortname || itemName(course);
        }
        if (course.hasprogress === false && course.progress == null) {
            if (progressBlock) {
                progressBlock.hidden = true;
            }
        }
        else {
            if (bar) {
                bar.style.width = progress + '%';
            }
            if (label) {
                label.textContent = progress + '% concluído';
            }
        }
        if (env) {
            env.textContent = itemEnv(course);
        }
        if (favBtn && (course.isfavourite || course.favourite)) {
            favBtn.classList.remove('painel-card-details-info-favourite');
            favBtn.classList.add('painel-card-details-info-unfavourite');
            const icon = favBtn.querySelector('ion-icon');
            if (icon) {
                icon.setAttribute('name', 'star');
            }
        }
        return fragment;
    }
    function buildAutoinscricaoCard(course) {
        const fragment = App.cloneTemplate('tpl-painel-card-autoinscricao');
        if (!fragment) {
            return document.createTextNode('');
        }
        const enrolled = Boolean(course.is_enrolled || course.enrolled);
        const link = fragment.querySelector('.painel-card-link');
        const cardTitle = fragment.querySelector('.painel-card-title');
        const shortname = fragment.querySelector('.painel-card-header-shortname');
        const env = fragment.querySelector('.painel-card-header-env');
        const enrolledBadge = fragment.querySelector('.painel-card-info-enrolled');
        const btnEnroll = fragment.querySelector('.btn-enroll');
        const btnAccess = fragment.querySelector('.btn-access');
        const btnUnenroll = fragment.querySelector('.btn-unenroll');
        const courseId = course.id;
        if (link) {
            link.href = course.details_url
                ? course.details_url
                : '#/curso/' + encodeURIComponent(String(courseId));
        }
        if (cardTitle) {
            cardTitle.textContent = itemName(course);
        }
        if (shortname) {
            shortname.textContent = course.shortname || itemName(course);
        }
        if (env) {
            env.textContent = itemEnv(course);
        }
        if (enrolledBadge) {
            enrolledBadge.hidden = !enrolled;
        }
        if (btnEnroll) {
            btnEnroll.hidden = enrolled;
            btnEnroll.addEventListener('click', () => {
                window.alert('A inscrição será confirmada quando a API de autoinscrição estiver disponível.');
            });
        }
        if (btnAccess) {
            btnAccess.hidden = !enrolled;
            btnAccess.setAttribute('href', '#/curso/' + encodeURIComponent(String(courseId)));
        }
        if (btnUnenroll) {
            btnUnenroll.hidden = !enrolled;
            btnUnenroll.addEventListener('click', () => {
                window.alert('O cancelamento de inscrição será liberado com a API de autoinscrição.');
            });
        }
        return fragment;
    }
    function renderEmpty(host, tabKey) {
        const empty = App.cloneTemplate('tpl-empty-cursos');
        if (!empty) {
            return;
        }
        const hint = empty.querySelector('.no-data__hint');
        const meta = TAB_META[tabKey] || TAB_META.diarios;
        if (hint) {
            hint.textContent = meta.empty;
        }
        host.appendChild(empty);
    }
    function renderTabCards(host, tabKey, lists) {
        const items = tabKey === 'autoinscricoes'
            ? lists.autoinscricoes
            : lists.diarios;
        host.innerHTML = '';
        host.setAttribute('data-active-tab', tabKey);
        if (!items.length) {
            renderEmpty(host, tabKey);
            return;
        }
        const batch = document.createDocumentFragment();
        items.forEach((item) => {
            if (tabKey === 'autoinscricoes') {
                batch.appendChild(buildAutoinscricaoCard(item));
            }
            else {
                batch.appendChild(buildCourseCard(item));
            }
        });
        host.appendChild(batch);
    }
    function updateIntro(tabKey, lists) {
        const titleEl = document.getElementById('painel-intro-title');
        const intro = document.getElementById('painel-intro-text');
        const meta = TAB_META[tabKey] || TAB_META.diarios;
        const items = tabKey === 'autoinscricoes'
            ? lists.autoinscricoes
            : lists.diarios;
        const total = items.length;
        if (titleEl) {
            titleEl.textContent = meta.title;
        }
        if (!intro) {
            return;
        }
        if (tabKey === 'autoinscricoes') {
            const label = total === 1 ? 'curso com autoinscrição' : 'cursos com autoinscrição';
            intro.innerHTML =
                total > 0
                    ? 'Há <strong>' + total + '</strong> ' + label + ' disponíveis.'
                    : 'Nenhum curso com autoinscrição listado no momento.';
            return;
        }
        const label = total === 1 ? 'diário' : 'diários';
        const papel = App.dashboardPapel === 'coordenador'
            ? ' <span class="env-chip">Coordenador</span>'
            : '';
        intro.innerHTML =
            'Você possui <strong>' + total + '</strong> ' + label + ' no AVA IFRN.' + papel;
    }
    function setActiveTab(tabKey, lists) {
        const tabs = document.querySelectorAll('#painel-tabs .ava-tab');
        const cardsHost = document.getElementById('painel-cards');
        tabs.forEach((tab) => {
            const active = tab.getAttribute('data-tab') === tabKey;
            tab.classList.toggle('is-active', active);
            tab.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        updateIntro(tabKey, lists);
        if (cardsHost) {
            renderTabCards(cardsHost, tabKey, lists);
        }
        App.activePainelTab = tabKey;
    }
    function bindTabs(lists) {
        const tabsHost = document.getElementById('painel-tabs');
        if (!tabsHost || tabsHost.dataset.bound === '1') {
            return;
        }
        tabsHost.dataset.bound = '1';
        tabsHost.addEventListener('click', (event) => {
            const target = event.target;
            const tab = target?.closest('.ava-tab');
            if (!tab || tab.disabled) {
                return;
            }
            const key = tab.getAttribute('data-tab');
            if (!key || key === App.activePainelTab) {
                return;
            }
            setActiveTab(key, lists);
        });
    }
    function renderPainel(dashboard) {
        if (App.title) {
            App.title.textContent = 'Painel AVA';
        }
        setUser(dashboard);
        const lists = getPainelLists(dashboard);
        const page = App.cloneTemplate('tpl-painel');
        const initialTab = App.activePainelTab === 'autoinscricoes'
            ? 'autoinscricoes'
            : 'diarios';
        App.dashboardPapel = dashboard.papel || dashboard.role || 'estudante';
        if (!page || !App.content) {
            return;
        }
        App.content.innerHTML = '';
        App.content.appendChild(page);
        const badgeDiarios = document.getElementById('tab-badge-diarios');
        const badgeAuto = document.getElementById('tab-badge-autoinscricoes');
        if (badgeDiarios) {
            badgeDiarios.textContent = String(lists.diarios.length);
        }
        if (badgeAuto) {
            const n = lists.autoinscricoes.length;
            badgeAuto.textContent = String(n);
            badgeAuto.hidden = n === 0;
        }
        bindTabs(lists);
        setActiveTab(initialTab, lists);
        const refresher = document.getElementById('painel-refresher');
        if (refresher) {
            refresher.addEventListener('ionRefresh', (event) => {
                App.loadRoute?.(true).finally(() => {
                    const target = event.target;
                    target.complete?.();
                });
            });
        }
    }
    function activityIcon(modname) {
        const key = String(modname || '').toLowerCase();
        return ACTIVITY_ICONS[key] || 'document-text-outline';
    }
    function activityLabel(modname) {
        const key = String(modname || '').toLowerCase();
        if (!key) {
            return 'Atividade';
        }
        const map = {
            assign: 'Tarefa',
            forum: 'Fórum',
            quiz: 'Questionário',
            resource: 'Arquivo',
            url: 'URL',
            page: 'Página',
            folder: 'Pasta',
            book: 'Livro',
            label: 'Rótulo',
            lesson: 'Lição',
            scorm: 'SCORM',
            h5pactivity: 'H5P',
            workshop: 'Workshop',
            choice: 'Escolha',
            feedback: 'Pesquisa',
            glossary: 'Glossário',
            wiki: 'Wiki',
            data: 'Banco de dados',
            chat: 'Chat',
            bigbluebuttonbn: 'BigBlueButton',
            attendance: 'Frequência',
        };
        return map[key] || key;
    }
    function buildActivity(activity) {
        const fragment = App.cloneTemplate('tpl-curso-activity');
        if (!fragment) {
            return document.createTextNode('');
        }
        const icon = fragment.querySelector('.activity-item__icon ion-icon');
        const name = fragment.querySelector('.activity-item__name');
        const mod = fragment.querySelector('.activity-item__mod');
        const status = fragment.querySelector('.activity-item__status');
        const modname = activity.modname || activity.module || activity.type || '';
        if (icon) {
            icon.setAttribute('name', activityIcon(modname));
        }
        if (name) {
            name.textContent = activity.name || activity.title || 'Atividade';
        }
        if (mod) {
            mod.textContent = activityLabel(modname);
        }
        if (status && typeof activity.completion === 'boolean') {
            status.hidden = false;
            status.textContent = activity.completion ? 'Concluída' : 'Pendente';
            status.classList.toggle('activity-item__status--pending', !activity.completion);
        }
        return fragment;
    }
    function bindSectionToggle(article) {
        if (!article) {
            return;
        }
        const header = article.querySelector('.topic-card__header');
        if (!header) {
            return;
        }
        header.addEventListener('click', () => {
            const open = article.classList.toggle('is-open');
            header.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    }
    function renderCurso(course, dashboard) {
        if (App.title) {
            App.title.textContent = course.name || 'Curso';
        }
        setUser(dashboard);
        const progress = Math.max(0, Math.min(100, Number(course.progress || 0)));
        const page = App.cloneTemplate('tpl-curso');
        if (!page || !App.content) {
            return;
        }
        App.content.innerHTML = '';
        App.content.appendChild(page);
        const breadcrumb = document.getElementById('curso-breadcrumb-name');
        const title = document.getElementById('curso-title');
        const teacher = document.getElementById('curso-teacher');
        const workload = document.getElementById('curso-workload');
        const progressText = document.getElementById('curso-progress-text');
        const progressLabel = document.getElementById('curso-progress-label');
        if (breadcrumb) {
            breadcrumb.textContent = course.name || '';
        }
        if (title) {
            title.textContent = course.name || '';
        }
        if (teacher) {
            teacher.textContent = course.teacher || '—';
        }
        if (workload) {
            workload.textContent = course.workload || '—';
        }
        if (progressText) {
            progressText.textContent = progress + '%';
        }
        if (progressLabel) {
            progressLabel.textContent = progress + '% concluído';
        }
        const envTag = document.getElementById('curso-env-tag');
        if (envTag && course.moodle) {
            envTag.textContent = course.moodle;
        }
        const summary = course.summary || course.description || '';
        const summaryBlock = document.getElementById('curso-summary-block');
        const summaryEl = document.getElementById('curso-summary');
        if (summary && summaryBlock && summaryEl) {
            summaryEl.textContent = String(summary).replace(/<[^>]+>/g, ' ').trim();
            summaryBlock.hidden = !summaryEl.textContent;
        }
        const progressBar = document.getElementById('curso-progress-bar');
        if (progressBar) {
            progressBar.value = progress / 100;
        }
        const sectionsHost = document.getElementById('curso-sections');
        const sections = course.sections || [];
        if (!sectionsHost) {
            return;
        }
        if (!sections.length) {
            sectionsHost.innerHTML = '<div class="empty-state"><p>Nenhuma seção disponível.</p></div>';
            return;
        }
        const batch = document.createDocumentFragment();
        sections.forEach((section, index) => {
            const item = App.cloneTemplate('tpl-curso-section');
            if (!item) {
                return;
            }
            const activities = section.activities || section.modules || section.cms || [];
            const countEl = item.querySelector('.topic-card__count');
            const list = item.querySelector('.activity-list');
            const article = item.querySelector('.topic-card');
            const topicIndex = item.querySelector('.topic-index');
            const topicName = item.querySelector('.topic-name');
            const header = item.querySelector('.topic-card__header');
            if (topicIndex) {
                topicIndex.textContent = String(index + 1);
            }
            if (topicName) {
                topicName.textContent = section.name || ('Tópico ' + (index + 1));
            }
            const count = activities.length;
            if (countEl) {
                countEl.textContent = count === 1
                    ? '1 atividade'
                    : (count > 0 ? count + ' atividades' : 'Tópico da sala virtual');
            }
            if (list) {
                if (!count) {
                    const empty = document.createElement('p');
                    empty.className = 'activity-empty';
                    empty.textContent = 'Nenhuma atividade nesta seção.';
                    list.appendChild(empty);
                }
                else {
                    activities.forEach((activity) => {
                        list.appendChild(buildActivity(activity));
                    });
                }
            }
            if (index === 0 && article && header) {
                article.classList.add('is-open');
                header.setAttribute('aria-expanded', 'true');
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
