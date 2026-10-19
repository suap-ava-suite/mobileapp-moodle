/** Build web para Cordova + idioma empacotado; não compila nem assina o binário nativo. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';

const args = process.argv.slice(2);
const platformArgs = args.filter(arg => arg.startsWith('--platform='));
const platform = platformArgs[0]?.slice('--platform='.length) ?? 'android';
if (platformArgs.length > 1 || !['android', 'ios'].includes(platform)
    || args.some(arg => arg !== '--check' && !arg.startsWith('--platform='))) {
    throw new Error('Uso: node src/MoodleIFRN/build-native.mjs [--platform=android|ios] [--check]');
}

const root=fileURLToPath(new URL('../../',import.meta.url));
const languageFile=path.join(root,'src/MoodleIFRN/services_mobile/ifrn-language.ts');
const source=ts.createSourceFile(languageFile,fs.readFileSync(languageFile,'utf8'),ts.ScriptTarget.Latest,true);
let dictionary;
for(const statement of source.statements){
    if(!ts.isVariableStatement(statement))continue;
    for(const variable of statement.declarationList.declarations){
        if(variable.name.getText(source)!=='IFRN_PT_BR' || !variable.initializer || !ts.isObjectLiteralExpression(variable.initializer))continue;
        dictionary={};
        for(const property of variable.initializer.properties){
            if(!ts.isPropertyAssignment(property) || !ts.isStringLiteralLike(property.name) || !ts.isStringLiteralLike(property.initializer)){
                throw new Error('O dicionário deve conter apenas chaves e valores de texto.');
            }
            dictionary[property.name.text]=property.initializer.text;
        }
    }
}
if(!dictionary || Object.keys(dictionary).length===0)throw new Error('Dicionário IFRN não encontrado.');
if(process.argv.includes('--check')){
    console.log(`Dicionário validado para ${platform}: ${Object.keys(dictionary).length} entradas; nenhum arquivo gerado.`);
}else{
    execFileSync(process.execPath,[path.join(root,'node_modules/@angular/cli/bin/ng.js'),'run','app:ionic-cordova-build',`--platform=${platform}`,'--browser-target=app:build:development'],{
        cwd:root,stdio:'inherit',env:{...process.env,NODE_OPTIONS:'--max-old-space-size=8192'},
    });
    const output=path.join(root,'www/assets/lang/pt-br.json');
    fs.mkdirSync(path.dirname(output),{recursive:true});
    fs.writeFileSync(output,JSON.stringify(dictionary));
    console.log(`Build web Cordova (${platform}) concluído; pt-br.json publicado em www/assets/lang.`);
}
