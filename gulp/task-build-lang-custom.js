// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const fs = require('fs');
const pathLib = require('path');

const SOURCE_ROOT = pathLib.join('src', 'ifrn');
const ASSETS_LANG = pathLib.join('src', 'assets', 'lang');
const FILE_PATTERN = /^lang\.([a-zA-Z0-9_-]+)\.json$/;

/**
 * Merges the customised IFRN translations (src/ifrn/<component>/lang.<code>.json)
 * into the generated language files (src/assets/lang/<code>.json).
 *
 * The `lang` task only builds en.json, and every other language file is produced from the
 * Moodle langpacks, which do not know about the `ifrn.*` strings. Without this task those
 * strings would disappear from every language except English on each build.
 */
class BuildLangCustomTask {

    /**
     * Collect the customised strings, indexed by language code.
     *
     * @return Object with the shape { langCode: { fullKey: string } }.
     */
    collectStrings() {
        const strings = {};

        if (!fs.existsSync(SOURCE_ROOT)) {
            return strings;
        }

        for (const component of fs.readdirSync(SOURCE_ROOT)) {
            const componentPath = pathLib.join(SOURCE_ROOT, component);

            if (!fs.statSync(componentPath).isDirectory()) {
                continue;
            }

            for (const filename of fs.readdirSync(componentPath)) {
                const matches = FILE_PATTERN.exec(filename);

                if (!matches) {
                    continue;
                }

                const language = matches[1];
                const prefix = `ifrn.${component}.`;
                const contents = JSON.parse(fs.readFileSync(pathLib.join(componentPath, filename), 'utf8'));

                strings[language] = strings[language] || {};

                for (const key in contents) {
                    strings[language][prefix + key] = contents[key];
                }
            }
        }

        return strings;
    }

    /**
     * Run the task.
     *
     * @param done Function to call when done.
     */
    run(done) {
        const strings = this.collectStrings();

        for (const language in strings) {
            const target = pathLib.join(ASSETS_LANG, `${language}.json`);

            if (!fs.existsSync(target)) {
                console.log(`Skipping ${language}: ${target} does not exist, run the langpacks script first.`);

                continue;
            }

            const merged = Object.assign(JSON.parse(fs.readFileSync(target, 'utf8')), strings[language]);
            const ordered = {};

            Object.keys(merged).sort().forEach((key) => {
                ordered[key] = merged[key];
            });

            fs.writeFileSync(target, JSON.stringify(ordered, null, 4));

            console.log(`Merged ${Object.keys(strings[language]).length} custom strings into ${target}`);
        }

        done();
    }

}

module.exports = BuildLangCustomTask;
