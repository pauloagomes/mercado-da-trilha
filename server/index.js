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
import { rotasConta, SEM_CONTA } from './conta.js';
import { modoEmail } from './email.js';
import * as E from '../public/js/engine.js';
import { FICHAS, RODADAS_OPCOES, RODADAS_PADRAO, ACOES_DO_JOGO } from '../public/js/engine.js';

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
  // HTML, JS e CSS: o navegador confere a versão a cada carga (ETag), para nunca misturar tela velha com
  // servidor novo. Imagens mudam pouco e podem ficar um dia no cache.
  await app.register(fastifyStatic, {
    root: path.join(raiz, 'public'),
    cacheControl: false,
    setHeaders: (reply, arquivo) => reply.header('Cache-Control', /[\\/]img[\\/]/.test(arquivo) ? 'public, max-age=86400' : 'no-cache'),
  });
}

// ---------- Conta do responsável: o cookie mt_token é a sessão do aparelho ----------
// Cada aparelho tem a sua sessão (conta + perfil escolhido nele); entrar num aparelho não desconecta os outros.
const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');
const tokenDo = (cookies) => { const t = cookies?.[COOKIE]; return t && t.length <= 100 ? hash(t) : null; };
const gravarCookie = (reply, token) => reply.setCookie(COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', secure: COOKIE_SEGURO, maxAge: 365 * 24 * 3600 });

async function sessaoDoCookie(cookies) {
  const h = tokenDo(cookies); if (!h) return null;
  return (await pool.query('SELECT id, conta_id, perfil_id FROM sessoes WHERE token_hash = $1', [h])).rows[0] || null;
}
// O perfil que joga neste aparelho. Sem conta, ou sem perfil escolhido, nada além do jogo sozinho.
async function jogadorDoCookie(cookies) {
  const h = tokenDo(cookies); if (!h) return null;
  const r = await pool.query(
    'SELECT j.id, j.apelido, j.ficha, j.nivel, j.conta_id FROM sessoes s JOIN jogadores j ON j.id = s.perfil_id WHERE s.token_hash = $1', [h]);
  return r.rows[0] || null;
}
// Jogador criado antes da conta do responsável (só apelido e ficha): vira um perfil quando um responsável
// entra com o e-mail neste aparelho, e assim o histórico dele não se perde.
async function jogadorSemContaDoCookie(cookies) {
  const h = tokenDo(cookies); if (!h) return null;
  return (await pool.query('SELECT id FROM jogadores WHERE token_hash = $1 AND conta_id IS NULL', [h])).rows[0] || null;
}
async function abrirSessao(reply, contaId, perfilId) {
  const token = crypto.randomBytes(32).toString('base64url');
  await pool.query('INSERT INTO sessoes (token_hash, conta_id, perfil_id) VALUES ($1, $2, $3)', [hash(token), contaId, perfilId]);
  gravarCookie(reply, token);
}
// Só para o jogador de antes da conta do responsável que volta pelo código de recuperação.
async function emitirCookieLegado(reply, jogadorId) {
  const token = crypto.randomBytes(32).toString('base64url');
  await pool.query('UPDATE jogadores SET token_hash = $2 WHERE id = $1', [jogadorId, hash(token)]);
  gravarCookie(reply, token);
}
const sairDoAparelho = (reply) => reply.clearCookie(COOKIE, { path: '/', httpOnly: true, sameSite: 'lax', secure: COOKIE_SEGURO });

const IDS_INSIGNIAS = new Set(E.INSIGNIAS.map((i) => i.id));
const insigniasDe = async (id) => (await pool.query('SELECT insignia FROM insignias WHERE jogador_id = $1 ORDER BY ganha_em', [id])).rows.map((r) => r.insignia);

app.get('/api/eu', async (req) => {
  const s = await sessaoDoCookie(req.cookies);
  const j = s?.perfil_id ? await jogadorDoCookie(req.cookies) : null;
  return {
    jogador: j ? { apelido: j.apelido, ficha: j.ficha, nivel: j.nivel } : null,
    conta: !!s, perfilId: j?.id || null,   // conta sem perfil escolhido: a tela pergunta quem vai jogar
    insignias: j ? await insigniasDe(j.id) : [],
    config: { rodadas: RODADAS_OPCOES, rodadasPadrao: RODADAS_PADRAO, emailLigado: modoEmail() !== 'desligado' },
  };
});

// Troca o apelido e a ficha do perfil escolhido. A conta só nasce em /api/conta/entrar, pelo responsável.
app.post('/api/eu', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
  const j = await jogadorDoCookie(req.cookies);
  if (!j) return reply.code(401).send({ erro: SEM_CONTA });
  const apelido = limparApelido(req.body?.apelido);
  const ficha = String(req.body?.ficha || '');
  if (apelido.length < 2) return reply.code(400).send({ erro: 'O apelido precisa ter de 2 a 20 letras ou números.' });
  if (apelidoProibido(apelido)) return reply.code(400).send({ erro: 'Esse apelido não pode ser usado. Escolha outro.' });
  if (!FICHAS.some((f) => f.id === ficha)) return reply.code(400).send({ erro: 'Escolha uma das fichas.' });
  const nivel = req.body?.nivel === undefined ? j.nivel : String(req.body.nivel);   // sem o campo, o nível fica como está
  if (!E.NIVEIS[nivel]) return reply.code(400).send({ erro: 'Escolha o nível: Lobinho ou Escoteiro em diante.' });
  await pool.query('UPDATE jogadores SET apelido = $2, ficha = $3, nivel = $4 WHERE id = $1', [j.id, apelido, ficha, nivel]);
  return { jogador: { apelido, ficha, nivel } };
});

