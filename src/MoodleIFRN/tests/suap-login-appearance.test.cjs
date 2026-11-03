'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const { applyPatch } = require('../scripts/patch-inappbrowser-layout.cjs');

const javaFixture = `import android.view.View;
    private static final String FULLSCREEN = "fullscreen";
    private boolean fullscreen = true;
        showLocationBar = true;
            if (fullscreenSet != null) {
                fullscreen = fullscreenSet.equals("yes") ? true : false;
            }
                if (fullscreen) {
                    dialog.getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
                }
`;

test('Android InAppBrowser fullscreen inset patch is safe and idempotent', () => {
    const patched = applyPatch(javaFixture);
    assert.match(patched, /ifrnlayoutfullscreen/);
    assert.match(patched, /SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN/);
    assert.equal(applyPatch(patched), patched);
    assert.throws(() => applyPatch('class InAppBrowser {}'), /anchor/);
});

test('SUAP browser opts into fullscreen content and keeps system-back cancellation', () => {
    const source = fs.readFileSync('src/MoodleIFRN/services_mobile/painel-ava.service.ts', 'utf8');
    const options = source.match(/const PAINEL_IAB_CHROME = \{([\s\S]*?)\n\};/);

    assert.ok(options, 'shared InAppBrowser options must exist');
    assert.match(options[1], /ifrnlayoutfullscreen:\s*'yes'/);
    assert.match(options[1], /location:\s*'no'/);
    assert.match(options[1], /hardwareback:\s*'yes'/);
});
