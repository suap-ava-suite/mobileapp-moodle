// Child-process probe. All DB contents are synthetic; never use with an application database.
const {DatabaseSync} = require('node:sqlite');
const [filename, operation, id] = process.argv.slice(2);
const db = new DatabaseSync(filename);
if (operation === 'exit-with-open-transaction') {
    db.exec('BEGIN IMMEDIATE');
    db.prepare("UPDATE p07_attempt SET state='confirmed' WHERE id=?").run(id);
    db.prepare('UPDATE p07_authority SET published=? WHERE singleton=1').run(id);
    process.exit(23); // Deliberately no COMMIT, close or success ACK.
} else if (operation === 'inspect') {
    const row = db.prepare('SELECT state FROM p07_attempt WHERE id=?').get(id);
    const authority = db.prepare('SELECT published FROM p07_authority WHERE singleton=1').get();
    console.log(JSON.stringify({state: row.state, published: authority.published}));
    db.close();
} else {
    throw new Error('unknown synthetic probe');
}