app.post('/api/salas', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
  const j = await jogadorDoCookie(req.cookies);
  if (!j) return reply.code(401).send({ erro: SEM_CONTA });
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

// ---------- Histórico, jogo sozinho e desafio do dia ----------
// O dia do desafio é o dia civil de São Paulo (toISOString viraria "amanhã" das 21h à meia-noite).
const diaSP = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
const diaAceito = (dia) => typeof dia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dia) && dia <= diaSP() && dia >= diaSP(new Date(Date.now() - 2 * 86400_000));
const inteiro = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

// E3: últimas 20 partidas, recorde de cada modo e insígnias.
app.get('/api/minha-trilha', async (req, reply) => {
  const j = await jogadorDoCookie(req.cookies);
  if (!j) return reply.code(401).send({ erro: SEM_CONTA });
  const partidas = (await pool.query(
    `SELECT modo, pontos, saldo, quando FROM (
       SELECT s.tipo AS modo, p.pontos, p.saldo_bc AS saldo, p.atualizado_em AS quando
         FROM participacoes p JOIN salas s ON s.codigo = p.sala_codigo
        WHERE p.jogador_id = $1 AND (p.estado->>'fim')::boolean
       UNION ALL
       SELECT 'solo', pontos, saldo_bc, criada_em FROM partidas_solo WHERE jogador_id = $1
       UNION ALL
       SELECT 'desafio', pontos, saldo_bc, enviado_em FROM desafios_dia WHERE jogador_id = $1
     ) t ORDER BY quando DESC LIMIT 20`, [j.id])).rows;
  const rec = (await pool.query(
    `SELECT modo, max(pontos) AS pontos FROM (
       SELECT s.tipo AS modo, p.pontos FROM participacoes p JOIN salas s ON s.codigo = p.sala_codigo
        WHERE p.jogador_id = $1 AND (p.estado->>'fim')::boolean
       UNION ALL SELECT 'solo', pontos FROM partidas_solo WHERE jogador_id = $1
       UNION ALL SELECT 'desafio', pontos FROM desafios_dia WHERE jogador_id = $1
     ) t GROUP BY modo`, [j.id])).rows;
  const insignias = (await pool.query('SELECT insignia AS id, ganha_em FROM insignias WHERE jogador_id = $1 ORDER BY ganha_em DESC', [j.id])).rows;
  return { partidas, recordes: Object.fromEntries(rec.map((r) => [r.modo, r.pontos])), insignias };
});

// O jogo sozinho roda no aparelho; o resultado sobe quando houver conexão. O id vem do aparelho
// e a gravação ignora repetição, então reenviar é seguro.
app.post('/api/solo', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
  const j = await jogadorDoCookie(req.cookies);
  if (!j) return reply.code(401).send({ erro: SEM_CONTA });
  const b = req.body || {};
  const ok = typeof b.id === 'string' && /^[0-9a-f-]{36}$/i.test(b.id) && inteiro(b.pontos, 0, 1000) && inteiro(b.saldo, 0, E.SALDO_MAX)
    && inteiro(b.acertos, 0, 60) && inteiro(b.kit, 0, E.ITENS.length) && E.RODADAS_OPCOES.includes(b.rodadas)
    && (b.posicao == null || inteiro(b.posicao, 1, 4));
  if (!ok) return reply.code(400).send({ erro: 'Resultado inválido.' });
  await pool.query(
    `INSERT INTO partidas_solo (id, jogador_id, pontos, saldo_bc, acertos, kit, rodadas, posicao)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING`,
    [b.id, j.id, b.pontos, b.saldo, b.acertos, b.kit, b.rodadas, b.posicao ?? null]);
  for (const i of (Array.isArray(b.insignias) ? b.insignias : []).filter((x) => IDS_INSIGNIAS.has(x)).slice(0, 12)) {
    await pool.query("INSERT INTO insignias (jogador_id, insignia, origem) VALUES ($1, $2, 'solo') ON CONFLICT DO NOTHING", [j.id, i]);
  }
  return { ok: true, insignias: await insigniasDe(j.id) };
});

