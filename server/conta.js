// Conta do jogador sem senha: código de recuperação de 6 palavras, e-mail do responsável
// confirmado por código (para o quadro de recordes) e contador anônimo do jogo sozinho.
import crypto from 'node:crypto';
import { PALAVRAS } from './palavras.js';
import { enviarCodigo, codigoDeTeste, modoEmail } from './email.js';

const CONJUNTO = new Set(PALAVRAS);
const EMAIL_OK = /^[^\s@]{1,64}@[^\s@.]{1,100}(\.[^\s@.]{2,}){1,3}$/;
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');

// "Onça, Lobo-Coruja" vira ['onca', 'lobo', 'coruja']: sem acento, maiúscula ou pontuação.
export function normalizarPalavras(texto) {
  const lista = String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z]+/).filter(Boolean);
  return lista.length === 6 && lista.every((p) => CONJUNTO.has(p)) ? lista : null;
}
export const novasPalavras = () => Array.from({ length: 6 }, () => PALAVRAS[crypto.randomInt(PALAVRAS.length)]);

const mascarar = (email) => email.replace(/^(.).*(@.*)$/, (m, a, d) => `${a}***${d}`);

// Os testes de ponta a ponta repetem estas chamadas em sequência: LIMITE_CONTA_X multiplica os limites por minuto.
const lim = (n) => n * (Number(process.env.LIMITE_CONTA_X) || 1);

