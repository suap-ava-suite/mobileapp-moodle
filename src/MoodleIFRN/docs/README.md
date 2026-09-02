# Recursos nativos (ícone e splash)

Assets oficiais do **Painel AVA / IFRN** para o app Ionic/Cordova.

| Arquivo | Uso | Tamanho |
|---------|-----|---------|
| `icon.png` | Ícone do aplicativo | 1024×1024 |
| `splash.png` | Splash screen (load view) | 2732×2732 |

Identidade visual: fundo `#098E95` + marca branca do Painel AVA (theme_ifrn25).

## Aplicar no projeto Cordova

Como a customização IFRN fica isolada em `MoodleIFRN`, copie para a raiz do app quando for gerar o build nativo:

```bash
cp src/MoodleIFRN/resources/icon.png resources/icon.png
cp src/MoodleIFRN/resources/splash.png resources/splash.png
```

No Android 12+, o splash usa também:

- `AndroidWindowSplashScreenBackground` → `#098E95` (em `config.xml`)
- `resources/android/android-splash.xml` apontando para o ícone

Favicons e splash web do painel já estão em:

`mobilemoodle/static/theme/ifrn/favicon/` e `…/img/splash-logo.png`.
