'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');
const EXPECTED_VERSION = '6.0.0-moodle.1';
const MARKER = 'MoodleIFRN layout fullscreen opt-in';
const HIDDEN_WINDOW_MARKER = 'MoodleIFRN hidden browser window presentation';
const HIDDEN_THEME_MARKER = 'MoodleIFRN translucent hidden browser theme';
const HIDDEN_RENDER_MARKER = 'MoodleIFRN hidden browser visual state';

const HIDDEN_RENDER_JAVA = `    // ${HIDDEN_RENDER_MARKER}
    private long ifrnHiddenWindowRequest;
    private int ifrnHiddenWindowInputFlags;
    private boolean ifrnHiddenWindowClosing;

    private boolean usesIfrnHiddenWindow() {
        return openWindowHidden && ifrnLayoutFullscreen;
    }

    private void setIfrnHiddenWindowVisible(boolean visible) {
        final InAppBrowserDialog target = dialog;
        final WebView targetView = inAppWebView;
        final long request = ++ifrnHiddenWindowRequest;
        if (target == null || targetView == null || ifrnHiddenWindowClosing) {
            return;
        }
        final int inputFlags = WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                | WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
        if (!visible) {
            WindowManager.LayoutParams attributes = target.getWindow().getAttributes();
            attributes.alpha = 0;
            attributes.flags |= inputFlags;
            target.getWindow().setAttributes(attributes);
            return;
        }
        targetView.postVisualStateCallback(request, new WebView.VisualStateCallback() {
            @Override
            public void onComplete(long requestId) {
                if (request != ifrnHiddenWindowRequest || dialog != target || inAppWebView != targetView
                        || !target.isShowing() || cordova.getActivity().isFinishing()) {
                    return;
                }
                WindowManager.LayoutParams attributes = target.getWindow().getAttributes();
                attributes.alpha = 1;
                attributes.flags = (attributes.flags & ~inputFlags) | ifrnHiddenWindowInputFlags;
                target.getWindow().setAttributes(attributes);
                targetView.requestFocus();
            }
        });
    }

`;

function replaceExactlyOnce(source, anchor, replacement, description) {
    const first = source.indexOf(anchor);
    if (first < 0 || source.indexOf(anchor, first + anchor.length) >= 0) {
        throw new Error(`InAppBrowser ${description} anchor is missing or ambiguous`);
    }

    return source.slice(0, first) + replacement + source.slice(first + anchor.length);
}

function applyFullscreenPatch(source) {
    if (source.includes(MARKER)) {
        return source.replace(`// // ${MARKER}`, `// ${MARKER}`);
    }

    if (!source.includes('import android.view.View;')) {
        throw new Error('InAppBrowser View import anchor is missing');
    }

    source = replaceExactlyOnce(
        source,
        '    private static final String FULLSCREEN = "fullscreen";\n',
        '    private static final String FULLSCREEN = "fullscreen";\n'
            + '    private static final String IFRN_LAYOUT_FULLSCREEN = "ifrnlayoutfullscreen";\n',
        'fullscreen option',
    );
    source = replaceExactlyOnce(
        source,
        '    private boolean fullscreen = true;\n',
        '    private boolean fullscreen = true;\n'
            + '    private boolean ifrnLayoutFullscreen = false;\n',
        'fullscreen state',
    );
    source = replaceExactlyOnce(
        source,
        '        showLocationBar = true;\n',
        '        showLocationBar = true;\n'
            + '        ifrnLayoutFullscreen = false;\n',
        'show page initialization',
    );
    source = replaceExactlyOnce(
        source,
        '            if (fullscreenSet != null) {\n'
            + '                fullscreen = fullscreenSet.equals("yes") ? true : false;\n'
            + '            }\n',
        '            if (fullscreenSet != null) {\n'
            + '                fullscreen = fullscreenSet.equals("yes") ? true : false;\n'
            + '            }\n'
            + '            String ifrnLayoutFullscreenSet = features.get(IFRN_LAYOUT_FULLSCREEN);\n'
            + '            if (ifrnLayoutFullscreenSet != null) {\n'
            + '                ifrnLayoutFullscreen = ifrnLayoutFullscreenSet.equals("yes");\n'
            + '            }\n',
        'fullscreen option parser',
    );
    source = replaceExactlyOnce(
        source,
        '                if (fullscreen) {\n'
            + '                    dialog.getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);\n'
            + '                }\n',
        '                if (fullscreen) {\n'
            + '                    dialog.getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);\n'
            + '                }\n'
            + '                if (ifrnLayoutFullscreen) {\n'
            + `                    // ${MARKER}\n`
            + '                    android.view.View decor = dialog.getWindow().getDecorView();\n'
            + '                    decor.setSystemUiVisibility(decor.getSystemUiVisibility()\n'
            + '                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE\n'
            + '                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);\n'
            + '                }\n',
        'dialog layout flags',
    );

    return source;
}

