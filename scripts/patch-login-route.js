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
