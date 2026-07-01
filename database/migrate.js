// Archivo: migrate.js
// Ruta: database/migrate.js
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });
const fs   = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const FILES = [
  path.join(__dirname, 'schema.sql'),
  path.join(__dirname, 'seeds.sql'),
  path.join(__dirname, 'migrations', '001_initial_schema.sql'),
  //path.join(__dirname, 'migrations', '002_additional_indexes.sql'),
];

async function migrate() {
  const conn = await mysql.createConnection({
    host:               process.env.DB_HOST     || '127.0.0.1',
    port:    parseInt(  process.env.DB_PORT      || '3306'),
    user:               process.env.DB_USER     || 'tuparley_user',
    password:           process.env.DB_PASSWORD || 'tuparley_local_pass',
    multipleStatements: true,
  });

  for (const file of FILES) {
    if (!fs.existsSync(file)) { console.log(`[migrate] SKIP (no existe): ${path.basename(file)}`); continue; }
    const sql = fs.readFileSync(file, 'utf8');
    console.log(`[migrate] Ejecutando: ${path.basename(file)}...`);
    await conn.query(sql);
    console.log(`[migrate] OK: ${path.basename(file)}`);
  }

  await conn.end();
  console.log('[migrate] Base de datos lista.');
}

migrate().catch(err => { console.error('[migrate] ERROR:', err.message); process.exit(1); });