export function rotasConta(app, { pool, jogadorDoCookie, emitirCookie, diaSP }) {
  // O HMAC usa um segredo do servidor, para o código não poder ser testado fora dele.
  let segredoCache = process.env.SEGREDO_RECUPERACAO || null;
  async function segredo() {
    if (segredoCache) return segredoCache;
    await pool.query("INSERT INTO config (chave, valor) VALUES ('segredo_recuperacao', $1) ON CONFLICT DO NOTHING", [crypto.randomBytes(32).toString('hex')]);
    segredoCache = (await pool.query("SELECT valor FROM config WHERE chave = 'segredo_recuperacao'")).rows[0].valor;
    return segredoCache;
  }
  const hmac = async (palavras) => crypto.createHmac('sha256', await segredo()).update(palavras.join('-')).digest('hex');

  const exigir = async (req, reply) => {
    const j = await jogadorDoCookie(req.cookies);
    if (!j) reply.code(401).send({ erro: 'Entre no jogo com um apelido primeiro.' });
    return j;
  };

  // ---------- Código de recuperação ----------
  // Gera um código novo (o anterior deixa de valer). As palavras só aparecem nesta resposta.
  app.post('/api/recuperacao', { config: { rateLimit: { max: lim(5), timeWindow: '1 minute' } } }, async (req, reply) => {
    const j = await exigir(req, reply); if (!j) return;
    const palavras = novasPalavras();
    await pool.query(
      `INSERT INTO recuperacao (jogador_id, codigo_hmac) VALUES ($1, $2)
       ON CONFLICT (jogador_id) DO UPDATE SET codigo_hmac = $2, criado_em = now()`,
      [j.id, await hmac(palavras)]);
    return { palavras };
  });

  app.post('/api/recuperar', { config: { rateLimit: { max: lim(8), timeWindow: '1 minute' } } }, async (req, reply) => {
    const palavras = normalizarPalavras(req.body?.palavras);
    const r = palavras ? await pool.query(
      'SELECT j.id, j.apelido, j.ficha FROM recuperacao c JOIN jogadores j ON j.id = c.jogador_id WHERE c.codigo_hmac = $1',
      [await hmac(palavras)]) : { rowCount: 0 };
    if (!r.rowCount) return reply.code(400).send({ erro: 'Esse código não confere. Escreva as 6 palavras na mesma ordem.' });
    const j = r.rows[0];
    await emitirCookie(reply, j.id);
    const insignias = (await pool.query('SELECT insignia FROM insignias WHERE jogador_id = $1 ORDER BY ganha_em', [j.id])).rows.map((x) => x.insignia);
    return { jogador: { apelido: j.apelido, ficha: j.ficha }, insignias };
  });

  // ---------- E-mail do responsável ----------
  app.get('/api/responsavel', async (req, reply) => {
    const j = await exigir(req, reply); if (!j) return;
    const r = (await pool.query('SELECT email FROM responsaveis WHERE jogador_id = $1', [j.id])).rows[0];
    return { confirmado: !!r, email: r ? mascarar(r.email) : null, disponivel: modoEmail() !== 'desligado' };
  });

  app.post('/api/responsavel', { config: { rateLimit: { max: lim(6), timeWindow: '1 minute' } } }, async (req, reply) => {
    const j = await exigir(req, reply); if (!j) return;
    if (modoEmail() === 'desligado') return reply.code(503).send({ erro: 'O envio de e-mail ainda não está ligado neste servidor.' });
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (email.length > 120 || !EMAIL_OK.test(email)) return reply.code(400).send({ erro: 'Escreva um e-mail válido, por exemplo responsavel@exemplo.com.br.' });
    const recente = await pool.query("SELECT 1 FROM codigos_email WHERE jogador_id = $1 AND criado_em > now() - interval '60 seconds'", [j.id]);
    if (recente.rowCount) return reply.code(429).send({ erro: 'Espere 1 minuto para pedir outro código.' });
    const porEmail = await pool.query("SELECT count(*)::int AS n FROM codigos_email WHERE email = $1 AND criado_em > now() - interval '24 hours'", [email]);
    const porJogador = await pool.query("SELECT count(*)::int AS n FROM codigos_email WHERE jogador_id = $1 AND criado_em > now() - interval '24 hours'", [j.id]);
    if (porEmail.rows[0].n >= 5 || porJogador.rows[0].n >= 10) return reply.code(429).send({ erro: 'Muitos códigos hoje. Tente de novo amanhã.' });
    const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    try { await enviarCodigo(email, codigo, req.log); } catch (e) {
      req.log.error({ err: e }, 'falha ao enviar o código por e-mail');
      return reply.code(503).send({ erro: 'Não foi possível enviar o e-mail agora. Tente de novo mais tarde.' });
    }
    await pool.query(
      "INSERT INTO codigos_email (jogador_id, email, codigo_hash, expira_em) VALUES ($1, $2, $3, now() + interval '15 minutes')",
      [j.id, email, sha(`${codigo}:${j.id}`)]);
    return { ok: true, email: mascarar(email) };
  });

  app.post('/api/responsavel/confirmar', { config: { rateLimit: { max: lim(10), timeWindow: '1 minute' } } }, async (req, reply) => {
    const j = await exigir(req, reply); if (!j) return;
    const codigo = String(req.body?.codigo || '').replace(/\D/g, '');
    const c = (await pool.query(
      `SELECT id, email, codigo_hash, tentativas FROM codigos_email
        WHERE jogador_id = $1 AND NOT usado AND expira_em > now() AND tentativas < 5 ORDER BY criado_em DESC LIMIT 1`, [j.id])).rows[0];
    if (!c) return reply.code(400).send({ erro: 'Não há código válido. Peça um novo.' });
    const certo = codigo.length === 6 && crypto.timingSafeEqual(Buffer.from(sha(`${codigo}:${j.id}`)), Buffer.from(c.codigo_hash));
    if (!certo) {
      await pool.query('UPDATE codigos_email SET tentativas = tentativas + 1 WHERE id = $1', [c.id]);
      return reply.code(400).send({ erro: c.tentativas + 1 >= 5 ? 'Muitas tentativas erradas. Peça um novo código.' : 'Esse código não confere.' });
    }
    await pool.query('UPDATE codigos_email SET usado = true WHERE id = $1', [c.id]);
    await pool.query(
      `INSERT INTO responsaveis (jogador_id, email) VALUES ($1, $2)
       ON CONFLICT (jogador_id) DO UPDATE SET email = $2, confirmado_em = now()`, [j.id, c.email]);
    return { ok: true, email: mascarar(c.email) };
  });

  // O responsável pode sair do quadro e apagar o e-mail a qualquer hora.
  app.delete('/api/responsavel', async (req, reply) => {
    const j = await exigir(req, reply); if (!j) return;
    await pool.query('DELETE FROM responsaveis WHERE jogador_id = $1', [j.id]);
    await pool.query('DELETE FROM codigos_email WHERE jogador_id = $1', [j.id]);
    return { ok: true };
  });

  // ---------- Quadro de recordes: só quem tem o e-mail do responsável confirmado ----------
  app.get('/api/recordes', async () => {
    const linhas = (await pool.query(
      `WITH base AS (
         SELECT p.jogador_id, s.tipo AS modo, p.pontos FROM participacoes p JOIN salas s ON s.codigo = p.sala_codigo
          WHERE (p.estado->>'fim')::boolean
         UNION ALL SELECT jogador_id, 'solo', pontos FROM partidas_solo
         UNION ALL SELECT jogador_id, 'desafio', pontos FROM desafios_dia
       ), melhor AS (SELECT jogador_id, modo, max(pontos) AS pontos FROM base GROUP BY 1, 2)
       SELECT m.modo, j.apelido, j.ficha, m.pontos
         FROM melhor m JOIN responsaveis r ON r.jogador_id = m.jogador_id JOIN jogadores j ON j.id = m.jogador_id
        ORDER BY m.modo, m.pontos DESC, j.apelido`)).rows;
    const quadro = { solo: [], desafio: [], espera: [], codigo: [] };
    for (const l of linhas) if (quadro[l.modo].length < 10) quadro[l.modo].push({ apelido: l.apelido, ficha: l.ficha, pontos: l.pontos });
    return quadro;
  });

  // ---------- Contador anônimo do jogo sozinho ----------
  // O jogo sozinho roda no aparelho; o aparelho só diz quantas partidas começaram e terminaram, sem identificar ninguém.
  app.post('/api/contador', { config: { rateLimit: { max: lim(20), timeWindow: '1 minute' } } }, async (req, reply) => {
    const { inicio = 0, fim = 0 } = req.body || {};
    if (![inicio, fim].every((n) => Number.isInteger(n) && n >= 0 && n <= 50)) return reply.code(400).send({ erro: 'Contagem inválida.' });
    for (const [evento, n] of [['inicio', inicio], ['fim', fim]]) {
      if (!n) continue;
      await pool.query(
        `INSERT INTO contador_solo (dia, evento, total) VALUES ($1, $2, $3)
         ON CONFLICT (dia, evento) DO UPDATE SET total = contador_solo.total + $3`, [diaSP(), evento, n]);
    }
    return { ok: true };
  });

  // Só para os testes de ponta a ponta, e só com EMAIL_MODO=teste.
  if (modoEmail() === 'teste') {
    app.get('/api/_teste/codigo', async (req) => ({ codigo: codigoDeTeste(String(req.query?.email || '').toLowerCase()) ?? null }));
  }
}
