import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

let _pool: Pool | null = null
let _db: ReturnType<typeof drizzle> | null = null

function getPool(): Pool {
  if (!_pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set')
    }
    _pool = new Pool({ connectionString: process.env.DATABASE_URL })
  }
  return _pool
}

function getDb(): ReturnType<typeof drizzle> {
  if (!_db) {
    _db = drizzle(getPool())
  }
  return _db
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    return (getDb() as any as Record<string | symbol, unknown>)[prop]
  },
})

export { getPool as pool }
