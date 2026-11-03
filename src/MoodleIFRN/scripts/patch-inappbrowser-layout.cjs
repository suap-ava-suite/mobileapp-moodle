'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');
const EXPECTED_VERSION = '6.0.0-moodle.1';
const MARKER = 'MoodleIFRN layout fullscreen opt-in';

function replaceExactlyOnce(source, anchor, replacement, description) {
    const first = source.indexOf(anchor);
    if (first < 0 || source.indexOf(anchor, first + anchor.length) >= 0) {
        throw new Error(`InAppBrowser ${description} anchor is missing or ambiguous`);
    }

    return source.slice(0, first) + replacement + source.slice(first + anchor.length);
}

function applyPatch(source) {
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
            ? 'MoodleIFRN InAppBrowser fullscreen layout patch applied.'
            : 'MoodleIFRN InAppBrowser fullscreen layout patch already applied.');
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}

module.exports = context => patchPlugin(context.opts.projectRoot);
module.exports.applyPatch = applyPatch;
module.exports.patchPlugin = patchPlugin;
