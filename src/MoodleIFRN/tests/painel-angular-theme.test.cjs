// (C) Copyright 2026 Moodle IFRN Mobile. Licensed under the Apache License, Version 2.0.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const postcss = require('postcss');
const selectors = require('postcss-selector-parser');
const { painelAngularTheme } = require('../scripts/painel-angular-theme.cjs');

test('legacy root variables and accessibility selectors target the Angular host without global styles', () => {
    const result = painelAngularTheme(':root { --primary: #1351b4; } :root.dark { --primary: #fff; } body.highlight_links a[href] { color: red; } body[data-zoom="120"] { --font-scale: 1.2; } body.color_mode_low_contrast ion-app { filter: contrast(.8); } .modal-content-body { margin: 0; }');
    const rules = [];
    postcss.parse(result).walkRules(rule => rules.push(rule.selector));
    assert.deepEqual(rules, [':host', ':host-context(.dark)', ':host(.highlight_links) a[href]', ':host([data-zoom="120"])', ':host(.color_mode_low_contrast)', '.modal-content-body']);
    assert.match(result, /--primary: #1351b4/);
    assert.doesNotMatch(result, /:host[^{}]* :host/);
});

test('theme adapter preserves visuals and assets while inheriting native safe areas', () => {
    const original = fs.readFileSync('src/MoodleIFRN/mobilemoodle/mobilemoodle.css', 'utf8');
    const result = painelAngularTheme(original);
    const declarations = css => {
        const values = [];
        postcss.parse(css).walkDecls(decl => values.push([decl.prop, decl.value.replaceAll('../mobilemoodle/static/', 'static/'), decl.important]));
        return values;
    };
    const expected = declarations(original).map(([property, value, important]) => [
        property, /^--ion-safe-area-(top|right|bottom|left)$/.test(property) ? 'inherit' : value, important,
    ]);
    assert.deepEqual(declarations(result), expected);
    assert.match(result, /url\(["']?\.\.\/mobilemoodle\/static\/theme\/ifrn\/fonts\/rawline-400\.woff2/);
    postcss.parse(result).walkRules(rule => {
        if (rule.parent.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
        selectors(ast => ast.walk(node => {
            assert.ok(!(node.type === 'tag' && ['html', 'body', 'ion-app'].includes(node.value)), 'global ancestor must not be left inside an encapsulated component');
            assert.ok(!(node.type === 'pseudo' && node.value === ':root'));
        })).processSync(rule.selector);
    });
    const animation = '@keyframes grow { from { opacity: 0; } 50% { opacity: .5; } to { opacity: 1; } }';
    assert.ok(painelAngularTheme(animation).endsWith(animation));
});

test('Angular panel consumes the reproducible generated theme and keeps native events without iframe', () => {
    const css = fs.readFileSync('src/MoodleIFRN/painel/painel-native-theme.css', 'utf8');
    // Git can check CSS out as CRLF on Windows; tokens and declarations remain exact.
    const generated = painelAngularTheme(fs.readFileSync('src/MoodleIFRN/mobilemoodle/mobilemoodle.css', 'utf8'));
    assert.equal(css.replace(/\r\n/g, '\n'), generated.replace(/\r\n/g, '\n'));
    const component = fs.readFileSync('src/MoodleIFRN/painel/painel-native.ts', 'utf8');
    assert.match(component, /styleUrls: \['\.\/painel-native-theme\.css', '\.\/painel-native\.scss'\]/);
    assert.doesNotMatch(component, /ViewEncapsulation\.None/);
    const html = fs.readFileSync('src/MoodleIFRN/painel/painel-native.html', 'utf8');
    assert.doesNotMatch(html, /<iframe|\?\?/i);
    assert.match(html, /id="main-content"/);
    assert.match(html, /\(click\)="selectCourse\(course\)"/);
});

// The standalone web panel's env() resets must not hide Cordova's measured insets.
test('native theme inherits Android/iOS insets instead of replacing them with standalone defaults', () => {
    const defaults = ':root { --ion-safe-area-top: env(safe-area-inset-top, 0px); --ion-safe-area-right: 0px; --ion-safe-area-bottom: 0px; --ion-safe-area-left: 0px; --primary: #1351b4; }';
    const inherited = [];
    postcss.parse(painelAngularTheme(defaults)).walkDecls(/^--ion-safe-area-/, decl => {
        assert.equal(decl.value, 'inherit', decl.prop + ' must inherit from the Ionic page');
        inherited.push(decl.prop);
    });
    assert.equal(inherited.length, 4);
    assert.match(painelAngularTheme(defaults), /--primary: #1351b4/);
    // The common input remains suitable for the standalone panel; only the Angular output changes.
    assert.match(defaults, /--ion-safe-area-top: env\(safe-area-inset-top, 0px\)/);
});
