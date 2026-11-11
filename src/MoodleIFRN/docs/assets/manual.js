(function () {
  "use strict";

  var root = document.documentElement;
  var status = document.getElementById("live-status");
  var themeToggle = document.getElementById("theme-toggle");
  var search = document.getElementById("manual-search");
  var sidebar = document.getElementById("sidebar");
  var menuToggle = document.querySelector(".menu-toggle");
  var noResults = document.getElementById("no-results");

  if (document.body.dataset.document) {
    var currentDocument = document.body.dataset.document;
    sidebar.querySelectorAll("a").forEach(function (link) {
      var target = link.getAttribute("href").split("#")[0];
      if (target === currentDocument) {
        link.setAttribute("aria-current", "page");
        var group = link.closest("details");
        if (group) {
          group.open = true;
        }
      }
    });
  }

  try {
    var savedTheme = localStorage.getItem("ifrn-docs-theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      root.setAttribute("data-theme", savedTheme);
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      root.setAttribute("data-theme", "dark");
    }
  } catch (_) {
    // O modo claro continua disponível quando a página local bloqueia storage.
  }

  themeToggle.addEventListener("click", function () {
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("ifrn-docs-theme", next);
    } catch (_) {
      // A alternância visual funciona mesmo sem persistência.
    }
    themeToggle.setAttribute("aria-label", next === "dark" ? "Ativar tema claro" : "Ativar tema escuro");
  });

  menuToggle.addEventListener("click", function () {
    var open = sidebar.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
  });

  sidebar.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      sidebar.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Abrir menu");
    });
  });

  search.addEventListener("input", function () {
    var query = search.value.trim().toLocaleLowerCase("pt-BR");
    var sections = Array.prototype.slice.call(document.querySelectorAll(".searchable"));
    var visibleCount = 0;

    sections.forEach(function (section) {
      var matches = !query || section.textContent.toLocaleLowerCase("pt-BR").indexOf(query) !== -1;
      section.hidden = !matches;
      if (matches) {
        visibleCount += 1;
      }
    });

    if (noResults) {
      noResults.hidden = !query || visibleCount > 0;
    }

    status.textContent = query ? visibleCount + " seção(ões) encontrada(s)." : "Pesquisa limpa.";
  });

  function fallbackCopy(text) {
    var textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    var copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (_) {
      copied = false;
    }
    textarea.remove();
    return copied;
  }

  document.querySelectorAll(".copy-button").forEach(function (button) {
    button.addEventListener("click", function () {
      var code = button.parentElement.querySelector("pre code");
      var text = code ? code.textContent : "";
      var original = button.textContent;

      function showResult(copied) {
        button.textContent = copied ? "Copiado" : "Selecione e copie";
        status.textContent = copied ? "Comando copiado para a área de transferência." : "Não foi possível copiar automaticamente. Selecione o comando e use copiar.";
        window.setTimeout(function () {
          button.textContent = original;
        }, 1800);
        if (!copied && code) {
          var range = document.createRange();
          range.selectNodeContents(code);
          var selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }

      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function () {
          showResult(true);
        }).catch(function () {
          showResult(fallbackCopy(text));
        });
      } else {
        showResult(fallbackCopy(text));
      }
    });
  });
})();
