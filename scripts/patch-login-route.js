const fs = require('fs');
const path = require('path');

const file = path.join(
    __dirname,
    '..',
    'src',
    'core',
    'features',
    'login',
    'login.module.ts',
);

let content = fs.readFileSync(file, 'utf8');

// Atualiza o redirect.
content = content.replace(
    "redirectTo: 'sites'",
    "redirectTo: 'ifrn'",
);

// Adiciona a rota ifrn apenas se ela não existir.
if (!content.includes("path: 'ifrn'")) {
    content = content.replace(
        `{
                path: 'site',
                loadComponent: () => import('@features/login/pages/site/site'),
            },`,
        `{
                path: 'ifrn',
                loadComponent: () =>
                    import('@features/login/pages/ifrn-login/ifrn-login')
                        .then(m => m.IfrnLoginPage),
            },
            {
                path: 'site',
                loadComponent: () => import('@features/login/pages/site/site'),
            },`
    );
}

fs.writeFileSync(file, content);

console.log('✔ Login route atualizada com sucesso.');
const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");

// ===========================
// Criar pasta da página IFRN
// ===========================

const pageDir = path.join(
  projectRoot,
  "src",
  "core",
  "features",
  "login",
  "pages",
  "ifrn-login",
);

fs.mkdirSync(pageDir, { recursive: true });

// ===========================
// Arquivos da página
// ===========================

const htmlContent = `
<div class="ifrn-login">
    Hello World
</div>
`;

const scssContent = `
.ifrn-login {
    background-color: red;
}
`;

const tsContent = `// (C) Copyright 2015 Moodle Pty Ltd.


import { Component } from '@angular/core';

@Component({
    selector: 'page-ifrn-login',
    templateUrl: './ifrn-login.html',
    styleUrls: ['./ifrn-login.scss'],
})
export class IfrnLoginPage {}
`;

const files = [
  {
    name: "ifrn-login.html",
    content: htmlContent,
  },
  {
    name: "ifrn-login.scss",
    content: scssContent,
  },
  {
    name: "ifrn-login.ts",
    content: tsContent,
  },
];

for (const file of files) {
  const filePath = path.join(pageDir, file.name);

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, file.content, "utf8");
    console.log(`✔ Criado ${file.name}`);
  } else {
    console.log(`• ${file.name} já existe`);
  }
}

// ===========================
// Alterar login.module.ts
// ===========================

const loginModule = path.join(
  projectRoot,
  "src",
  "core",
  "features",
  "login",
  "login.module.ts",
);

if (!fs.existsSync(loginModule)) {
  console.error("❌ login.module.ts não encontrado.");
  process.exit(1);
}

let content = fs.readFileSync(loginModule, "utf8");

// Atualizar redirect
content = content.replace("redirectTo: 'sites'", "redirectTo: 'ifrn'");

// Inserir rota IFRN somente se ela ainda não existir
if (!content.includes("path: 'ifrn'")) {
  const marker = `{
            path: 'site',
            loadComponent: () => import('@features/login/pages/site/site'),
        },`;

  const replacement = `{
            path: 'ifrn',
            loadComponent: () =>
                import('@features/login/pages/ifrn-login/ifrn-login')
                    .then(m => m.IfrnLoginPage),
        },
        {
            path: 'site',
            loadComponent: () => import('@features/login/pages/site/site'),
        },`;

  if (content.includes(marker)) {
    content = content.replace(marker, replacement);
    console.log("✔ Rota IFRN adicionada");
  } else {
    console.log('⚠ Não foi possível localizar a rota "site".');
  }
} else {
  console.log("• Rota IFRN já existe");
}

fs.writeFileSync(loginModule, content, "utf8");

console.log("\n✔ Patch aplicado com sucesso!");
