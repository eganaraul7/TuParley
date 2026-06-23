'use strict';

/**
 * db.js — Pool de conexiones MySQL con mysql2.
 * Expone: pool (para queries directas) y query() (wrapper con logging).
 * Base de datos: tuparley
 * Zona horaria: America/Caracas (VET, UTC-4)
 */

const mysql = require('mysql2/promise');
const env   = require('./env');

const pool = mysql.createPool({
  host              : env.DB_HOST,
  port              : env.DB_PORT,
  database          : env.DB_NAME,
  user              : env.DB_USER,
  password          : env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit   : env.DB_POOL_MAX,
  queueLimit        : 0,
  timezone          : '-04:00',          // Venezuela VET
  charset           : 'utf8mb4',
  decimalNumbers    : true,              // DECIMAL → número JS, no string
  multipleStatements: false,             // Seguridad: evita inyección multi-query
  connectTimeout    : 10000,
});

/**
 * Wrapper de query con manejo de errores centralizado.
 * @param {string} sql
 * @param {Array}  params
 * @returns {Promise<Array>} rows
 */
async function query(sql, params = []) {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (err) {
    console.error('[DB] Error en query:', err.message);
    console.error('[DB] SQL:', sql);
    throw err;
  }
}

/**
 * Obtiene una conexión del pool para usar transacciones.
 * SIEMPRE liberar con conn.release() en finally.
 * @returns {Promise<mysql.PoolConnection>}
 */
async function getConnection() {
  return pool.getConnection();
}

/**
 * Verifica la conexión al arrancar el servidor.
 */
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log(`[DB] Conectado a MySQL → ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`);
  } catch (err) {
    console.error('[DB] No se pudo conectar a MySQL:', err.message);
    process.exit(1);
  }
}

module.exports = { pool, query, getConnection, testConnection };