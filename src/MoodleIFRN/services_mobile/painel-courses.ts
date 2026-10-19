// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * Script autônomo executado no InAppBrowser. Mantido como texto para que a
 * compilação Angular não introduza helpers externos de async/await.
 */
export const PAINEL_COURSES_SCRIPT = `(async function fetchPainelCourses(endpoint) {
  const categories = ["diarios", "coordenacoes", "praticas", "autoinscricoes", "reutilizaveis"];
  const result = {};
  const seen = /* @__PURE__ */ new Map();
  const request = async (path) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15e3);
    try {
      const response = await fetch(path, {
        headers: { accept: "application/json" },
        credentials: "same-origin",
        signal: controller.signal
      });
      if (!response.ok || !(response.headers.get("content-type") || "").includes("application/json")) {
        throw new Error(\`Falha ao carregar os cursos (HTTP \${response.status}).\`);
      }
      const data = await response.json();
      if (!data || typeof data !== "object" || Array.isArray(data) || !categories.some((key) => Array.isArray(data[key]))) {
        throw new Error("Resposta de cursos inv\xE1lida.");
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  };
  for (let page = 1; ; page++) {
    const url = new URL(endpoint, location.origin);
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", "100");
    const data = await request(url.pathname + url.search);
    if (page === 1) {
      Object.assign(result, data);
    }
    let added = 0;
    for (const category of categories) {
      if (!seen.has(category)) {
        seen.set(category, /* @__PURE__ */ new Set());
        result[category] = [];
      }
      const categorySeen = seen.get(category);
      for (const course of Array.isArray(data[category]) ? data[category] : []) {
        const key = JSON.stringify([course.ambiente?.id, course.id]);
        if (categorySeen.has(key)) {
          continue;
        }
        categorySeen.add(key);
        result[category].push(course);
        added++;
      }
    }
    if (!added) {
      break;
    }
    if (page >= 200) {
      throw new Error("H\xE1 cursos demais para carregar. Refine os filtros no Painel AVA.");
    }
  }
  try {
    const response = await fetch("/api/v1/progresso/", {
      headers: { accept: "application/json" },
      credentials: "same-origin",
      signal: AbortSignal.timeout(1e4)
    });
    if (response.ok) {
      const data = await response.json();
      const progress = /* @__PURE__ */ new Map();
      for (const item of Array.isArray(data.progresso) ? data.progresso : []) {
        progress.set(JSON.stringify([item.ambiente_id, item.id]), item);
      }
      for (const category of categories) {
        for (const course of result[category]) {
          const item = progress.get(JSON.stringify([course.ambiente?.id, course.id]));
          if (item) {
            course.progress = item.progress;
            course.hasprogress = item.hasprogress;
          }
        }
      }
    }
  } catch {
  }
  return result;
})`;