function applyWindowStylePatch(source) {
    source = applyFullscreenPatch(source.replace(/\r\n/g, '\n'));
    if (!source.includes(HIDDEN_THEME_MARKER)) {
        source = replaceExactlyOnce(
            source,
            '                dialog = new InAppBrowserDialog(cordova.getActivity(), android.R.style.Theme_NoTitleBar);\n',
            `                // ${HIDDEN_THEME_MARKER}\n`
                + '                dialog = new InAppBrowserDialog(cordova.getActivity(), openWindowHidden && ifrnLayoutFullscreen\n'
                + '                        ? android.R.style.Theme_Translucent_NoTitleBar : android.R.style.Theme_NoTitleBar);\n',
            'hidden window theme',
        );
    }

    // Upgrade an already prepared copy from the first presentation-only patch.
    source = source.replace(
        'dialog = new InAppBrowserDialog(cordova.getActivity(), openWindowHidden\n',
        'dialog = new InAppBrowserDialog(cordova.getActivity(), openWindowHidden && ifrnLayoutFullscreen\n',
    ).replace(
        `if (openWindowHidden) {\n                    // ${HIDDEN_WINDOW_MARKER}`,
        `if (openWindowHidden && ifrnLayoutFullscreen) {\n                    // ${HIDDEN_WINDOW_MARKER}`,
    );

    if (source.includes(HIDDEN_WINDOW_MARKER)) {
        return source;
    }

    return replaceExactlyOnce(
        source,
        '                dialog.getWindow().getAttributes().windowAnimations = android.R.style.Animation_Dialog;\n',
        '                dialog.getWindow().getAttributes().windowAnimations = android.R.style.Animation_Dialog;\n'
            + '                if (openWindowHidden && ifrnLayoutFullscreen) {\n'
            + `                    // ${HIDDEN_WINDOW_MARKER}\n`
            + '                    dialog.getWindow().setWindowAnimations(0);\n'
            + '                    dialog.getWindow().setBackgroundDrawable(\n'
            + '                            new android.graphics.drawable.ColorDrawable(Color.TRANSPARENT));\n'
            + '                    dialog.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);\n'
            + '                }\n',
        'hidden window presentation',
    );
}

