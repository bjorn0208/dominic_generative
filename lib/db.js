import pg from 'pg'
const { Pool } = pg

let pool = null

export function getPool() {
  if (pool) return pool
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL não configurada')
  }
  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
    connectionTimeoutMillis: 10_000
  })
  return pool
}

export async function query(text, params) {
  const p = getPool()
  const res = await p.query(text, params)
  return res
}

export async function closePool() {
  if (pool) {
    await pool.end()
    pool = null
  }
}

export function closePoolAfterResponse(res) {
  res.on('finish', () => {
    closePool().catch(() => {})
  })
  res.on('close', () => {
    closePool().catch(() => {})
  })
}