// E2: a primeira tentativa do dia vale para o placar. O servidor repete a partida com as ações
// recebidas e só aceita o resultado que ele mesmo calcular.
app.post('/api/desafio', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
  const j = await jogadorDoCookie(req.cookies);
  if (!j) return reply.code(401).send({ erro: SEM_CONTA });
  const { dia, acoes } = req.body || {};
  if (!diaAceito(dia)) return reply.code(400).send({ erro: 'Esse desafio já fechou.' });
  const r = E.rodarDesafio(dia, acoes);
  if (r.erro) return reply.code(400).send({ erro: r.erro });
  const t = r.pontos;
  const ins = await pool.query(
    `INSERT INTO desafios_dia (dia, jogador_id, pontos, saldo_bc, acertos, kit) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (dia, jogador_id) DO NOTHING RETURNING pontos`,
    [dia, j.id, t.total, r.st.saldo, r.st.acertos, r.st.kit.length]);
  if (ins.rowCount) {
    for (const i of E.insigniasDaPartida(r.st)) {
      await pool.query("INSERT INTO insignias (jogador_id, insignia, origem) VALUES ($1, $2, 'desafio') ON CONFLICT DO NOTHING", [j.id, i]);
    }
  }
  return { valeu: ins.rowCount > 0, pontos: t.total, insignias: await insigniasDe(j.id) };
});

app.get('/api/desafio/ranking', async (req, reply) => {
  const dia = req.query?.dia || diaSP();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return reply.code(400).send({ erro: 'Dia inválido.' });
  const j = await jogadorDoCookie(req.cookies);
  if (!j) return reply.code(401).send({ erro: SEM_CONTA });
  const top = (await pool.query(
    `SELECT j.apelido, j.ficha, d.pontos, d.saldo_bc AS saldo, (d.jogador_id = $2) AS eu
       FROM desafios_dia d JOIN jogadores j ON j.id = d.jogador_id
      WHERE d.dia = $1 ORDER BY d.pontos DESC, d.saldo_bc DESC, d.enviado_em LIMIT 20`, [dia, j.id])).rows;
  const total = Number((await pool.query('SELECT count(*) FROM desafios_dia WHERE dia = $1', [dia])).rows[0].count);
  const meu = (await pool.query('SELECT pontos FROM desafios_dia WHERE dia = $1 AND jogador_id = $2', [dia, j.id])).rows[0];
  return { dia, hoje: diaSP(), total, top, jogou: !!meu };
});

rotasConta(app, { pool, sessaoDoCookie, jogadorDoCookie, jogadorSemContaDoCookie, abrirSessao, emitirCookieLegado, sairDoAparelho, diaSP });

app.get('/api/saude', async () => {
  await pool.query('SELECT 1');
  return { ok: true };
});

// ---------- Tempo real ----------
// Um perfil joga em um aparelho por vez: quando ele abre a conexão das salas em outro aparelho, o
// anterior sai da sala ou da fila (sem perder a conta) e a partida continua no aparelho novo.
const jogandoEm = new Map();   // id do perfil -> conexão do aparelho que está jogando
app.register(async (f) => {
  f.get('/ws', { websocket: true }, (ws, req) => {
    // O handler é registrado já, e as mensagens esperam a identificação do jogador.
    const pronto = jogadorDoCookie(req.cookies);
    let jog = null;
    let fila = Promise.resolve();
    let janela = Date.now(), contagem = 0;
    pronto.then((j) => {
      if (!j) { ws.send(JSON.stringify({ t: 'erro', msg: SEM_CONTA })); ws.close(); return; }
      jog = j; ws.jogadorId = j.id;
      const antes = jogandoEm.get(j.id);
      if (antes && antes !== ws && antes.readyState === 1) {
        antes.send(JSON.stringify({ t: 'outro_aparelho', msg: `${j.apelido} começou a jogar em outro aparelho.` }));
        antes.close(4001);
      }
      jogandoEm.set(j.id, ws);
    }).catch(() => ws.close());
    ws.on('message', (raw) => {
      if (Date.now() - janela > 1000) { janela = Date.now(); contagem = 0; }
      if (++contagem > 10) return;
      let m;
      try { m = JSON.parse(raw.toString()); } catch { return; }
      // Uma mensagem de cada vez por conexão, na ordem em que chegaram.
      fila = fila.then(() => pronto).then(() => (jog ? tratar(m) : null));
    });
    ws.on('close', () => pronto.then(() => {
      if (jog && jogandoEm.get(jog.id) === ws) jogandoEm.delete(jog.id);
      S.desconectar(ws, jog);
    }));

    async function tratar(m) {
      try {
        // O apelido e a ficha podem ter mudado desde a conexão.
        const atual = (await pool.query('SELECT id, apelido, ficha, nivel FROM jogadores WHERE id = $1', [jog.id])).rows[0];
        if (!atual) { ws.close(); return; }   // a conta foi apagada
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
          case 'reagir': return S.reagir(ws, atual, m);
          case 'votar_evento': return S.votarEvento(ws, atual, m);
          case 'dar_lance': return S.darLance(ws, atual, m);
          case 'abrir_leilao': return S.abrirLeilaoCodigo(ws, atual);
          case 'patrulhas': return await S.sortearPatrulhas(ws, atual, m);
          case 'mestre': return S.mestreDoMercado(ws, atual, m);
          case 'revanche': return await S.pedirRevanche(ws, atual);
          case 'ping': return ws.send('{"t":"pong"}');
          default:
            if (ACOES_DO_JOGO.includes(m.t)) return await S.agir(ws, atual, m);
            return;
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
