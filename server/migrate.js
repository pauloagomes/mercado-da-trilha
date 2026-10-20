import { migrar, pool } from './db.js';

await migrar();
await pool.end();
console.log('Banco atualizado.');