function applyPatch(source) {
    source = applyWindowStylePatch(source);
    if (source.includes(HIDDEN_RENDER_MARKER)) {
        const start = source.indexOf(`    // ${HIDDEN_RENDER_MARKER}\n`);
        const end = source.indexOf('    public void closeDialog() {\n', start);
        if (start < 0 || end < start) {
            throw new Error('InAppBrowser hidden window helper boundaries are missing');
        }
        source = replaceExactlyOnce(source, source.slice(start, end), HIDDEN_RENDER_JAVA, 'hidden window helper update');
        if (!source.includes('                ifrnHiddenWindowClosing = true;\n')) {
            source = replaceExactlyOnce(
                source,
                '                ++ifrnHiddenWindowRequest;\n',
                '                ++ifrnHiddenWindowRequest;\n                ifrnHiddenWindowClosing = true;\n',
                'hidden window close guard',
            );
        }
        if (!source.includes('                        ifrnHiddenWindowClosing = false;\n')) {
            source = replaceExactlyOnce(
                source,
                '                        ifrnHiddenWindowInputFlags = lp.flags',
                '                        ifrnHiddenWindowClosing = false;\n                        ifrnHiddenWindowInputFlags = lp.flags',
                'hidden window creation guard',
            );
        }
        return source;
    }

    source = replaceExactlyOnce(
        source,
        '    public void closeDialog() {\n',
        HIDDEN_RENDER_JAVA + '    public void closeDialog() {\n',
        'hidden window visual state helper',
    );
    source = replaceExactlyOnce(
        source,
        '                final WebView childView = inAppWebView;\n',
        '                ++ifrnHiddenWindowRequest;\n'
            + '                ifrnHiddenWindowClosing = true;\n'
            + '                final WebView childView = inAppWebView;\n',
        'hidden window close invalidation',
    );
    source = replaceExactlyOnce(
        source,
        '                        dialog.show();\n',
        '                        if (usesIfrnHiddenWindow()) {\n'
            + '                            setIfrnHiddenWindowVisible(true);\n'
            + '                        } else {\n'
            + '                            dialog.show();\n'
            + '                        }\n',
        'hidden window show action',
    );
    source = replaceExactlyOnce(
        source,
        '                        dialog.hide();\n',
        '                        if (usesIfrnHiddenWindow()) {\n'
            + '                            setIfrnHiddenWindowVisible(false);\n'
            + '                        } else {\n'
            + '                            dialog.hide();\n'
            + '                        }\n',
        'hidden window hide action',
    );
    source = replaceExactlyOnce(
        source,
        '                    dialog.setContentView(main);\n'
            + '                    dialog.show();\n',
        '                    dialog.setContentView(main);\n'
            + '                    if (usesIfrnHiddenWindow()) {\n'
            + '                        ifrnHiddenWindowClosing = false;\n'
            + '                        ifrnHiddenWindowInputFlags = lp.flags & (WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE\n'
            + '                                | WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE);\n'
            + '                        lp.alpha = 0;\n'
            + '                        lp.flags |= WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE\n'
            + '                                | WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;\n'
            + '                        dialog.getWindow().setAttributes(lp);\n'
            + '                    }\n'
            + '                    dialog.show();\n',
        'hidden window warmup',
    );
    source = replaceExactlyOnce(
        source,
        '                if (openWindowHidden && dialog != null) {\n',
        '                if (openWindowHidden && dialog != null && !usesIfrnHiddenWindow()) {\n',
        'hidden window keep attached',
    );

    return source;
}

function patchPlugin(root = ROOT) {
    const pluginCopies = [
        path.join(root, 'node_modules/@moodlehq/cordova-plugin-inappbrowser'),
        path.join(root, 'plugins/@moodlehq/cordova-plugin-inappbrowser'),
    ];
    const platformJava = path.join(
        root,
        'platforms/android/app/src/main/java/org/apache/cordova/inappbrowser/InAppBrowser.java',
    );
    let changed = false;
    for (const pluginRoot of pluginCopies) {
        const metadata = JSON.parse(fs.readFileSync(path.join(pluginRoot, 'package.json'), 'utf8'));
        if (metadata.version !== EXPECTED_VERSION) {
            throw new Error(`Expected InAppBrowser ${EXPECTED_VERSION}; found ${metadata.version}`);
        }

        const javaPath = path.join(pluginRoot, 'src/android/InAppBrowser.java');
        const original = fs.readFileSync(javaPath, 'utf8');
        const patched = applyPatch(original);
        if (patched !== original) {
            fs.writeFileSync(javaPath, patched);
            changed = true;
        }
    }

    // Cordova 14 may leave the generated Java copy untouched when only the
    // plugin source file changed. Reapply after_prepare to cover that copy.
    if (fs.existsSync(platformJava)) {
        const original = fs.readFileSync(platformJava, 'utf8');
        const patched = applyPatch(original);
        if (patched !== original) {
            fs.writeFileSync(platformJava, patched);
            changed = true;
        }
    }

    return changed;
}

if (require.main === module) {
    try {
        console.log(patchPlugin()
            ? 'MoodleIFRN InAppBrowser fullscreen layout and hidden window patches applied.'
            : 'MoodleIFRN InAppBrowser fullscreen layout and hidden window patches already applied.');
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}

module.exports = context => patchPlugin(context.opts.projectRoot);
module.exports.applyPatch = applyPatch;
module.exports.patchPlugin = patchPlugin;
