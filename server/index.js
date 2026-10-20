import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, migrar } from './db.js';
import * as S from './salas.js';
import { limparApelido, apelidoProibido } from './apelido.js';
import { FICHAS, RODADAS_OPCOES, RODADAS_PADRAO } from '../public/js/engine.js';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORTA = Number(process.env.PORT) || 3000;
const COOKIE = 'mt_token';
const COOKIE_SEGURO = process.env.COOKIE_SECURE === '1';
const TRILHAHUB_URL = process.env.TRILHAHUB_URL || 'https://trilhahub.cloud';
// Telas onde o Trilha HUB aparece (seção "Divulgação do Trilha HUB" do plano).
const SLOTS = new Set(['entrada', 'fila', 'conta', 'carta', 'resultado', 'anfitriao', 'email']);

const app = Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' }, trustProxy: true });
S.configurar({ logger: app.log });

await app.register(cookie);
await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
await app.register(websocket, { options: { maxPayload: 4096 } });
if (process.env.SERVIR_ESTATICOS !== '0') {
  await app.register(fastifyStatic, { root: path.join(raiz, 'public'), maxAge: '1h' });
}

// ---------- Identidade anônima (apelido + ficha, sem dados pessoais) ----------
const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');

async function jogadorDoCookie(cookies) {
  const t = cookies?.[COOKIE];
  if (!t || t.length > 100) return null;
  const r = await pool.query('SELECT id, apelido, ficha FROM jogadores WHERE token_hash = $1', [hash(t)]);
  return r.rows[0] || null;
}

app.get('/api/eu', async (req) => {
  const j = await jogadorDoCookie(req.cookies);
  return {
    jogador: j ? { apelido: j.apelido, ficha: j.ficha } : null,
    config: { rodadas: RODADAS_OPCOES, rodadasPadrao: RODADAS_PADRAO },
  };
});

app.post('/api/eu', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
  const apelido = limparApelido(req.body?.apelido);
  const ficha = String(req.body?.ficha || '');
  if (apelido.length < 2) return reply.code(400).send({ erro: 'O apelido precisa ter de 2 a 20 letras ou números.' });
  if (apelidoProibido(apelido)) return reply.code(400).send({ erro: 'Esse apelido não pode ser usado. Escolha outro.' });
  if (!FICHAS.some((f) => f.id === ficha)) return reply.code(400).send({ erro: 'Escolha uma das fichas.' });
  const j = await jogadorDoCookie(req.cookies);
  if (j) {
    await pool.query('UPDATE jogadores SET apelido = $2, ficha = $3 WHERE id = $1', [j.id, apelido, ficha]);
  } else {
    const token = crypto.randomBytes(32).toString('base64url');
    await pool.query('INSERT INTO jogadores (token_hash, apelido, ficha) VALUES ($1, $2, $3)', [hash(token), apelido, ficha]);
    reply.setCookie(COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', secure: COOKIE_SEGURO, maxAge: 365 * 24 * 3600 });
  }
  return { jogador: { apelido, ficha } };
});

app.post('/api/salas', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
  const j = await jogadorDoCookie(req.cookies);
  if (!j) return reply.code(401).send({ erro: 'Escolha um apelido e uma ficha antes de criar a sala.' });
  const sala = await S.criarSalaCodigo(j, Number(req.body?.rodadas));
  return { codigo: sala.codigo };
});

// Link para o Trilha HUB com UTM; conta o clique por tela, sem identificar o jogador.
app.get('/r/:slot', async (req, reply) => {
  const slot = SLOTS.has(req.params.slot) ? req.params.slot : 'outro';
  pool.query(
    'INSERT INTO cliques (slot) VALUES ($1) ON CONFLICT (slot, dia) DO UPDATE SET total = cliques.total + 1',
    [slot],
  ).catch(() => {});
  const url = new URL(TRILHAHUB_URL);
  url.searchParams.set('utm_source', 'mercado-da-trilha');
  url.searchParams.set('utm_medium', 'jogo');
  url.searchParams.set('utm_content', slot);
  return reply.redirect(url.toString(), 302);
});

app.get('/api/saude', async () => {
  await pool.query('SELECT 1');
  return { ok: true };
});

// ---------- Tempo real ----------
app.register(async (f) => {
  f.get('/ws', { websocket: true }, (ws, req) => {
    // O handler é registrado já, e as mensagens esperam a identificação do jogador.
    const pronto = jogadorDoCookie(req.cookies);
    let jog = null;
    let fila = Promise.resolve();
    let janela = Date.now(), contagem = 0;
    pronto.then((j) => {
      if (!j) { ws.send(JSON.stringify({ t: 'erro', msg: 'Escolha um apelido primeiro.' })); ws.close(); return; }
      jog = j; ws.jogadorId = j.id;
    }).catch(() => ws.close());
    ws.on('message', (raw) => {
      if (Date.now() - janela > 1000) { janela = Date.now(); contagem = 0; }
      if (++contagem > 10) return;
      let m;
      try { m = JSON.parse(raw.toString()); } catch { return; }
      // Uma mensagem de cada vez por conexão, na ordem em que chegaram.
      fila = fila.then(() => pronto).then(() => (jog ? tratar(m) : null));
    });
    ws.on('close', () => pronto.then(() => S.desconectar(ws, jog)));

    async function tratar(m) {
      try {
        // O apelido e a ficha podem ter mudado desde a conexão.
        const atual = (await pool.query('SELECT id, apelido, ficha FROM jogadores WHERE id = $1', [jog.id])).rows[0] || jog;
        switch (m.t) {
          case 'entrar': return await S.entrarNaSala(ws, atual, m.codigo);
          case 'sair_sala': return S.sairDaSalaAtual(ws);
          case 'fila_entrar': return S.entrarNaFila(ws, atual);
          case 'fila_sair': return S.sairDaFila(ws, atual);
          case 'encerrar': {
            const sala = ws.salaCodigo && await S.carregarSala(ws.salaCodigo);
            if (sala && sala.anfitriao === jog.id) await S.encerrarSala(sala, 'O anfitrião encerrou a sala.');
            return;
          }
          case 'rolar': case 'comprar': case 'sair_loja': case 'responder': case 'pagar': case 'ficar':
            return await S.agir(ws, atual, m);
          case 'ping': return ws.send('{"t":"pong"}');
          default: return;
        }
      } catch (e) {
        req.log.error({ err: e }, 'erro ao tratar mensagem');
        if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'erro', msg: 'Algo deu errado. Tente de novo.' }));
      }
    }
  });
});

await migrar(app.log);
S.iniciarFaxina();
await app.listen({ port: PORTA, host: '0.0.0.0' });
