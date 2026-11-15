'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
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
                dialog = new InAppBrowserDialog(cordova.getActivity(), android.R.style.Theme_NoTitleBar);
                dialog.getWindow().getAttributes().windowAnimations = android.R.style.Animation_Dialog;
                // Native fixture presentation end
                        dialog.show();
                        dialog.hide();
                    dialog.setContentView(main);
                    dialog.show();
                if (openWindowHidden && dialog != null) {
                    dialog.hide();
                }
    public void closeDialog() {
                final WebView childView = inAppWebView;
    }
`;

test('Android InAppBrowser fullscreen inset patch is safe and idempotent', () => {
    const patched = applyPatch(javaFixture);
    assert.match(patched, /ifrnlayoutfullscreen/);
    assert.match(patched, /SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN/);
    assert.equal(applyPatch(patched), patched);
    assert.throws(() => applyPatch('class InAppBrowser {}'), /anchor/);
});

test('patch upgrades the previous fullscreen source and accepts Windows line endings', () => {
    const oldSource = javaFixture + '// MoodleIFRN layout fullscreen opt-in\n';
    const patched = applyPatch(oldSource);

    assert.match(patched, /MoodleIFRN hidden browser window presentation/);
    assert.equal(applyPatch(patched), patched);
    assert.equal(applyPatch(oldSource.replace(/\n/g, '\r\n')), patched);
});

test('hidden window patch rejects missing or ambiguous native presentation anchors', () => {
    const animationLine = '                dialog.getWindow().getAttributes().windowAnimations = android.R.style.Animation_Dialog;\n';

    assert.throws(() => applyPatch(javaFixture.replace(animationLine, '')), /hidden window presentation anchor/);
    assert.throws(() => applyPatch(javaFixture + animationLine), /hidden window presentation anchor/);
});

test('patched Java disables animation and dimming only for a hidden browser window', () => {
    const patched = applyPatch(javaFixture);
    const start = patched.indexOf('                dialog = new InAppBrowserDialog');
    const presentationCode = patched.slice(start, patched.indexOf('// Native fixture presentation end')).trim();
    const helperStart = patched.indexOf('    // MoodleIFRN hidden browser visual state');
    const helper = patched.slice(helperStart, patched.indexOf('    public void closeDialog()'));
    const harness = `
