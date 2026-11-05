import zipfile, json, pathlib
p = pathlib.Path('platforms/android/app/build/outputs/apk/debug/app-debug.apk')
if p.exists():
    with zipfile.ZipFile(p) as archive:
        entries = archive.infolist()
        def total(items):
            return {'files': len(items), 'uncompressedBytes': sum(i.file_size for i in items), 'compressedBytes': sum(i.compress_size for i in items)}
        groups = {
            'all': total(entries),
            'www': total([i for i in entries if i.filename.startswith('assets/www/')]),
            'sourceMaps': total([i for i in entries if i.filename.endswith('.map')]),
            'ifrnSourceFiles': total([i for i in entries if i.filename.startswith('assets/www/mobilemoodle/') and i.filename.endswith(('.ts', '.mjs', '.md'))]),
        }
        groups['sourceExamples'] = [i.filename for i in entries if i.filename.startswith('assets/www/mobilemoodle/core_mobile/') and i.filename.endswith('.ts')][:5]
        pathlib.Path('.analise/qualidade-codigo/evidencias/apk.json').write_text(json.dumps(groups, indent=2), encoding='utf8')
        print(json.dumps(groups))
