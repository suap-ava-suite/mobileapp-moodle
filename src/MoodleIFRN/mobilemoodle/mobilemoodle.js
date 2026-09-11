/*!
 * mobilemoodle.js — bundle do Painel AVA (IFRN)
 * ----------------------------------------------------------------------------
 * IMPORTANTE: este é o único JS que o index.html carrega no navegador.
 * Sem ele o painel não autentica, não busca diários no SUAP e não renderiza UI.
 *
 * Origem: compilação de mobilemoodle.ts + core_mobile/*.ts (esbuild IIFE).
 * NÃO edite a lógica aqui — altere os .ts e rode: npm run build:mobilemoodle
 *
 * Ordem dos módulos no bundle:
 *   namespace → api-errors → api-auth → api-http → api-suap → api
 *   → app-utils → app-status → app-views → app-router
 *   → app-accessibility → app-sidebar → app-keyboard → app (bootstrap)
 *
 * Globais expostas:
 *   window.MobileMoodle     — namespace interno (MM / App)
 *   window.MobileMoodleApi  — fachada pública (token, dashboard, curso)
 */
"use strict";
(() => {
  // src/MoodleIFRN/mobilemoodle/core_mobile/namespace.ts
  /*!
   * namespace.ts
   * ----------------------------------------------------------------------------
   * Cria (ou reutiliza) o objeto global compartilhado entre todos os módulos:
   *
   *   window.MobileMoodle  →  MM   (funções de API + helpers)
   *   window.MobileMoodle.App → App (DOM, render, sidebar, rotas…)
   *
   * Cada arquivo .ts importa MM/App daqui e “pendura” suas funções nesses objetos.
   * Assim o bundle IIFE funciona sem classes/DI do Angular.
   */
  var MM = window.MobileMoodle = window.MobileMoodle || {};
  var App = MM.App = MM.App || {};

  // src/MoodleIFRN/mobilemoodle/core_mobile/api-errors.ts
  /*!
   * api-errors.ts
   * ----------------------------------------------------------------------------
   * Padroniza falhas da API para a UI.
   *
   * - messageForStatus / titleForStatus → textos amigáveis por código HTTP
   * - isRetryable → decide se mostra botão “Tentar novamente”
   * - ApiError → construtor estilo Error com status, title, message, retryable
   *
   * Exposto em MM para os outros módulos (api-http, app-status…).
   */
  function messageForStatus(status, detail) {
    switch (status) {
      case 401:
      case 403:
        return "Sess\xE3o expirada. Entre novamente.";
      case 404:
        return "O recurso solicitado n\xE3o foi encontrado.";
      case 408:
        return "A requisi\xE7\xE3o demorou demais. Tente novamente.";
      case 429:
        return "Muitas tentativas. Aguarde e tente de novo.";
      case 500:
        return "Ocorreu um erro interno no servidor. Tente novamente em instantes.";
      case 502:
        return "O servi\xE7o est\xE1 temporariamente indispon\xEDvel (gateway). Verifique a conex\xE3o e tente de novo.";
      case 503:
        return "O servi\xE7o est\xE1 em manuten\xE7\xE3o ou sobrecarregado. Tente novamente em breve.";
      case 504:
        return "Tempo esgotado no servidor. A conex\xE3o est\xE1 lenta ou o servi\xE7o n\xE3o respondeu.";
      default:
        if (status >= 500) {
          return "Erro no servidor (" + status + "). Tente novamente em instantes.";
        }
        return detail || "N\xE3o foi poss\xEDvel carregar os dados do painel.";
    }
  }
  function titleForStatus(status) {
    switch (status) {
      case 401:
      case 403:
        return "Acesso n\xE3o autorizado";
      case 404:
        return "N\xE3o encontrado";
      case 408:
      case 504:
        return "Tempo esgotado";
      case 429:
        return "Muitas tentativas";
      case 500:
        return "Erro interno do servidor";
      case 502:
        return "Servi\xE7o indispon\xEDvel";
      case 503:
        return "Servi\xE7o em manuten\xE7\xE3o";
      case 0:
        return "Falha de conex\xE3o";
      default:
        if (status >= 500) {
          return "Erro no servidor";
        }
        return "Algo deu errado";
    }
  }
  function isRetryable(status) {
    return status === 0 || status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504 || status >= 500;
  }
  function ApiError(status, detail) {
    const code = Number(status) || 0;
    this.name = "ApiError";
    this.status = code;
    this.title = titleForStatus(code);
    this.message = messageForStatus(code, detail);
    this.retryable = isRetryable(code);
  }
  ApiError.prototype = Object.create(Error.prototype);
  ApiError.prototype.constructor = ApiError;
  MM.messageForStatus = messageForStatus;
  MM.titleForStatus = titleForStatus;
  MM.isRetryable = isRetryable;
  MM.ApiError = ApiError;

  // src/MoodleIFRN/mobilemoodle/core_mobile/api-auth.ts
  /*!
   * api-auth.ts
   * ----------------------------------------------------------------------------
   * Sessão JWT do painel.
   *
   * Fluxo típico após o login IFRN:
   *   1. App abre mobilemoodle/index.html (token pode vir em ?token= uma vez)
   *   2. getToken() valida, salva em sessionStorage e remove o token da URL
   *   3. Demais requests usam Authorization: Bearer …
   *
   * Segurança: formato JWT, tamanho máximo, exp se existir; token inválido é apagado.
   */
  var TOKEN_KEY = "ifrn_access_token";
  var JWT_SHAPE = /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/;
  function readJwtPayload(token) {
    try {
      const part = token.split(".")[1];
      const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
      const json = window.atob(padded);
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
  function isValidToken(token) {
    if (typeof token !== "string" || !JWT_SHAPE.test(token) || token.length >= 4096) {
      return false;
    }
    const payload = readJwtPayload(token);
    if (!payload || typeof payload !== "object") {
      return false;
    }
    if (typeof payload.exp === "number" && payload.exp * 1e3 <= Date.now()) {
      return false;
    }
    return true;
  }
  function stripTokenFromUrl() {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has("token")) {
        return;
      }
      url.searchParams.delete("token");
      window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
    } catch {
    }
  }
  function getToken() {
    const params = new URLSearchParams(window.location.search);
    const queryToken = params.get("token");
    if (queryToken && isValidToken(queryToken)) {
      sessionStorage.setItem(TOKEN_KEY, queryToken);
      stripTokenFromUrl();
      return queryToken;
    }
    if (queryToken) {
      stripTokenFromUrl();
    }
    const stored = sessionStorage.getItem(TOKEN_KEY);
    if (stored && isValidToken(stored)) {
      return stored;
    }
    if (stored) {
      clearToken();
    }
    return null;
  }
  function setToken(token) {
    if (!isValidToken(token)) {
      clearToken();
      return false;
    }
    sessionStorage.setItem(TOKEN_KEY, token);
    return true;
  }
  function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
    if (typeof MM.invalidateCache === "function") {
      MM.invalidateCache();
    }
  }
  MM.TOKEN_KEY = TOKEN_KEY;
  MM.isValidToken = isValidToken;
  MM.getToken = getToken;
  MM.setToken = setToken;
  MM.clearToken = clearToken;

  // src/MoodleIFRN/mobilemoodle/core_mobile/api-http.ts
  /*!
   * api-http.ts
   * ----------------------------------------------------------------------------
   * Cliente HTTP do painel.
   *
   * - Exige JWT (MM.getToken)
   * - Timeout 15s via AbortController
   * - 401/403 limpam a sessão
   * - Só aceita base URL da mesma origem (ou localhost em dev)
   * - Paths devem ser relativos seguros ("/dashboard/", não "//evil…")
   */
  var DEFAULT_BASE_URL = "";
  var REQUEST_TIMEOUT_MS = 15e3;
  var baseUrl = DEFAULT_BASE_URL;
  function isAllowedApiBase(url) {
    try {
      const parsed = new URL(url);
      const origin = window.location.origin;
      if (parsed.origin === origin) {
        return true;
      }
      if (parsed.origin === "https://suap.ifrn.edu.br") {
        return true;
      }
      return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(parsed.origin);
    } catch {
      return false;
    }
  }
  function isSafeApiPath(path) {
    return typeof path === "string" && path.charAt(0) === "/" && path.charAt(1) !== "/" && !/^[a-z][a-z0-9+.-]*:/i.test(path) && path.indexOf("\\") === -1;
  }
  function setApiBaseUrl(url) {
    if (typeof url !== "string") {
      baseUrl = DEFAULT_BASE_URL;
      return;
    }
    const cleaned = url.trim().replace(/\/+$/, "");
    if (!cleaned || !isAllowedApiBase(cleaned)) {
      baseUrl = DEFAULT_BASE_URL;
      return;
    }
    baseUrl = cleaned;
  }
  function joinUrl(path) {
    if (!isSafeApiPath(path)) {
      throw new MM.ApiError(400, "Caminho de API inv\xE1lido.");
    }
    if (!baseUrl) {
      return path;
    }
    return baseUrl + path;
  }
  async function readError(response) {
    try {
      const data = await response.json();
      const message = data && (data.detail || data.message);
      if (typeof message === "string") {
        return message.slice(0, 280);
      }
      return response.statusText;
    } catch {
      try {
        const text = await response.text();
        return (text || response.statusText).slice(0, 280);
      } catch {
        return response.statusText;
      }
    }
  }
  async function request(path, options) {
    const token = MM.getToken();
    if (!token) {
      throw new MM.ApiError(401);
    }
    if (!isSafeApiPath(path)) {
      throw new MM.ApiError(400, "Caminho de API inv\xE1lido.");
    }
    const softAuth = Boolean(options && options.softAuth);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
    const headers = {
      Accept: "application/json",
      Authorization: "Bearer " + token
    };
    let response;
    try {
      response = await fetch(joinUrl(path), {
        method: options && options.method || "GET",
        headers,
        credentials: "omit",
        cache: "no-store",
        signal: controller.signal,
        body: options && options.body
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new MM.ApiError(408);
      }
      throw new MM.ApiError(0, "Falha de rede. Confira a conex\xE3o e tente novamente.");
    } finally {
      window.clearTimeout(timeoutId);
    }
    if (response.status === 401 || response.status === 403) {
      if (!softAuth) {
        MM.clearToken();
      }
      throw new MM.ApiError(response.status);
    }
    if (!response.ok) {
      const detail = await readError(response);
      throw new MM.ApiError(response.status, detail);
    }
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new MM.ApiError(502, "Resposta inv\xE1lida do servidor.");
    }
    return response.json();
  }
  MM.setApiBaseUrl = setApiBaseUrl;
  MM.joinUrl = joinUrl;
  MM.request = request;

  // src/MoodleIFRN/mobilemoodle/core_mobile/api-suap.ts
  /*!
   * api-suap.ts
   * ----------------------------------------------------------------------------
   * Adapta endpoints oficiais do SUAP para o formato interno do painel
   * (DashboardData / CourseData).
   *
   * Autenticação: Bearer JWT de POST /api/token/pair
   * Docs: https://suap.ifrn.edu.br/api/docs/
   */
  function asPagedResults(data) {
    if (Array.isArray(data)) {
      return data;
    }
    if (data && typeof data === "object" && Array.isArray(data.results)) {
      return data.results;
    }
    return [];
  }
  function absoluteSuapUrl(pathOrUrl) {
    if (!pathOrUrl) {
      return void 0;
    }
    if (/^https?:\/\//i.test(pathOrUrl) || pathOrUrl.startsWith("data:")) {
      return pathOrUrl;
    }
    if (pathOrUrl.startsWith("/")) {
      return "https://suap.ifrn.edu.br" + pathOrUrl;
    }
    return pathOrUrl;
  }
  function displayName(eu) {
    return eu.nome_social || eu.nome_usual || eu.nome || eu.identificacao || "Usu\xE1rio SUAP";
  }
  function roleFromTipo(tipo) {
    const value = (tipo || "").toLowerCase();
    if (value.includes("servidor") || value.includes("professor") || value.includes("docente")) {
      return "coordenador";
    }
    return "estudante";
  }
  function latestPeriod(periods) {
    if (!periods.length) {
      return null;
    }
    return periods.reduce((best, current) => {
      if (current.ano_letivo > best.ano_letivo || current.ano_letivo === best.ano_letivo && current.periodo_letivo > best.periodo_letivo) {
        return current;
      }
      return best;
    });
  }
  function progressFromDisciplina(disciplina) {
    if (!disciplina) {
      return null;
    }
    const total = Number(disciplina.ch_total_aula || 0);
    const done = Number(disciplina.ch_cumprida_aula || 0);
    if (total > 0) {
      return Math.max(0, Math.min(100, Math.round(done / total * 100)));
    }
    if (typeof disciplina.frequencia === "number") {
      return Math.max(0, Math.min(100, Math.round(disciplina.frequencia)));
    }
    return null;
  }
  function mapDiarioToCourse(diario) {
    const disciplina = diario.disciplina;
    const name = diario.componente_curricular || disciplina?.descricao || disciplina?.sigla || `Di\xE1rio ${diario.id}`;
    const progress = progressFromDisciplina(disciplina);
    return {
      id: diario.id,
      name,
      fullname: name,
      shortname: disciplina?.sigla || String(diario.id),
      progress,
      hasprogress: progress != null,
      moodle: diario.ambiente_virtual || "SUAP",
      is_enrolled: true,
      enrolled: true
    };
  }
  function isApiError(error) {
    return Boolean(
      error && typeof error === "object" && typeof error.status === "number"
    );
  }
  async function softGet(path) {
    try {
      return await MM.request(path, { softAuth: true });
    } catch (error) {
      if (isApiError(error) && (error.status === 404 || error.status === 403 || error.status === 400)) {
        return null;
      }
      throw error;
    }
  }
  async function fetchStudentDiarios(period) {
    const semestre = `${period.ano_letivo}.${period.periodo_letivo}`;
    const bySemestre = await softGet(`/api/ensino/diarios/${encodeURIComponent(semestre)}/`);
    if (bySemestre) {
      return asPagedResults(bySemestre);
    }
    const byPeriod = await softGet(
      `/api/ensino/meus-diarios/${period.ano_letivo}/${period.periodo_letivo}/`
    );
    if (byPeriod) {
      return asPagedResults(byPeriod);
    }
    return [];
  }
  async function fetchOpenDiarios() {
    const open = await softGet("/api/ensino/meus-diarios/");
    return open ? asPagedResults(open) : [];
  }
  async function fetchSuapDashboard() {
    const eu = await MM.request("/api/rh/eu/");
    const periodsRaw = await softGet("/api/ensino/meus-periodos-letivos/");
    const periods = periodsRaw ? asPagedResults(periodsRaw) : [];
    const period = latestPeriod(periods);
    let diarios = [];
    if (period) {
      diarios = await fetchStudentDiarios(period);
    }
    if (!diarios.length) {
      diarios = await fetchOpenDiarios();
    }
    const courses = diarios.map(mapDiarioToCourse);
    const username = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("ifrn_username") || void 0 : void 0;
    return {
      nome: displayName(eu),
      username,
      foto_url: absoluteSuapUrl(eu.foto),
      foto: absoluteSuapUrl(eu.foto),
      avatar_url: absoluteSuapUrl(eu.foto),
      papel: roleFromTipo(eu.tipo_usuario),
      role: roleFromTipo(eu.tipo_usuario),
      courses,
      diarios: courses,
      autoinscricoes: [],
      self_enrolments: [],
      total_courses: courses.length,
      filtro_situacao: "inprogress",
      situacao: "inprogress"
    };
  }
  function teachersLabel(professores) {
    if (!professores || !professores.length) {
      return "Professor(a) n\xE3o informado";
    }
    return professores.map((item) => item.nome_usual || item.nome || "").filter(Boolean).join(", ") || "Professor(a) n\xE3o informado";
  }
  function sectionsFromTurma(turma) {
    const sections = [];
    const aulas = Array.isArray(turma.aulas) ? turma.aulas : [];
    const materiais = Array.isArray(turma.materiais_de_aula) ? turma.materiais_de_aula : [];
    if (aulas.length) {
      sections.push({
        name: "Aulas",
        activities: aulas.map((aula) => ({
          name: aula.conteudo || `Aula ${aula.data || ""}`.trim(),
          modname: "lesson",
          completion: false
        }))
      });
    }
    if (materiais.length) {
      sections.push({
        name: "Materiais",
        activities: materiais.map((material) => ({
          name: material.descricao || "Material",
          modname: "resource",
          completion: false
        }))
      });
    }
    return sections;
  }
  async function sectionsFromDiarioEndpoints(diarioId) {
    const [aulasRaw, materiaisRaw, topicosRaw] = await Promise.all([
      softGet(`/api/ensino/diarios/${encodeURIComponent(diarioId)}/aulas/`),
      softGet(`/api/ensino/diarios/${encodeURIComponent(diarioId)}/materiais/`),
      softGet(`/api/ensino/diarios/${encodeURIComponent(diarioId)}/topicos/`)
    ]);
    const sections = [];
    const aulas = asPagedResults(aulasRaw);
    const materiais = asPagedResults(materiaisRaw);
    const topicos = asPagedResults(topicosRaw);
    if (aulas.length) {
      sections.push({
        name: "Aulas",
        activities: aulas.map((aula) => ({
          name: aula.conteudo || `Aula ${aula.data || ""}`.trim(),
          modname: "lesson",
          completion: false
        }))
      });
    }
    if (materiais.length) {
      sections.push({
        name: "Materiais",
        activities: materiais.map((material) => ({
          name: material.descricao || "Material",
          modname: "resource",
          completion: false
        }))
      });
    }
    if (topicos.length) {
      sections.push({
        name: "T\xF3picos",
        activities: topicos.map((topico) => ({
          name: topico.titulo || topico.descricao || `T\xF3pico ${topico.id || ""}`,
          modname: "forum",
          completion: false
        }))
      });
    }
    return sections;
  }
  async function fetchSuapCourse(courseId) {
    const turma = await softGet(
      `/api/ensino/minha-turma-virtual/${encodeURIComponent(courseId)}/`
    );
    if (turma) {
      const name = turma.componente_curricular || `Di\xE1rio ${courseId}`;
      return {
        id: turma.id || Number(courseId),
        name,
        teacher: teachersLabel(turma.professores),
        workload: "",
        progress: 0,
        moodle: "SUAP",
        summary: [
          turma.ano_letivo && turma.periodo_letivo ? `Per\xEDodo ${turma.ano_letivo}.${turma.periodo_letivo}` : ""
        ].filter(Boolean).join(" \xB7 "),
        sections: sectionsFromTurma(turma)
      };
    }
    const professoresRaw = await softGet(
      `/api/ensino/diarios/${encodeURIComponent(courseId)}/professores/`
    );
    const sections = await sectionsFromDiarioEndpoints(courseId);
    const professores = asPagedResults(professoresRaw);
    if (!sections.length && !professores.length) {
      throw new MM.ApiError(404, "Di\xE1rio n\xE3o encontrado no SUAP.");
    }
    return {
      id: Number(courseId),
      name: `Di\xE1rio ${courseId}`,
      teacher: teachersLabel(professores),
      workload: "",
      progress: 0,
      moodle: "SUAP",
      summary: "",
      sections
    };
  }
  MM.fetchSuapDashboard = fetchSuapDashboard;
  MM.fetchSuapCourse = fetchSuapCourse;

  // src/MoodleIFRN/mobilemoodle/core_mobile/api.ts
  /*!
   * api.ts
   * ----------------------------------------------------------------------------
   * Fachada de dados do painel + cache em memória.
   *
   * Fonte: API oficial do SUAP (JWT do login IFRN).
   *   GET /api/rh/eu/ + diários  → getDashboard()
   *   GET turma/diário            → getCourse(id)
   *
   * Cache:
   *   - TTL 60s
   *   - inFlight evita requests duplicados em paralelo
   *   - cursos: Map com no máximo 40 entradas (FIFO simples)
   *
   * Também monta window.MobileMoodleApi (API pública para o app Ionic / login).
   *
   * DEMO_FORCE_500: deixe false em produção; true só para testar tela de erro.
   */
  var CACHE_TTL_MS = 60 * 1e3;
  var MAX_COURSE_CACHE = 40;
  var DEMO_FORCE_500 = false;
  var dashboardCache = {
    value: null,
    fetchedAt: 0,
    inFlight: null
  };
  var courseCache = /* @__PURE__ */ new Map();
  function isCacheFresh(fetchedAt) {
    return Boolean(fetchedAt) && Date.now() - fetchedAt < CACHE_TTL_MS;
  }
  function invalidateCache() {
    dashboardCache.value = null;
    dashboardCache.fetchedAt = 0;
    dashboardCache.inFlight = null;
    courseCache.clear();
  }
  function getDashboard(force = false) {
    if (DEMO_FORCE_500) {
      return Promise.reject(new MM.ApiError(500));
    }
    if (!force && dashboardCache.value && isCacheFresh(dashboardCache.fetchedAt)) {
      return Promise.resolve(dashboardCache.value);
    }
    if (dashboardCache.inFlight && !force) {
      return dashboardCache.inFlight;
    }
    dashboardCache.inFlight = MM.fetchSuapDashboard().then((dashboard) => {
      dashboardCache.value = dashboard;
      dashboardCache.fetchedAt = Date.now();
      return dashboard;
    }).finally(() => {
      dashboardCache.inFlight = null;
    });
    return dashboardCache.inFlight;
  }
  function pruneCourseCache() {
    if (courseCache.size <= MAX_COURSE_CACHE) {
      return;
    }
    const oldest = courseCache.keys().next().value;
    if (oldest !== void 0) {
      courseCache.delete(oldest);
    }
  }
  function getCourse(courseId, force = false) {
    const id = String(courseId);
    if (!/^\d+$/.test(id)) {
      return Promise.reject(new MM.ApiError(404, "Identificador de curso inv\xE1lido."));
    }
    let entry = courseCache.get(id);
    if (!entry) {
      entry = { value: null, fetchedAt: 0, inFlight: null };
      courseCache.set(id, entry);
      pruneCourseCache();
    }
    if (!force && entry.value && isCacheFresh(entry.fetchedAt)) {
      return Promise.resolve(entry.value);
    }
    if (entry.inFlight && !force) {
      return entry.inFlight;
    }
    entry.inFlight = MM.fetchSuapCourse(id).then((course) => {
      entry.value = course;
      entry.fetchedAt = Date.now();
      return course;
    }).finally(() => {
      entry.inFlight = null;
    });
    return entry.inFlight;
  }
  async function getCoursesList() {
    const dashboard = await getDashboard(false);
    return dashboard && dashboard.courses || [];
  }
  MM.invalidateCache = invalidateCache;
  MM.getDashboard = getDashboard;
  MM.getCourse = getCourse;
  MM.getCoursesList = getCoursesList;
  window.MobileMoodleApi = {
    setApiBaseUrl: MM.setApiBaseUrl,
    getToken: MM.getToken,
    setToken: MM.setToken,
    clearToken: MM.clearToken,
    invalidateCache,
    getCoursesList,
    getDashboard,
    getCourse
  };

  // src/MoodleIFRN/mobilemoodle/core_mobile/app-utils.ts
  /*!
   * app-utils.ts
   * ----------------------------------------------------------------------------
   * Utilitários de UI compartilhados pelo App:
   * - descobrir pasta dos assets (logo, pages/*.html)
   * - escapeHtml / iniciais do nome
   * - clonar <template id="tpl-…">
   * - fetchText de partials HTML
   * - URL de volta ao login IFRN
   */
  function resolveAssetBase() {
    const scripts = document.getElementsByTagName("script");
    for (let i = scripts.length - 1; i >= 0; i -= 1) {
      const src = scripts[i].src || "";
      if (src.indexOf("/mobilemoodle.js") !== -1) {
        return src.replace(/\/mobilemoodle\.js(?:\?.*)?$/i, "/");
      }
    }
    try {
      return new URL("./", window.location.href).href;
    } catch {
      return "/mobilemoodle/";
    }
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function initials(name) {
    const letters = String(name || "U").trim().charAt(0).toUpperCase();
    return letters || "U";
  }
  function cloneTemplate(id) {
    const tpl = document.getElementById(id);
    if (!tpl) {
      return null;
    }
    return tpl.content.cloneNode(true);
  }
  async function fetchText(url) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      controller.abort();
    }, 1e4);
    try {
      const response = await fetch(url, {
        credentials: "omit",
        cache: "force-cache",
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error("Falha ao carregar interface (" + response.status + ").");
      }
      return response.text();
    } finally {
      window.clearTimeout(timer);
    }
  }
  function resolveLoginUrl() {
    try {
      const appRoot = new URL("../", App.ASSET_BASE || window.location.href);
      appRoot.hash = "/login/ifrn-login";
      return appRoot.toString();
    } catch {
      return "/#/login/ifrn-login";
    }
  }
  App.ASSET_BASE = resolveAssetBase();
  App.resolveLoginUrl = resolveLoginUrl;
  App.escapeHtml = escapeHtml;
  App.initials = initials;
  App.cloneTemplate = cloneTemplate;
  App.fetchText = fetchText;

  // src/MoodleIFRN/mobilemoodle/core_mobile/app-status.ts
  /*!
   * app-status.ts
   * ----------------------------------------------------------------------------
   * Estados visuais enquanto a rota carrega ou falha:
   * - splash / loading (mínimo ~3s na 1ª carga para não “piscar”)
   * - not found (hash inválido)
   * - erro HTTP / rede (template tpl-error-page ou fallback simples)
   */
  var SPLASH_GAUGE_SVG = '<div class="ava-splash__gauge" aria-hidden="true"><svg class="ava-splash__gauge-svg" viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="ava-splash-gauge-grad" gradientUnits="userSpaceOnUse" x1="60" y1="6" x2="60" y2="114"><stop offset="0%" stop-color="#61c924"></stop><stop offset="55%" stop-color="#098e95"></stop><stop offset="100%" stop-color="#0b6064"></stop></linearGradient></defs><circle class="ava-splash__gauge-track" cx="60" cy="60" r="54"></circle><circle class="ava-splash__gauge-arc" cx="60" cy="60" r="54"></circle></svg></div>';
  var LOADING_MIN_MS = 3e3;
  var loadingStartedAt = 0;
  function markLoadingStart() {
    if (!loadingStartedAt) {
      loadingStartedAt = Date.now();
    }
  }
  function waitLoadingMinimum(force = false) {
    if (force || !loadingStartedAt) {
      loadingStartedAt = 0;
      return Promise.resolve();
    }
    const remaining = LOADING_MIN_MS - (Date.now() - loadingStartedAt);
    loadingStartedAt = 0;
    if (remaining <= 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      window.setTimeout(resolve, remaining);
    });
  }
  function buildSplashBrand(logoSrc) {
    return '<div class="ava-splash__brand">' + SPLASH_GAUGE_SVG + '<img class="ava-splash__logo" src="' + logoSrc + '" alt="Painel AVA"></div>';
  }
  function showLoading(message) {
    markLoadingStart();
    const logoSrc = (App.ASSET_BASE || "") + "static/theme/ifrn/img/splash-logo.png";
    if (!App.content) {
      return;
    }
    App.content.innerHTML = '<div class="ava-splash page-loading" role="status" aria-live="polite">' + buildSplashBrand(logoSrc) + '<p class="ava-splash__text">' + App.escapeHtml(message || "Carregando...") + "</p></div>";
  }
  function bindRetry(button) {
    if (!button) {
      return;
    }
    button.addEventListener("click", () => {
      App.loadRoute?.(true);
    });
  }
  function showErrorFallback(message, canRetry) {
    if (!App.content) {
      return;
    }
    App.content.innerHTML = '<div class="page-error"><h3>N\xE3o foi poss\xEDvel abrir o painel</h3><p>' + App.escapeHtml(message) + "</p>" + (canRetry ? '<ion-button id="retry-load" color="primary">Tentar novamente</ion-button>' : "") + "</div>";
    bindRetry(document.getElementById("retry-load"));
  }
  function showNotFound() {
    if (App.title) {
      App.title.textContent = "N\xE3o encontrada";
    }
    if (App.subtitle) {
      App.subtitle.textContent = "Painel AVA";
      App.subtitle.hidden = false;
    }
    const page = App.cloneTemplate?.("tpl-not-found");
    if (!page || !App.content) {
      showErrorFallback("O endere\xE7o que voc\xEA tentou abrir n\xE3o existe ou foi removido.", false);
      return;
    }
    App.content.innerHTML = "";
    App.content.appendChild(page);
  }
  function showStatusError(error) {
    const err = error;
    const status = err && typeof err.status === "number" ? err.status : 0;
    const message = err && err.message || "Erro inesperado.";
    const errorTitle = err && err.title || "Algo deu errado";
    const canRetry = err && typeof err.retryable === "boolean" ? err.retryable : status === 0 || status === 408 || status >= 500;
    if (status === 404) {
      showNotFound();
      return;
    }
    const page = App.cloneTemplate?.("tpl-error-page");
    if (!page || !App.content) {
      showErrorFallback(message, canRetry);
      return;
    }
    if (App.title) {
      App.title.textContent = errorTitle;
    }
    if (App.subtitle) {
      App.subtitle.textContent = "Painel AVA";
      App.subtitle.hidden = false;
    }
    App.content.innerHTML = "";
    App.content.appendChild(page);
    const codeEl = document.getElementById("status-code");
    const titleEl = document.getElementById("status-title");
    const messageEl = document.getElementById("status-message");
    const actionsEl = document.getElementById("status-actions");
    if (codeEl) {
      codeEl.textContent = status > 0 ? String(status) : "!";
    }
    if (titleEl) {
      titleEl.textContent = errorTitle;
    }
    if (messageEl) {
      messageEl.textContent = message;
    }
    if (actionsEl) {
      actionsEl.innerHTML = "";
      if (canRetry) {
        const retry = document.createElement("ion-button");
        retry.id = "retry-load";
        retry.setAttribute("color", "primary");
        retry.textContent = "Tentar novamente";
        actionsEl.appendChild(retry);
        bindRetry(retry);
      }
      if (status === 401 || status === 403) {
        const login = document.createElement("ion-button");
        login.setAttribute("color", "primary");
        login.textContent = "Ir para o login";
        login.addEventListener("click", () => {
          if (typeof App.logout === "function") {
            App.logout();
          } else {
            window.location.replace("/#/login/ifrn-login");
          }
        });
        actionsEl.appendChild(login);
      } else {
        const home = document.createElement("ion-button");
        home.setAttribute("fill", "clear");
        home.setAttribute("color", "primary");
        home.setAttribute("href", "#/painel");
        home.textContent = "Voltar ao painel";
        actionsEl.appendChild(home);
      }
    }
  }
  App.showLoading = showLoading;
  App.markLoadingStart = markLoadingStart;
  App.waitLoadingMinimum = waitLoadingMinimum;
  App.showNotFound = showNotFound;
  App.showStatusError = showStatusError;

  // src/MoodleIFRN/mobilemoodle/core_mobile/app-views.ts
  /*!
   * app-views.ts
   * ----------------------------------------------------------------------------
   * Monta o HTML das telas principais a partir dos <template>:
   *
   *   renderPainel(dashboard) → abas Diários / Autoinscrição + cards
   *   renderCurso(course, dashboard) → cabeçalho + seções expansíveis + atividades
   *
   * Também atualiza header (título/subtítulo) e dados do usuário na sidebar.
   */
  var ACTIVITY_ICONS = {
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
    attendance: "checkmark-done-outline"
  };
  var TAB_META = {
    diarios: {
      title: "Meus Di\xE1rios",
      empty: "\xC9 poss\xEDvel que a Secretaria Acad\xEAmica ainda n\xE3o tenha lhe inserido em di\xE1rio algum; neste caso, aguarde."
    },
    autoinscricoes: {
      title: "Cursos com Autoinscri\xE7\xE3o",
      empty: "N\xE3o h\xE1 cursos com autoinscri\xE7\xE3o dispon\xEDveis no momento. Ajuste os filtros ou volte mais tarde."
    }
  };
  function setUser(dashboard) {
    const nome = dashboard.nome || "Estudante";
    const letter = App.initials(nome);
    const foto = dashboard.foto_url || dashboard.foto || dashboard.avatar_url || "";
    App.sidebarUserName = nome;
    if (App.toolbarAvatar) {
      App.toolbarAvatar.textContent = letter;
      App.toolbarAvatar.setAttribute("aria-label", "Abrir perfil de " + nome);
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
  function getPainelLists(dashboard) {
    const diarios = dashboard.diarios || dashboard.courses || [];
    const autoinscricoes = dashboard.autoinscricoes || dashboard.self_enrolments || [];
    return {
      diarios: Array.isArray(diarios) ? diarios : [],
      autoinscricoes: Array.isArray(autoinscricoes) ? autoinscricoes : []
    };
  }
  function itemName(item) {
    return item.name || item.fullname || "Curso " + (item.id || "");
  }
  function itemEnv(item) {
    return item.moodle || item.environment || item.ambiente && item.ambiente.titulo || "AVA Acad\xEAmico";
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
    const favBtn = fragment.querySelector(".painel-card-details-info-favourite");
    const progressBlock = fragment.querySelector(".painel-card-details-progress");
    if (link) {
      link.href = "#/curso/" + encodeURIComponent(String(course.id));
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
    } else {
      if (bar) {
        bar.style.width = progress + "%";
      }
      if (label) {
        label.textContent = progress + "% conclu\xEDdo";
      }
    }
    if (env) {
      env.textContent = itemEnv(course);
    }
    if (favBtn && (course.isfavourite || course.favourite)) {
      favBtn.classList.remove("painel-card-details-info-favourite");
      favBtn.classList.add("painel-card-details-info-unfavourite");
      const icon = favBtn.querySelector("ion-icon");
      if (icon) {
        icon.setAttribute("name", "star");
      }
    }
    return fragment;
  }
  function buildAutoinscricaoCard(course) {
    const fragment = App.cloneTemplate("tpl-painel-card-autoinscricao");
    if (!fragment) {
      return document.createTextNode("");
    }
    const enrolled = Boolean(course.is_enrolled || course.enrolled);
    const link = fragment.querySelector(".painel-card-link");
    const cardTitle = fragment.querySelector(".painel-card-title");
    const shortname = fragment.querySelector(".painel-card-header-shortname");
    const env = fragment.querySelector(".painel-card-header-env");
    const enrolledBadge = fragment.querySelector(".painel-card-info-enrolled");
    const btnEnroll = fragment.querySelector(".btn-enroll");
    const btnAccess = fragment.querySelector(".btn-access");
    const btnUnenroll = fragment.querySelector(".btn-unenroll");
    const courseId = course.id;
    if (link) {
      link.href = course.details_url ? course.details_url : "#/curso/" + encodeURIComponent(String(courseId));
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
      btnEnroll.addEventListener("click", () => {
        window.alert(
          "A inscri\xE7\xE3o ser\xE1 confirmada quando a API de autoinscri\xE7\xE3o estiver dispon\xEDvel."
        );
      });
    }
    if (btnAccess) {
      btnAccess.hidden = !enrolled;
      btnAccess.setAttribute(
        "href",
        "#/curso/" + encodeURIComponent(String(courseId))
      );
    }
    if (btnUnenroll) {
      btnUnenroll.hidden = !enrolled;
      btnUnenroll.addEventListener("click", () => {
        window.alert(
          "O cancelamento de inscri\xE7\xE3o ser\xE1 liberado com a API de autoinscri\xE7\xE3o."
        );
      });
    }
    return fragment;
  }
  function renderEmpty(host, tabKey) {
    const empty = App.cloneTemplate("tpl-empty-cursos");
    if (!empty) {
      return;
    }
    const hint = empty.querySelector(".no-data__hint");
    const meta = TAB_META[tabKey] || TAB_META.diarios;
    if (hint) {
      hint.textContent = meta.empty;
    }
    host.appendChild(empty);
  }
  function renderTabCards(host, tabKey, lists) {
    const items = tabKey === "autoinscricoes" ? lists.autoinscricoes : lists.diarios;
    host.innerHTML = "";
    host.setAttribute("data-active-tab", tabKey);
    if (!items.length) {
      renderEmpty(host, tabKey);
      return;
    }
    const batch = document.createDocumentFragment();
    items.forEach((item) => {
      if (tabKey === "autoinscricoes") {
        batch.appendChild(buildAutoinscricaoCard(item));
      } else {
        batch.appendChild(buildCourseCard(item));
      }
    });
    host.appendChild(batch);
  }
  function updateIntro(tabKey) {
    const titleEl = document.getElementById("painel-intro-title");
    const meta = TAB_META[tabKey] || TAB_META.diarios;
    if (titleEl) {
      titleEl.textContent = meta.title;
    }
  }
  function setActiveTab(tabKey, lists) {
    const tabs = document.querySelectorAll("#painel-tabs .ava-tab");
    const cardsHost = document.getElementById("painel-cards");
    tabs.forEach((tab) => {
      const active = tab.getAttribute("data-tab") === tabKey;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    updateIntro(tabKey);
    if (cardsHost) {
      renderTabCards(cardsHost, tabKey, lists);
    }
    App.activePainelTab = tabKey;
  }
  function bindTabs(lists) {
    const tabsHost = document.getElementById("painel-tabs");
    if (!tabsHost || tabsHost.dataset.bound === "1") {
      return;
    }
    tabsHost.dataset.bound = "1";
    tabsHost.addEventListener("click", (event) => {
      const target = event.target;
      const tab = target?.closest(".ava-tab");
      if (!tab || tab.disabled) {
        return;
      }
      const key = tab.getAttribute("data-tab");
      if (!key || key === App.activePainelTab) {
        return;
      }
      setActiveTab(key, lists);
    });
  }
  function renderPainel(dashboard) {
    if (App.title) {
      App.title.textContent = "Painel AVA";
    }
    if (App.subtitle) {
      App.subtitle.textContent = "IFRN";
      App.subtitle.hidden = false;
    }
    setUser(dashboard);
    const lists = getPainelLists(dashboard);
    const page = App.cloneTemplate("tpl-painel");
    const initialTab = App.activePainelTab === "autoinscricoes" ? "autoinscricoes" : "diarios";
    App.dashboardPapel = dashboard.papel || dashboard.role || "estudante";
    if (!page || !App.content) {
      return;
    }
    App.content.innerHTML = "";
    App.content.appendChild(page);
    bindTabs(lists);
    setActiveTab(initialTab, lists);
    const refresher = document.getElementById("painel-refresher");
    if (refresher) {
      refresher.addEventListener("ionRefresh", (event) => {
        App.loadRoute?.(true).finally(() => {
          const target = event.target;
          target.complete?.();
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
      forum: "F\xF3rum",
      quiz: "Question\xE1rio",
      resource: "Arquivo",
      url: "URL",
      page: "P\xE1gina",
      folder: "Pasta",
      book: "Livro",
      label: "R\xF3tulo",
      lesson: "Li\xE7\xE3o",
      scorm: "SCORM",
      h5pactivity: "H5P",
      workshop: "Workshop",
      choice: "Escolha",
      feedback: "Pesquisa",
      glossary: "Gloss\xE1rio",
      wiki: "Wiki",
      data: "Banco de dados",
      chat: "Chat",
      bigbluebuttonbn: "BigBlueButton",
      attendance: "Frequ\xEAncia"
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
    if (name) {
      name.textContent = activity.name || activity.title || "Atividade";
    }
    if (mod) {
      mod.textContent = activityLabel(modname);
    }
    if (status && typeof activity.completion === "boolean") {
      status.hidden = false;
      status.textContent = activity.completion ? "Conclu\xEDda" : "Pendente";
      status.classList.toggle("activity-item__status--pending", !activity.completion);
    }
    return fragment;
  }
  function bindSectionToggle(article) {
    if (!article) {
      return;
    }
    const header = article.querySelector(".topic-card__header");
    if (!header) {
      return;
    }
    header.addEventListener("click", () => {
      const open = article.classList.toggle("is-open");
      header.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  function renderCurso(course, dashboard) {
    if (App.title) {
      App.title.textContent = course.name || "Curso";
    }
    if (App.subtitle) {
      App.subtitle.textContent = "Painel AVA";
      App.subtitle.hidden = false;
    }
    setUser(dashboard);
    const progress = Math.max(0, Math.min(100, Number(course.progress || 0)));
    const page = App.cloneTemplate("tpl-curso");
    if (!page || !App.content) {
      return;
    }
    App.content.innerHTML = "";
    App.content.appendChild(page);
    const breadcrumb = document.getElementById("curso-breadcrumb-name");
    const title = document.getElementById("curso-title");
    const teacher = document.getElementById("curso-teacher");
    const workload = document.getElementById("curso-workload");
    const progressText = document.getElementById("curso-progress-text");
    const progressLabel = document.getElementById("curso-progress-label");
    if (breadcrumb) {
      breadcrumb.textContent = course.name || "";
    }
    if (title) {
      title.textContent = course.name || "";
    }
    if (teacher) {
      teacher.textContent = course.teacher || "\u2014";
    }
    if (workload) {
      workload.textContent = course.workload || "\u2014";
    }
    if (progressText) {
      progressText.textContent = progress + "%";
    }
    if (progressLabel) {
      progressLabel.textContent = progress + "% conclu\xEDdo";
    }
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
    if (!sectionsHost) {
      return;
    }
    if (!sections.length) {
      sectionsHost.innerHTML = '<div class="empty-state"><p>Nenhuma se\xE7\xE3o dispon\xEDvel.</p></div>';
      return;
    }
    const batch = document.createDocumentFragment();
    sections.forEach((section, index) => {
      const item = App.cloneTemplate("tpl-curso-section");
      if (!item) {
        return;
      }
      const activities = section.activities || section.modules || section.cms || [];
      const countEl = item.querySelector(".topic-card__count");
      const list = item.querySelector(".activity-list");
      const article = item.querySelector(".topic-card");
      const topicIndex = item.querySelector(".topic-index");
      const topicName = item.querySelector(".topic-name");
      const header = item.querySelector(".topic-card__header");
      if (topicIndex) {
        topicIndex.textContent = String(index + 1);
      }
      if (topicName) {
        topicName.textContent = section.name || "T\xF3pico " + (index + 1);
      }
      const count = activities.length;
      if (countEl) {
        countEl.textContent = count === 1 ? "1 atividade" : count > 0 ? count + " atividades" : "T\xF3pico da sala virtual";
      }
      if (list) {
        if (!count) {
          const empty = document.createElement("p");
          empty.className = "activity-empty";
          empty.textContent = "Nenhuma atividade nesta se\xE7\xE3o.";
          list.appendChild(empty);
        } else {
          activities.forEach((activity) => {
            list.appendChild(buildActivity(activity));
          });
        }
      }
      if (index === 0 && article && header) {
        article.classList.add("is-open");
        header.setAttribute("aria-expanded", "true");
      }
      bindSectionToggle(article);
      batch.appendChild(item);
    });
    sectionsHost.appendChild(batch);
  }
  App.setUser = setUser;
  App.renderPainel = renderPainel;
  App.renderCurso = renderCurso;

  // src/MoodleIFRN/mobilemoodle/core_mobile/app-router.ts
  /*!
   * app-router.ts
   * ----------------------------------------------------------------------------
   * Roteamento por hash (SPA leve, sem Angular Router).
   *
   * Rotas:
   *   #/painel          → lista de diários / autoinscrição
   *   #/curso/123       → detalhe do curso
   *   qualquer outra    → not found
   *
   * loadRoute():
   *   1. Garante templates HTML carregados
   *   2. Checa token
   *   3. Mostra splash → busca API → renderPainel / renderCurso
   *
   * routeSeq evita race: se o usuário mudar o hash no meio do await,
   * a resposta antiga é ignorada.
   */
  var templatesReady = null;
  var routeSeq = 0;
  function parseRoute() {
    const hash = window.location.hash.replace(/^#/, "") || "/painel";
    const courseMatch = hash.match(/^\/curso\/(\d{1,10})$/);
    if (courseMatch) {
      return { name: "curso", courseId: Number(courseMatch[1]) };
    }
    if (hash === "/painel" || hash === "/" || hash === "") {
      return { name: "painel" };
    }
    return { name: "notfound" };
  }
  async function loadTemplates() {
    if (templatesReady) {
      return templatesReady;
    }
    if (document.getElementById("tpl-painel") && document.getElementById("tpl-curso") && document.getElementById("tpl-error-page")) {
      templatesReady = Promise.resolve();
      return templatesReady;
    }
    const assetBase = App.ASSET_BASE || "";
    const base = assetBase.indexOf("static/theme/ifrn/") !== -1 ? assetBase.replace(/static\/theme\/ifrn\/$/, "") : assetBase;
    templatesReady = Promise.all([
      App.fetchText(base + "pages/painel.html"),
      App.fetchText(base + "pages/curso.html"),
      App.fetchText(base + "pages/erros.html")
    ]).then((parts) => {
      if (App.templatesRoot) {
        App.templatesRoot.innerHTML = parts.join("\n");
      }
    }).catch((error) => {
      templatesReady = null;
      throw error;
    });
    return templatesReady;
  }
  async function loadDashboard(force) {
    if (!force && App.dashboardCache) {
      return App.dashboardCache;
    }
    App.dashboardCache = await window.MobileMoodleApi.getDashboard(force);
    return App.dashboardCache;
  }
  async function loadRoute(force) {
    const seq = ++routeSeq;
    const route = parseRoute();
    try {
      await loadTemplates();
      if (seq !== routeSeq) {
        return;
      }
      if (route.name === "notfound") {
        App.showNotFound?.();
        return;
      }
      if (!window.MobileMoodleApi.getToken()) {
        App.showStatusError?.({
          status: 401,
          title: "Acesso n\xE3o autorizado",
          message: "Token de acesso n\xE3o encontrado. Fa\xE7a login no aplicativo.",
          retryable: false
        });
        return;
      }
      App.showLoading?.(route.name === "curso" ? "Carregando curso..." : "Carregando painel...");
      if (route.name === "curso") {
        const [dashboard2, course] = await Promise.all([
          loadDashboard(force),
          window.MobileMoodleApi.getCourse(route.courseId, force),
          App.waitLoadingMinimum?.(force) ?? Promise.resolve()
        ]);
        if (seq !== routeSeq) {
          return;
        }
        App.renderCurso?.(course, dashboard2);
        return;
      }
      if (force) {
        App.dashboardCache = null;
        window.MobileMoodleApi.invalidateCache();
      }
      const [dashboard] = await Promise.all([
        loadDashboard(force),
        App.waitLoadingMinimum?.(force) ?? Promise.resolve()
      ]);
      if (seq !== routeSeq) {
        return;
      }
      App.renderPainel?.(dashboard);
    } catch (error) {
      if (seq !== routeSeq) {
        return;
      }
      App.showStatusError?.(error);
    }
  }
  App.parseRoute = parseRoute;
  App.loadRoute = loadRoute;

  // src/MoodleIFRN/mobilemoodle/core_mobile/app-accessibility.ts
  /*!
   * app-accessibility.ts
   * ----------------------------------------------------------------------------
   * Preferências de acessibilidade espelhando o Painel AVA / theme_ifrn25.
   *
   * Estado em localStorage (chave ifrn_a11y_prefs).
   * applyToBody() aplica classes CSS no <body> (ex.: color_mode_high_contrast).
   * VLibras é carregado sob demanda quando vlibras_active = true.
   */
  var STORAGE_KEY = "ifrn_a11y_prefs";
  var BOOL_KEYS = [
    "dyslexia_friendly",
    "highlight_links",
    "stop_animations",
    "hidden_illustrative_image",
    "big_cursor",
    "vlibras_active",
    "high_line_height"
  ];
  var ZOOM_OPTIONS = [100, 120, 130, 150, 160];
  var COLOR_MODE_OPTIONS = ["default", "high_contrast", "low_contrast", "colorblind", "grayscale"];
  var COLOR_MODE_LABELS = {
    default: "Padr\xE3o",
    high_contrast: "Alto contraste",
    low_contrast: "Contraste reduzido",
    colorblind: "Amig\xE1vel a dalt\xF4nicos",
    grayscale: "Escala de cinza"
  };
  var state = {
    dyslexia_friendly: false,
    remove_justify: false,
    highlight_links: false,
    stop_animations: false,
    hidden_illustrative_image: false,
    big_cursor: false,
    vlibras_active: false,
    high_line_height: false,
    zoom_level: 100,
    color_mode: "default"
  };
  var vlibrasReady = false;
  function getEl(id) {
    return document.getElementById(id);
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const saved = JSON.parse(raw);
      BOOL_KEYS.forEach((key) => {
        if (typeof saved[key] === "boolean") {
          state[key] = saved[key];
        }
      });
      if (ZOOM_OPTIONS.indexOf(Number(saved.zoom_level)) !== -1) {
        state.zoom_level = Number(saved.zoom_level);
      }
      if (saved.color_mode && COLOR_MODE_OPTIONS.indexOf(saved.color_mode) !== -1) {
        state.color_mode = saved.color_mode;
      }
    } catch {
    }
  }
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
    }
  }
  function ensureVlibras() {
    if (vlibrasReady || !state.vlibras_active) {
      return;
    }
    if (!document.querySelector("div[vw]")) {
      const root = document.createElement("div");
      root.setAttribute("vw", "");
      root.className = "enabled";
      root.innerHTML = '<div vw-access-button class="active"></div><div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div>';
      document.body.appendChild(root);
    }
    if (window.VLibras?.Widget) {
      try {
        new window.VLibras.Widget("https://vlibras.gov.br/app");
        vlibrasReady = true;
      } catch {
        vlibrasReady = true;
      }
      return;
    }
    if (document.getElementById("vlibras-script")) {
      return;
    }
    const script = document.createElement("script");
    script.id = "vlibras-script";
    script.src = "https://vlibras.gov.br/app/vlibras-plugin.js";
    script.onload = () => {
      try {
        new window.VLibras.Widget("https://vlibras.gov.br/app");
        vlibrasReady = true;
      } catch {
        vlibrasReady = true;
      }
    };
    document.body.appendChild(script);
  }
  function applyToBody() {
    const body = document.body;
    BOOL_KEYS.forEach((key) => {
      body.classList.toggle(key, !!state[key]);
    });
    body.classList.remove("remove_justify");
    COLOR_MODE_OPTIONS.forEach((mode) => {
      body.classList.remove("color_mode_" + mode);
    });
    if (state.color_mode && state.color_mode !== "default") {
      body.classList.add("color_mode_" + state.color_mode);
    } else {
      body.classList.add("color_mode_default");
    }
    if (state.zoom_level && state.zoom_level !== 100) {
      body.setAttribute("data-zoom", String(state.zoom_level));
    } else {
      body.removeAttribute("data-zoom");
    }
    if (state.vlibras_active) {
      ensureVlibras();
    }
  }
  function setBool(key, value) {
    if (BOOL_KEYS.indexOf(key) === -1) {
      return;
    }
    state[key] = !!value;
    saveState();
    applyToBody();
  }
  function cycleZoom() {
    const idx = ZOOM_OPTIONS.indexOf(state.zoom_level);
    const next = ZOOM_OPTIONS[(idx + 1) % ZOOM_OPTIONS.length];
    state.zoom_level = next;
    saveState();
    applyToBody();
    syncPanelControls();
  }
  function cycleColorMode() {
    const idx = COLOR_MODE_OPTIONS.indexOf(state.color_mode);
    const next = COLOR_MODE_OPTIONS[(idx + 1) % COLOR_MODE_OPTIONS.length];
    state.color_mode = next;
    saveState();
    applyToBody();
    syncPanelControls();
  }
  function renderIndicators(container, mode) {
    if (!container) {
      return;
    }
    container.innerHTML = "";
    if (mode === "zoom") {
      ZOOM_OPTIONS.filter((level) => level > 100).forEach((level) => {
        const span = document.createElement("span");
        span.className = "cycle-indicator" + (level <= state.zoom_level ? " active" : "");
        container.appendChild(span);
      });
      return;
    }
    COLOR_MODE_OPTIONS.filter((m) => m !== "default").forEach((m) => {
      const span = document.createElement("span");
      span.className = "cycle-indicator" + (m === state.color_mode ? " active" : "");
      container.appendChild(span);
    });
  }
  function syncPanelControls() {
    BOOL_KEYS.forEach((key) => {
      const el = document.getElementById(key);
      if (el && el.type === "checkbox") {
        el.checked = !!state[key];
      }
    });
    const zoomWrap = getEl("selector-cycle-access");
    const zoomValue = getEl("zoom-value");
    const zoomIndicators = getEl("cycle-indicators");
    const colorWrap = getEl("selector-cycle-color");
    const colorLabel = getEl("color-mode-label");
    const colorIndicators = getEl("color-indicators");
    if (zoomWrap) {
      zoomWrap.classList.toggle("active", state.zoom_level > 100);
    }
    if (zoomValue) {
      zoomValue.textContent = state.zoom_level + "%";
    }
    renderIndicators(zoomIndicators, "zoom");
    if (colorWrap) {
      colorWrap.classList.toggle("active", state.color_mode !== "default");
    }
    if (colorLabel) {
      colorLabel.textContent = COLOR_MODE_LABELS[state.color_mode] || "Padr\xE3o";
    }
    renderIndicators(colorIndicators, "color");
  }
  function bindPanelControls() {
    BOOL_KEYS.forEach((key) => {
      const el = document.getElementById(key);
      if (!el) {
        return;
      }
      el.checked = !!state[key];
      el.addEventListener("change", () => {
        setBool(key, el.checked);
      });
    });
    const zoomBtn = getEl("cycle-toggle");
    const colorBtn = getEl("color-mode-toggle");
    if (zoomBtn) {
      zoomBtn.addEventListener("click", (event) => {
        event.preventDefault();
        cycleZoom();
      });
    }
    if (colorBtn) {
      colorBtn.addEventListener("click", (event) => {
        event.preventDefault();
        cycleColorMode();
      });
    }
    syncPanelControls();
  }
  function init() {
    loadState();
    applyToBody();
  }
  App.A11y = {
    init,
    bindPanel: bindPanelControls,
    syncPanel: syncPanelControls,
    getState: () => Object.assign({}, state),
    COLOR_MODE_LABELS
  };

  // src/MoodleIFRN/mobilemoodle/core_mobile/app-sidebar.ts
  /*!
   * app-sidebar.ts
   * ----------------------------------------------------------------------------
   * Menu lateral estilo AVA + modais (perfil, ajuda, acessibilidade, filtros).
   *
   * openModal(type) clona o template correspondente (tpl-modal-*) e preenche
   * o painel #sidebar-modal. bindSidebar() liga os botões uma vez no boot.
   */
  var FILTER_LABELS = {
    inprogress: "Em andamento",
    allincludinghidden: "Todos os di\xE1rios (lento)",
    favourites: "Favoritos",
    hidden: "Ocultos"
  };
  var MODAL_META = {
    profile: { title: "Perfil", icon: "person-circle-outline", tpl: "tpl-modal-profile" },
    help: { title: "Ajuda", icon: "help-circle-outline", tpl: "tpl-modal-help" },
    accessibility: { title: "Acessibilidade", icon: "accessibility-outline", tpl: "tpl-modal-accessibility" },
    filter: { title: "Filtros", icon: "filter-outline", tpl: "tpl-modal-filter" }
  };
  var BUTTON_IDS = {
    profile: "btn-toggle-profile",
    help: "btn-toggle-help",
    accessibility: "btn-toggle-accessibility",
    filter: "btn-toggle-filter"
  };
  App.activeFilter = {
    situacao: "allincludinghidden",
    label: FILTER_LABELS.allincludinghidden
  };
  function getEl2(id) {
    return document.getElementById(id);
  }
  function setActiveButton(type) {
    document.querySelectorAll(".sidebar-modal-button, .sidebar-user-content-profile").forEach((el) => {
      el.classList.remove("active");
    });
    const btn = getEl2(BUTTON_IDS[type]);
    if (btn) {
      btn.classList.add("active");
    }
  }
  function clearActiveButtons() {
    document.querySelectorAll(".sidebar-modal-button, .sidebar-user-content-profile").forEach((el) => {
      el.classList.remove("active");
    });
  }
  function closeModal() {
    const modal = getEl2("sidebar-modal");
    if (modal) {
      modal.hidden = true;
    }
    clearActiveButtons();
  }
  function bindAccessibilityControls() {
    if (App.A11y?.bindPanel) {
      App.A11y.bindPanel();
    }
  }
  function updateFilterChip() {
    const chip = getEl2("sidebar-filter-situacao");
    if (chip && App.activeFilter) {
      chip.textContent = App.activeFilter.label;
    }
  }
  function bindFilterControls() {
    const select = getEl2("filter-situacao");
    const apply = getEl2("filter-apply");
    const clear = getEl2("filter-clear");
    const activeFilter = App.activeFilter;
    if (select && activeFilter) {
      select.value = String(activeFilter.situacao);
    }
    if (apply) {
      apply.addEventListener("click", () => {
        const value = select ? select.value : "allincludinghidden";
        App.activeFilter = {
          situacao: value,
          label: FILTER_LABELS[value] || FILTER_LABELS.allincludinghidden
        };
        updateFilterChip();
        closeModal();
        if (typeof App.onFilterChange === "function" && App.activeFilter) {
          App.onFilterChange(App.activeFilter);
        }
      });
    }
    if (clear) {
      clear.addEventListener("click", () => {
        App.activeFilter = {
          situacao: "allincludinghidden",
          label: FILTER_LABELS.allincludinghidden
        };
        updateFilterChip();
        if (select) {
          select.value = "allincludinghidden";
        }
      });
    }
  }
  function openModal(type) {
    const meta = MODAL_META[type];
    const modal = getEl2("sidebar-modal");
    const body = getEl2("sidebar-modal-body");
    const title = getEl2("sidebar-modal-title");
    const icon = getEl2("sidebar-modal-icon");
    if (!meta || !modal || !body) {
      return;
    }
    const fragment = App.cloneTemplate?.(meta.tpl);
    if (!fragment) {
      return;
    }
    if (title) {
      title.textContent = meta.title;
    }
    if (icon) {
      icon.setAttribute("name", meta.icon);
    }
    body.innerHTML = "";
    body.appendChild(fragment);
    setActiveButton(type);
    modal.hidden = false;
    if (type === "profile") {
      const nameEl = getEl2("modal-profile-name");
      if (nameEl) {
        nameEl.textContent = App.sidebarUserName || "Estudante";
      }
      const logoutBtn = getEl2("modal-logout");
      if (logoutBtn && typeof App.logout === "function") {
        logoutBtn.addEventListener("click", () => {
          closeModal();
          App.logout();
        });
      }
    }
    if (type === "accessibility") {
      bindAccessibilityControls();
    }
    if (type === "filter") {
      bindFilterControls();
    }
  }
  function applyUserFilter(dashboard) {
    const situacao = dashboard && (dashboard.filtro_situacao || dashboard.situacao || dashboard.filter_situacao) || "allincludinghidden";
    const label = dashboard && (dashboard.filtro_label || dashboard.situacao_label) || FILTER_LABELS[situacao] || FILTER_LABELS.allincludinghidden;
    App.activeFilter = { situacao, label };
    updateFilterChip();
  }
  function bindSidebar() {
    [
      ["btn-toggle-profile", "profile"],
      ["btn-toggle-help", "help"],
      ["btn-toggle-accessibility", "accessibility"],
      ["btn-toggle-filter", "filter"],
      ["btn-open-filter-label", "filter"],
      ["sidebar-active-filters", "filter"],
      ["toolbar-avatar", "profile"]
    ].forEach((pair) => {
      const el = getEl2(pair[0]);
      if (!el) {
        return;
      }
      el.addEventListener("click", () => {
        openModal(pair[1]);
      });
    });
    const closeBtn = getEl2("sidebar-modal-close");
    const backdrop = getEl2("sidebar-modal-backdrop");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeModal);
    }
    if (backdrop) {
      backdrop.addEventListener("click", closeModal);
    }
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeModal();
      }
    });
  }
  App.closeSidebarModal = closeModal;
  App.openSidebarModal = openModal;
  App.applyUserFilter = applyUserFilter;
  App.updateFilterChip = updateFilterChip;
  App.bindSidebar = bindSidebar;
  App.FILTER_LABELS = FILTER_LABELS;

  // src/MoodleIFRN/mobilemoodle/core_mobile/app-keyboard.ts
  /*!
   * app-keyboard.ts
   * ----------------------------------------------------------------------------
   * Dois papéis:
   *   1) Safe-area (status bar / notch) → CSS vars --ion-safe-area-*
   *   2) Altura do teclado virtual → --keyboard-height + classe .keyboard-is-open
   *
   * Android nativo (Cordova):
   *   - Preferência: cordova-plugin-insets (window.totalpave.Inset), igual ao core Moodle
   *   - Fallback: ~24px só se Cordova existir e o inset vier 0
   *
   * Browser / DevTools (“console mobile”):
   *   - NÃO força padding no topo (não há status bar sobrepondo o WebView)
   */
  var KEYBOARD_THRESHOLD = 80;
  var ANDROID_STATUS_BAR_FALLBACK_PX = 24;
  var INSET_MASK_SYSTEM_AND_CUTOUT = 64 | 2;
  function isAndroidWebView() {
    return /Android/i.test(navigator.userAgent);
  }
  function isCordovaRuntime() {
    return !!window.cordova;
  }
  function getCordovaInsetApi() {
    const api = window.totalpave?.Inset;
    if (api && typeof api.create === "function") {
      return api;
    }
    return null;
  }
  function waitForCordova(timeoutMs = 1500) {
    return new Promise((resolve) => {
      if (!isCordovaRuntime()) {
        resolve();
        return;
      }
      let settled = false;
      const done = () => {
        if (settled) {
          return;
        }
        settled = true;
        resolve();
      };
      document.addEventListener("deviceready", done, { once: true });
      window.setTimeout(done, timeoutMs);
    });
  }
  function readCssEnvInsets() {
    const probe = document.createElement("div");
    probe.style.cssText = [
      "position:fixed",
      "top:0",
      "left:0",
      "padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)",
      "visibility:hidden",
      "pointer-events:none"
    ].join(";");
    document.documentElement.appendChild(probe);
    const style = getComputedStyle(probe);
    const insets = {
      top: parseFloat(style.paddingTop) || 0,
      right: parseFloat(style.paddingRight) || 0,
      bottom: parseFloat(style.paddingBottom) || 0,
      left: parseFloat(style.paddingLeft) || 0
    };
    probe.remove();
    return insets;
  }
  function setSafeAreaVars(insets) {
    const root = document.documentElement.style;
    root.setProperty("--ion-safe-area-top", `${Math.max(0, Math.round(insets.top))}px`);
    root.setProperty("--ion-safe-area-right", `${Math.max(0, Math.round(insets.right))}px`);
    root.setProperty("--ion-safe-area-bottom", `${Math.max(0, Math.round(insets.bottom))}px`);
    root.setProperty("--ion-safe-area-left", `${Math.max(0, Math.round(insets.left))}px`);
  }
  function resolveFallbackInsets() {
    if (!isCordovaRuntime()) {
      return { top: 0, right: 0, bottom: 0, left: 0 };
    }
    const insets = readCssEnvInsets();
    if (insets.top <= 0 && isAndroidWebView()) {
      insets.top = ANDROID_STATUS_BAR_FALLBACK_PX;
    }
    return insets;
  }
  function applySafeAreaVariables() {
    setSafeAreaVars(resolveFallbackInsets());
  }
  async function initNativeSafeAreaInsets() {
    await waitForCordova();
    const Inset = getCordovaInsetApi();
    if (!Inset) {
      return false;
    }
    try {
      const listener = await Inset.create({
        mask: INSET_MASK_SYSTEM_AND_CUTOUT,
        includeRoundedCorners: false
      });
      const apply = () => {
        setSafeAreaVars(listener.getInset());
      };
      listener.addListener(apply);
      apply();
      return true;
    } catch {
      return false;
    }
  }
  function syncKeyboardHeight() {
    const viewport = window.visualViewport;
    let keyboardHeight = 0;
    if (viewport) {
      keyboardHeight = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
    }
    const isOpen = keyboardHeight >= KEYBOARD_THRESHOLD;
    const appliedHeight = isOpen ? keyboardHeight : 0;
    document.documentElement.style.setProperty("--keyboard-height", `${appliedHeight}px`);
    document.body.classList.toggle("keyboard-is-open", isOpen);
    if (isOpen) {
      document.documentElement.style.setProperty("--ion-safe-area-bottom", "0px");
    } else if (!getCordovaInsetApi()) {
      applySafeAreaVariables();
    }
  }
  function scrollFocusedFieldIntoView() {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) {
      return;
    }
    if (!active.matches("input, textarea, select")) {
      return;
    }
    window.setTimeout(() => {
      active.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 320);
  }
  function initKeyboardInsets() {
    setSafeAreaVars({ top: 0, right: 0, bottom: 0, left: 0 });
    applySafeAreaVariables();
    void initNativeSafeAreaInsets().then((nativeOk) => {
      if (!nativeOk) {
        applySafeAreaVariables();
      }
    });
    syncKeyboardHeight();
    window.visualViewport?.addEventListener("resize", syncKeyboardHeight);
    window.visualViewport?.addEventListener("scroll", syncKeyboardHeight);
    window.addEventListener("resize", () => {
      if (!getCordovaInsetApi()) {
        applySafeAreaVariables();
      }
      syncKeyboardHeight();
    });
    window.addEventListener("orientationchange", () => {
      window.setTimeout(() => {
        if (!getCordovaInsetApi()) {
          applySafeAreaVariables();
        }
        syncKeyboardHeight();
      }, 250);
    });
    document.addEventListener("focusin", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.matches("input, textarea, select")) {
        return;
      }
      window.setTimeout(syncKeyboardHeight, 280);
      scrollFocusedFieldIntoView();
    });
    document.addEventListener("focusout", () => {
      window.setTimeout(syncKeyboardHeight, 280);
    });
  }

  // src/MoodleIFRN/mobilemoodle/core_mobile/app.ts
  /*!
   * app.ts
   * ----------------------------------------------------------------------------
   * Bootstrap do painel (roda por último na ordem de imports).
   *
   * No DOMContentLoaded:
   *   1. Safe-area / teclado (app-keyboard)
   *   2. Base URL da API
   *   3. Preferências de acessibilidade
   *   4. Sidebar
   *   5. loadRoute() conforme o hash (#/painel, #/curso/…)
   *
   * hashchange → navega sem recarregar a página.
   */
  App.content = document.getElementById("page-content");
  App.title = document.getElementById("page-title");
  App.subtitle = document.getElementById("page-subtitle");
  App.menuUserInfo = document.getElementById("sidebar-user-name");
  App.toolbarAvatar = document.getElementById("toolbar-avatar");
  App.templatesRoot = document.getElementById("page-templates");
  App.dashboardCache = null;
  function logout() {
    if (window.MobileMoodleApi?.clearToken) {
      window.MobileMoodleApi.clearToken();
    }
    App.dashboardCache = null;
    const loginUrl = typeof App.resolveLoginUrl === "function" ? App.resolveLoginUrl() : "/#/login/ifrn-login";
    window.location.replace(loginUrl);
  }
  App.logout = logout;
  function bindMenu() {
    if (typeof App.bindSidebar === "function") {
      App.bindSidebar();
    }
  }
  function resolveApiBase() {
    return "https://suap.ifrn.edu.br";
  }
  window.addEventListener("hashchange", () => {
    App.loadRoute?.(false);
  });
  window.addEventListener("DOMContentLoaded", () => {
    initKeyboardInsets();
    if (window.MobileMoodleApi?.setApiBaseUrl) {
      window.MobileMoodleApi.setApiBaseUrl(resolveApiBase());
    }
    if (App.A11y?.init) {
      App.A11y.init();
    }
    bindMenu();
    if (document.querySelector("#page-content .page-loading")) {
      App.markLoadingStart?.();
    }
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash || hash === "/") {
      window.location.hash = "/painel";
      return;
    }
    App.loadRoute?.(false);
  });

  // src/MoodleIFRN/mobilemoodle/mobilemoodle.ts
  /*!
   * Ponto de entrada do painel mobilemoodle.
   * Ordem de inicialização dos módulos (namespace window.MobileMoodle).
   */
})();
