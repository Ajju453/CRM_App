'use strict';

const path = require('node:path');
const { openDatabase } = require('./db');
const { createApp } = require('./app');

const port = Number(process.env.PORT) || 3000;
const file = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'balaji.db');
const db = openDatabase(file);

if (db.prepare('SELECT COUNT(*) AS n FROM branches').get().n === 0) {
  console.warn('No branches found. Run "npm run seed" first.');
}

createApp(db).listen(port, () => {
  console.log(`Branch API listening on http://localhost:${port}`);
});
