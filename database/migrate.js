// Archivo: migrate.js
// Ruta: database/migrate.js
// Uso: desde backend/ → npm run db:migrate
// Aplica schema.sql, seeds.sql y migrations/*.sql en orden, saltando las que ya
// figuran en schema_migrations. Seguro de re-ejecutar: no borra datos.
'use strict';

const fs   = require('fs');
const path = require('path');

// Dependencias resueltas desde backend/ para no exigir un npm install en la raíz
const BACKEND = path.join(__dirname, '..', 'backend');
const req     = (m) => require(require.resolve(m, { paths: [BACKEND, __dirname] }));
req('dotenv').config({ path: path.join(BACKEND, '.env') });
const mysql = req('mysql2/promise');

// schema_migrations.version es VARCHAR(20): los nombres se comparan truncados
const VERSION_MAX = 20;
const version = (nombre) => nombre.slice(0, VERSION_MAX);

const MIGRACIONES_DIR = path.join(__dirname, 'migrations');
const PASOS = [
  { archivo: path.join(__dirname, 'schema.sql'), version: '001_initial_schema' },
  { archivo: path.join(__dirname, 'seeds.sql'),  version: '002_seeds' },
  ...fs.readdirSync(MIGRACIONES_DIR)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort()
    .map((f) => ({ archivo: path.join(MIGRACIONES_DIR, f), version: version(f.replace(/\.sql$/, '')) })),
];

async function versionesAplicadas(conn) {
  const [tablas] = await conn.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'tuparley' AND table_name = 'schema_migrations'`
  );
  if (tablas.length === 0) return new Set();
  const [rows] = await conn.query('SELECT version FROM tuparley.schema_migrations');
  return new Set(rows.map((r) => r.version));
}

async function migrate() {
  const conn = await mysql.createConnection({
    host:               process.env.DB_HOST     || '127.0.0.1',
    port:      parseInt(process.env.DB_PORT     || '3307', 10),
    user:               process.env.DB_USER     || 'tuparley_user',
    password:           process.env.DB_PASSWORD || '',
    multipleStatements: true,
    charset:            'utf8mb4',
  });

  try {
    const aplicadas = await versionesAplicadas(conn);
    for (const { archivo, version: v } of PASOS) {
      const nombre = path.basename(archivo);
      if (aplicadas.has(v)) { console.log(`[migrate] ya aplicada: ${nombre}`); continue; }
      console.log(`[migrate] aplicando: ${nombre}...`);
      await conn.query(fs.readFileSync(archivo, 'utf8'));
      // Garantiza el registro aunque el archivo no lo haga
      await conn.query('INSERT IGNORE INTO tuparley.schema_migrations (version) VALUES (?)', [v]);
      console.log(`[migrate] OK: ${nombre}`);
    }
    console.log('[migrate] Base de datos al día.');
  } finally {
    await conn.end();
  }
}

migrate().catch((err) => { console.error('[migrate] ERROR:', err.message); process.exit(1); });