class android {
    static class R { static class style {
        static int Animation_Dialog = 77;
        static int Theme_NoTitleBar = 1;
        static int Theme_Translucent_NoTitleBar = 2;
    } }
    static class graphics { static class drawable {
        static class ColorDrawable {
            final int color;
            ColorDrawable(int color) { this.color = color; }
        }
    } }
}
public class HiddenWindowCheck {
    static class Color { static int TRANSPARENT = 0; }
    static class WindowManager { static class LayoutParams {
        static int FLAG_DIM_BEHIND = 2, FLAG_NOT_FOCUSABLE = 8, FLAG_NOT_TOUCHABLE = 16;
        int windowAnimations, flags = 258;
        float alpha = 1;
    } }
    static class TestWindow {
        final WindowManager.LayoutParams attributes = new WindowManager.LayoutParams();
        android.graphics.drawable.ColorDrawable background;
        WindowManager.LayoutParams getAttributes() { return attributes; }
        void setAttributes(WindowManager.LayoutParams value) {
            attributes.flags = value.flags;
            attributes.alpha = value.alpha;
        }
        void setWindowAnimations(int value) { attributes.windowAnimations = value; }
        void setBackgroundDrawable(android.graphics.drawable.ColorDrawable value) { background = value; }
        void clearFlags(int value) { attributes.flags &= ~value; }
    }
    static class InAppBrowserDialog {
        final TestWindow window = new TestWindow();
        final int theme;
        InAppBrowserDialog(Object context, int theme) { this.theme = theme; }
        TestWindow getWindow() { return window; }
        boolean isShowing() { return true; }
    }
    static class Activity {
        boolean finishing;
        boolean isFinishing() { return finishing; }
    }
    static class Cordova {
        final Activity activity = new Activity();
        Activity getActivity() { return activity; }
    }
    static class WebView {
        abstract static class VisualStateCallback { public abstract void onComplete(long requestId); }
        final java.util.List<VisualStateCallback> callbacks = new java.util.ArrayList<>();
        int focusRequests;
        void postVisualStateCallback(long request, VisualStateCallback callback) { callbacks.add(callback); }
        void requestFocus() { focusRequests++; }
        void renderNext() { callbacks.remove(0).onComplete(0); }
    }
    InAppBrowserDialog dialog;
    WebView inAppWebView;
    Cordova cordova = new Cordova();
    boolean openWindowHidden = true, ifrnLayoutFullscreen = true;
    ${helper}
    static InAppBrowserDialog configure(boolean openWindowHidden) {
        Cordova cordova = new Cordova();
        InAppBrowserDialog dialog;
        boolean ifrnLayoutFullscreen = true;
        ${presentationCode}
        return dialog;
    }
    public static void main(String[] args) {
        InAppBrowserDialog visible = configure(false);
        if (visible.window.attributes.windowAnimations != 77 || visible.window.attributes.flags != 258
                || visible.window.background != null || visible.theme != android.R.style.Theme_NoTitleBar)
            throw new AssertionError("Visible browser changed");
        InAppBrowserDialog hidden = configure(true);
        if (hidden.window.attributes.windowAnimations != 0 || hidden.window.attributes.flags != 256
                || hidden.window.background == null || hidden.window.background.color != Color.TRANSPARENT
                || hidden.theme != android.R.style.Theme_Translucent_NoTitleBar)
            throw new AssertionError("Hidden window presentation is not transparent and immediate");

        HiddenWindowCheck flow = new HiddenWindowCheck();
        flow.dialog = hidden;
        flow.inAppWebView = new WebView();
        flow.setIfrnHiddenWindowVisible(false);
        if (hidden.window.attributes.alpha != 0 || (hidden.window.attributes.flags & 24) != 24)
            throw new AssertionError("Hidden browser intercepts interaction");
        flow.setIfrnHiddenWindowVisible(true);
        if (hidden.window.attributes.alpha != 0) throw new AssertionError("Browser shown before its rendered frame");
        flow.inAppWebView.renderNext();
        if (hidden.window.attributes.alpha != 1 || hidden.window.attributes.flags != 256)
            throw new AssertionError("Rendered browser must restore input without changing other flags");
        flow.setIfrnHiddenWindowVisible(false);
        flow.setIfrnHiddenWindowVisible(true);
        flow.setIfrnHiddenWindowVisible(false);
        flow.inAppWebView.renderNext();
        if (hidden.window.attributes.alpha != 0) throw new AssertionError("Late frame reopened a hidden browser");
        flow.setIfrnHiddenWindowVisible(true);
        ++flow.ifrnHiddenWindowRequest;
        flow.inAppWebView.renderNext();
        if (hidden.window.attributes.alpha != 0) throw new AssertionError("Late frame survived close invalidation");
        flow.ifrnHiddenWindowClosing = true;
        flow.setIfrnHiddenWindowVisible(true);
        if (!flow.inAppWebView.callbacks.isEmpty()) throw new AssertionError("Closing window queued a new presentation");
        flow.ifrnHiddenWindowClosing = false;
        flow.setIfrnHiddenWindowVisible(true);
        flow.dialog = configure(true);
        flow.inAppWebView.renderNext();
        if (hidden.window.attributes.alpha != 0) throw new AssertionError("Late frame reopened a replaced dialog");
        flow.dialog = hidden;
        flow.setIfrnHiddenWindowVisible(true);
        WebView oldView = flow.inAppWebView;
        flow.inAppWebView = new WebView();
        oldView.renderNext();
        if (hidden.window.attributes.alpha != 0) throw new AssertionError("Late frame reopened a replaced WebView");
        flow.setIfrnHiddenWindowVisible(true);
        flow.cordova.activity.finishing = true;
        flow.inAppWebView.renderNext();
        if (hidden.window.attributes.alpha != 0) throw new AssertionError("Finishing activity became visible");
        flow.ifrnLayoutFullscreen = false;
        if (flow.usesIfrnHiddenWindow()) throw new AssertionError("Ordinary Moodle browser opted in");
    }
}
`;
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ifrn-hidden-window-'));
    try {
        const file = path.join(directory, 'HiddenWindowCheck.java');
        fs.writeFileSync(file, harness);
        const compile = spawnSync('javac', ['-encoding', 'UTF-8', '-d', directory, file], { encoding: 'utf8' });
        assert.ifError(compile.error);
        assert.equal(compile.status, 0, compile.stderr);
        const run = spawnSync('java', ['-cp', directory, 'HiddenWindowCheck'], { encoding: 'utf8' });
        assert.ifError(run.error);
        assert.equal(run.status, 0, run.stderr);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test('SUAP browser opts into fullscreen content and keeps system-back cancellation', () => {
    const source = fs.readFileSync('src/MoodleIFRN/services_mobile/painel-ava.service.ts', 'utf8');
    const options = source.match(/const PAINEL_IAB_CHROME = \{([\s\S]*?)\n\};/);

    assert.ok(options, 'shared InAppBrowser options must exist');
    assert.match(options[1], /ifrnlayoutfullscreen:\s*'yes'/);
    assert.match(options[1], /location:\s*'no'/);
    assert.match(options[1], /hardwareback:\s*'yes'/);
});
