(function () {
  "use strict";

  var source = document.getElementById("inventory-data");
  if (!source) return;
  var files = JSON.parse(source.textContent).files;
  var query = document.getElementById("inventory-query");
  var role = document.getElementById("inventory-role");
  var usage = document.getElementById("inventory-usage");
  var origin = document.getElementById("inventory-source");
  var duplicates = document.getElementById("inventory-duplicates");
  var rows = document.getElementById("inventory-rows");
  var previous = document.getElementById("inventory-prev");
  var next = document.getElementById("inventory-next");
  var status = document.getElementById("inventory-status");
  var pageLabel = document.getElementById("inventory-page");
  var page = 0;
  var pageSize = 50;
  var searchable = files.map(function (file) {
    return [file.path, file.purpose, file.classification, file.recommendation, file.risk,
      file.dependencies.join(" "), file.externalDependencies.join(" "), file.references.map(function (ref) { return ref.source; }).join(" ")]
      .join(" ").toLocaleLowerCase("pt-BR");
  });

  function element(tag, text) {
    var node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function paragraph(parent, text) {
    parent.appendChild(element("p", text));
  }

  function render() {
    var term = query.value.trim().toLocaleLowerCase("pt-BR");
    var filtered = files.filter(function (file, index) {
      return (!term || searchable[index].indexOf(term) !== -1)
        && (!role.value || file.role === role.value)
        && (!usage.value || file.usage === usage.value)
        && (!origin.value || file.source === origin.value)
        && (!duplicates.checked || file.duplicateGroup !== null);
    });
    var pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.min(page, pages - 1);
    var fragment = document.createDocumentFragment();
    filtered.slice(page * pageSize, (page + 1) * pageSize).forEach(function (file) {
      var row = element("tr");
      var name = element("td");
      name.appendChild(element("code", file.path.replace(/^src\/MoodleIFRN\//, "")));
      paragraph(name, file.extension + " · " + (file.bytes === null ? "relatório gerado" : file.bytes + " bytes"));
      paragraph(name, file.source + (file.localVariant ? " · variante local diferente" : ""));
      if (file.generated) paragraph(name, "Gerado/copiado");
      if (file.duplicateGroup) paragraph(name, "Duplicado exato: grupo " + file.duplicateGroup);
      var purpose = element("td");
      paragraph(purpose, file.role + " · " + file.classification);
      paragraph(purpose, file.purpose);
      var dependencies = element("td");
      paragraph(dependencies, file.usage);
      var details = element("details");
      details.appendChild(element("summary", file.references.length + " referência(s); " + file.dependencies.length + " dependência(s) interna(s)"));
      details.appendChild(element("pre", file.references.map(function (ref) {
        return ref.source + ":" + ref.line + " (" + ref.kind + ")";
      }).join("\n") || "Nenhuma referência coletada; não comprova ausência de uso."));
      if (file.dependencies.length) details.appendChild(element("pre", "Depende de:\n" + file.dependencies.join("\n")));
      if (file.externalDependencies.length) details.appendChild(element("pre", "Módulos externos:\n" + file.externalDependencies.join("\n")));
      if (file.hash) details.appendChild(element("pre", "SHA-256: " + file.hash));
      dependencies.appendChild(details);
      var recommendation = element("td");
      paragraph(recommendation, file.recommendation);
      paragraph(recommendation, "Risco de remoção: " + file.risk);
      [name, purpose, dependencies, recommendation].forEach(function (cell) { row.appendChild(cell); });
      fragment.appendChild(row);
    });
    rows.replaceChildren(fragment);
    status.textContent = filtered.length + " de " + files.length + " arquivos encontrados.";
    pageLabel.textContent = "Página " + (page + 1) + " de " + pages;
    previous.disabled = page === 0;
    next.disabled = page + 1 >= pages;
  }

  [query, role, usage, origin, duplicates].forEach(function (control) {
    control.addEventListener(control === query ? "input" : "change", function () { page = 0; render(); });
  });
  previous.addEventListener("click", function () { page -= 1; render(); });
  next.addEventListener("click", function () { page += 1; render(); });
  render();
})();
