const fs = require('fs-extra');
const path = require('path');
const sass = require('sass');

const projectRoot = path.resolve(__dirname, '..');
const source = path.join(projectRoot, 'src/MoodleIFRN/mobilemoodle/static/theme/ifrn/scss/painel.scss');
const output = path.join(projectRoot, 'www/mobilemoodle/static/theme/ifrn/css/painel.css');

fs.ensureDirSync(path.dirname(output));
const result = sass.compile(source, { style: 'expanded', sourceMap: false });
fs.writeFileSync(output, result.css);
console.log(`✔ tema IFRN compilado → ${path.relative(projectRoot, output)}`);
