import pg from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://mercado:mercado@localhost:5432/mercado',
  max: 10,
});

const dirMigracoes = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

// Aplica, em ordem, os arquivos .sql de server/migrations que ainda não rodaram.
export async function migrar(log = console) {
  const c = await pool.connect();
  try {
    await c.query('SELECT pg_advisory_lock(424242)');
    await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (nome text PRIMARY KEY, aplicada_em timestamptz NOT NULL DEFAULT now())');
    const feitas = new Set((await c.query('SELECT nome FROM schema_migrations')).rows.map((r) => r.nome));
    const arquivos = (await readdir(dirMigracoes)).filter((f) => f.endsWith('.sql')).sort();
    for (const f of arquivos) {
      if (feitas.has(f)) continue;
      const sql = await readFile(path.join(dirMigracoes, f), 'utf8');
      await c.query('BEGIN');
      try {
        await c.query(sql);
        await c.query('INSERT INTO schema_migrations (nome) VALUES ($1)', [f]);
        await c.query('COMMIT');
        log.info?.(`migração aplicada: ${f}`);
      } catch (e) {
        await c.query('ROLLBACK');
        throw e;
      }
    }
  } finally {
    await c.query('SELECT pg_advisory_unlock(424242)').catch(() => {});
    c.release();
  }
}
