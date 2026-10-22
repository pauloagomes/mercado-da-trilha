// Conta do responsável, sem senha, com perfis como num serviço de streaming: o adulto entra ou cria a
// conta com o e-mail confirmado por código, e cada criança tem o seu perfil dentro dela. Cada aparelho
// tem a sua sessão, e entrar num aparelho não desconecta os outros. Também o código de recuperação de
// 6 palavras, o quadro de recordes (escolha do responsável, por perfil) e o contador anônimo do jogo sozinho.
import crypto from 'node:crypto';
import { PALAVRAS } from './palavras.js';
import { enviarCodigo, codigoDeTeste, modoEmail } from './email.js';
import { limparApelido, apelidoProibido } from './apelido.js';
import { FICHAS, NIVEIS, NIVEL_PADRAO } from '../public/js/engine.js';

const CONJUNTO = new Set(PALAVRAS);
const EMAIL_OK = /^[^\s@]{1,64}@[^\s@.]{1,100}(\.[^\s@.]{2,}){1,3}$/;
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');

// "Onça, Lobo-Coruja" vira ['onca', 'lobo', 'coruja']: sem acento, maiúscula ou pontuação.
export function normalizarPalavras(texto) {
  const lista = String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z]+/).filter(Boolean);
  return lista.length === 6 && lista.every((p) => CONJUNTO.has(p)) ? lista : null;
}
export const novasPalavras = () => Array.from({ length: 6 }, () => PALAVRAS[crypto.randomInt(PALAVRAS.length)]);

// Para quem chama uma rota que exige a conta sem estar conectado.
export const SEM_CONTA = 'Para isso, um responsável precisa entrar com o e-mail.';
export const SEM_PERFIL = 'Escolha quem vai jogar: abra a lista de perfis.';
export const MAX_PERFIS = 6;

const mascarar = (email) => email.replace(/^(.).*(@.*)$/, (m, a, d) => `${a}***${d}`);

// Os testes de ponta a ponta repetem estas chamadas em sequência: LIMITE_CONTA_X multiplica os limites por minuto.
const lim = (n) => n * (Number(process.env.LIMITE_CONTA_X) || 1);
// Espera entre dois códigos para o mesmo e-mail: 60 s, encurtada na mesma proporção nos testes.
const ESPERA_S = () => Math.max(1, Math.round(60 / (Number(process.env.LIMITE_CONTA_X) || 1)));

export function rotasConta(app, { pool, sessaoDoCookie, jogadorDoCookie, jogadorSemContaDoCookie, abrirSessao, emitirCookieLegado, sairDoAparelho, diaSP }) {
  // O HMAC usa um segredo do servidor, para o código não poder ser testado fora dele.
  let segredoCache = process.env.SEGREDO_RECUPERACAO || null;
  async function segredo() {
    if (segredoCache) return segredoCache;
    await pool.query("INSERT INTO config (chave, valor) VALUES ('segredo_recuperacao', $1) ON CONFLICT DO NOTHING", [crypto.randomBytes(32).toString('hex')]);
    segredoCache = (await pool.query("SELECT valor FROM config WHERE chave = 'segredo_recuperacao'")).rows[0].valor;
    return segredoCache;
  }
  const hmac = async (palavras) => crypto.createHmac('sha256', await segredo()).update(palavras.join('-')).digest('hex');

  // A sessão do aparelho (conta), e o perfil que joga nele.
  const exigirSessao = async (req, reply) => {
    const s = await sessaoDoCookie(req.cookies);
    if (!s) reply.code(401).send({ erro: SEM_CONTA });
    return s;
  };
  const exigirPerfil = async (req, reply) => {
    const j = await jogadorDoCookie(req.cookies);
    if (!j) reply.code(401).send({ erro: SEM_CONTA });
    return j;
  };

  // O que a tela precisa saber da conta: e-mail mascarado, perfis e o perfil escolhido neste aparelho.
  async function estadoDaConta(contaId, perfilId) {
    const c = (await pool.query('SELECT email FROM contas WHERE id = $1', [contaId])).rows[0];
    const perfis = (await pool.query('SELECT id, apelido, ficha, nivel, no_quadro FROM jogadores WHERE conta_id = $1 ORDER BY criado_em', [contaId])).rows;
    const comPontos = await perfisComPontuacao(perfis.map((x) => x.id));
    const p = perfis.find((x) => x.id === perfilId) || null;
    const insignias = p ? (await pool.query('SELECT insignia FROM insignias WHERE jogador_id = $1 ORDER BY ganha_em', [p.id])).rows.map((x) => x.insignia) : [];
    return {
      conta: { email: mascarar(c.email) },
      perfis: perfis.map(({ id, apelido, ficha, nivel }) => ({ id, apelido, ficha, nivel, pontuacao: comPontos.has(id) })),
      perfil: p ? { id: p.id, apelido: p.apelido, ficha: p.ficha, nivel: p.nivel, noQuadro: p.no_quadro } : null,
      jogador: p ? { apelido: p.apelido, ficha: p.ficha, nivel: p.nivel } : null,
      insignias, maxPerfis: MAX_PERFIS,
    };
  }

  // Perfis com pontuação: alguma partida (sozinho, desafio ou sala) ou insígnia. Apagar isso pede o código do e-mail.
  async function perfisComPontuacao(ids) {
    if (!ids.length) return new Set();
    const r = await pool.query(
      `SELECT jogador_id FROM partidas_solo WHERE jogador_id = ANY($1)
       UNION SELECT jogador_id FROM desafios_dia WHERE jogador_id = ANY($1)
       UNION SELECT jogador_id FROM participacoes WHERE jogador_id = ANY($1)
       UNION SELECT jogador_id FROM insignias WHERE jogador_id = ANY($1)`, [ids]);
    return new Set(r.rows.map((x) => x.jogador_id));
  }

  // Confere o código de uma ação (apagar_perfil ou apagar_conta). Devolve o erro em texto, ou null se valeu.
  async function conferirAcao(contaId, acao, alvo, codigo) {
    const c = (await pool.query(
      `SELECT id, codigo_hash, tentativas FROM codigos_acao
        WHERE conta_id = $1 AND acao = $2 AND alvo IS NOT DISTINCT FROM $3 AND NOT usado AND expira_em > now() AND tentativas < 5
        ORDER BY criado_em DESC LIMIT 1`, [contaId, acao, alvo])).rows[0];
    if (!c) return 'Não há código válido. Peça um novo.';
    if (!conferir(String(codigo || '').replace(/\D/g, ''), `${acao}:${alvo || ''}:${contaId}`, c.codigo_hash)) {
      await pool.query('UPDATE codigos_acao SET tentativas = tentativas + 1 WHERE id = $1', [c.id]);
      return c.tentativas + 1 >= 5 ? 'Muitas tentativas erradas. Peça um novo código.' : 'Esse código não confere.';
    }
    await pool.query('UPDATE codigos_acao SET usado = true WHERE id = $1', [c.id]);
    return null;
  }
  const PEDE_CODIGO = 'Há pontuação guardada. Para apagar, confirme com o código enviado ao e-mail da conta.';

  // O nível do perfil (Lobinho ou Escoteiro em diante) define quais cartas saem. Sem o campo, vale o padrão.
  const lerNivel = (v) => (v === undefined || v === null || v === '' ? NIVEL_PADRAO : NIVEIS[String(v)] ? String(v) : null);
  const ERRO_NIVEL = 'Escolha o nível: Lobinho ou Escoteiro em diante.';

  // Apelido, ficha e nível de um perfil novo; devolve o erro em texto, ou null se estiver tudo certo.
  function erroDoPerfil(apelido, ficha, nivel) {
    if (apelido.length < 2) return 'Escreva o apelido de quem vai jogar, com 2 a 20 letras ou números.';
    if (apelidoProibido(apelido)) return 'Esse apelido não pode ser usado. Escolha outro.';
    if (!FICHAS.some((f) => f.id === ficha)) return 'Escolha uma das fichas.';
    if (!nivel) return ERRO_NIVEL;
    return null;
  }

  // Partida em andamento numa sala aberta: a sala ainda grava as jogadas dela, então o perfil não pode sumir.
  const emPartida = async (filtro, valor) => (await pool.query(
    `SELECT 1 FROM participacoes p JOIN salas s ON s.codigo = p.sala_codigo JOIN jogadores j ON j.id = p.jogador_id
      WHERE ${filtro} = $1 AND s.status <> 'encerrada' AND NOT coalesce((p.estado->>'fim')::boolean, false) LIMIT 1`, [valor])).rowCount > 0;
  const EM_PARTIDA = 'Há uma partida em andamento numa sala. Termine a partida ou espere a sala fechar e tente de novo.';

  // ---------- Código de recuperação (de um perfil; entra na conta com esse perfil) ----------
  // Gera um código novo (o anterior deixa de valer). As palavras só aparecem nesta resposta.
  app.post('/api/recuperacao', { config: { rateLimit: { max: lim(5), timeWindow: '1 minute' } } }, async (req, reply) => {
    const j = await exigirPerfil(req, reply); if (!j) return;
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
      'SELECT j.id, j.apelido, j.ficha, j.nivel, j.conta_id FROM recuperacao c JOIN jogadores j ON j.id = c.jogador_id WHERE c.codigo_hmac = $1',
      [await hmac(palavras)]) : { rowCount: 0 };
    if (!r.rowCount) return reply.code(400).send({ erro: 'Esse código não confere. Escreva as 6 palavras na mesma ordem.' });
    const j = r.rows[0];
    if (j.conta_id) {
      await abrirSessao(reply, j.conta_id, j.id);
      return estadoDaConta(j.conta_id, j.id);
    }
    // Um jogador de antes da conta do responsável volta sem conta: o histórico só fica guardado
    // de novo depois que um responsável entrar com o e-mail neste aparelho.
    await emitirCookieLegado(reply, j.id);
    return { jogador: null, semConta: { apelido: j.apelido, ficha: j.ficha, nivel: j.nivel }, insignias: [] };
  });

  // ---------- Entrar ou criar a conta do responsável ----------
  // A conta é de um adulto: ele entra ou cria a conta com o próprio e-mail, confirmado por um código de
  // 6 números (15 minutos, 5 tentativas). Sem conta, só o jogo sozinho no aparelho.
  const MAIOR = 'Só um adulto (18 anos ou mais) responsável pela criança pode entrar ou criar a conta.';
  const lerEmail = (v) => {
    const email = String(v || '').trim().toLowerCase();
    return email.length <= 120 && EMAIL_OK.test(email) ? email : null;
  };
  const novoCodigo = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  async function mandar(req, reply, email, codigo) {
    try { await enviarCodigo(email, codigo, req.log); return true; } catch (e) {
      req.log.error({ err: e }, 'falha ao enviar o código por e-mail');
      reply.code(503).send({ erro: 'Não foi possível enviar o e-mail agora. Tente de novo mais tarde.' });
      return false;
    }
  }
  const conferir = (codigo, salt, hashGuardado) => codigo.length === 6
    && crypto.timingSafeEqual(Buffer.from(sha(`${codigo}:${salt}`)), Buffer.from(hashGuardado));

  // Passo 1: o responsável informa o e-mail e declara ser maior de idade. A resposta é a mesma
  // para e-mail novo ou já cadastrado, para ninguém descobrir quem tem conta.
  app.post('/api/conta/codigo', { config: { rateLimit: { max: lim(6), timeWindow: '1 minute' } } }, async (req, reply) => {
    if (modoEmail() === 'desligado') return reply.code(503).send({ erro: 'O envio de e-mail ainda não está ligado neste servidor.' });
    if (req.body?.maior !== true) return reply.code(400).send({ erro: MAIOR });
    const email = lerEmail(req.body?.email);
    if (!email) return reply.code(400).send({ erro: 'Escreva um e-mail válido, por exemplo responsavel@exemplo.com.br.' });
    const recente = await pool.query("SELECT 1 FROM codigos_entrada WHERE email = $1 AND criado_em > now() - interval '1 second' * $2", [email, ESPERA_S()]);
    if (recente.rowCount) return reply.code(429).send({ erro: 'Espere 1 minuto para pedir outro código.' });
    const hoje = await pool.query("SELECT count(*)::int AS n FROM codigos_entrada WHERE email = $1 AND criado_em > now() - interval '24 hours'", [email]);
    if (hoje.rows[0].n >= 5) return reply.code(429).send({ erro: 'Muitos códigos hoje. Tente de novo amanhã.' });
    const codigo = novoCodigo();
    if (!await mandar(req, reply, email, codigo)) return;
    await pool.query("INSERT INTO codigos_entrada (email, codigo_hash, expira_em) VALUES ($1, $2, now() + interval '15 minutes')", [email, sha(`${codigo}:${email}`)]);
    return { ok: true, email: mascarar(email) };
  });

  // Passo 2: com o código certo, o aparelho ganha uma sessão nesta conta (os outros aparelhos continuam
  // conectados). Conta nova nasce com o primeiro perfil, feito com o apelido e a ficha da criança. Se o
  // aparelho tinha um jogador de antes da conta do responsável, ele vira um perfil e guarda o histórico.
  // Com um perfil só, ele já fica escolhido; com mais de um, a tela pergunta quem vai jogar.
  app.post('/api/conta/entrar', { config: { rateLimit: { max: lim(10), timeWindow: '1 minute' } } }, async (req, reply) => {
    if (req.body?.maior !== true) return reply.code(400).send({ erro: MAIOR });
    const email = lerEmail(req.body?.email);
    const codigo = String(req.body?.codigo || '').replace(/\D/g, '');
    const c = email && (await pool.query(
      `SELECT id, codigo_hash, tentativas FROM codigos_entrada
        WHERE email = $1 AND NOT usado AND expira_em > now() AND tentativas < 5 ORDER BY criado_em DESC LIMIT 1`, [email])).rows[0];
    if (!c) return reply.code(400).send({ erro: 'Não há código válido para esse e-mail. Peça um novo.' });
    if (!conferir(codigo, email, c.codigo_hash)) {
      await pool.query('UPDATE codigos_entrada SET tentativas = tentativas + 1 WHERE id = $1', [c.id]);
      return reply.code(400).send({ erro: c.tentativas + 1 >= 5 ? 'Muitas tentativas erradas. Peça um novo código.' : 'Esse código não confere.' });
    }
    const antigo = await jogadorSemContaDoCookie(req.cookies);
    let contaId = (await pool.query('SELECT id FROM contas WHERE email = $1', [email])).rows[0]?.id;
    let perfilId = null;
    if (!contaId) {
      // Conta nova: confere o apelido e a ficha antes de gastar o código, para dar para corrigir e tentar de novo.
      const apelido = limparApelido(req.body?.apelido), ficha = String(req.body?.ficha || ''), nivel = lerNivel(req.body?.nivel);
      const erro = erroDoPerfil(apelido, ficha, nivel);
      if (erro) return reply.code(400).send({ erro });
      try {
        contaId = (await pool.query('INSERT INTO contas (email, declarou_maior_em) VALUES ($1, now()) RETURNING id', [email])).rows[0].id;
      } catch (e) {
        if (e.code === '23505') return reply.code(409).send({ erro: 'Essa conta acabou de ser criada em outro aparelho. Peça um código novo e entre de novo.' });
        throw e;
      }
      if (antigo) {
        perfilId = antigo.id;
        await pool.query('UPDATE jogadores SET apelido = $2, ficha = $3, nivel = $5, conta_id = $4, token_hash = NULL WHERE id = $1', [antigo.id, apelido, ficha, contaId, nivel]);
      } else {
        perfilId = (await pool.query('INSERT INTO jogadores (apelido, ficha, nivel, conta_id) VALUES ($1, $2, $3, $4) RETURNING id', [apelido, ficha, nivel, contaId])).rows[0].id;
      }
    } else {
      await pool.query('UPDATE contas SET declarou_maior_em = now() WHERE id = $1', [contaId]);
      const ids = (await pool.query('SELECT id FROM jogadores WHERE conta_id = $1', [contaId])).rows.map((x) => x.id);
      if (antigo && ids.length < MAX_PERFIS) {
        perfilId = antigo.id;
        await pool.query('UPDATE jogadores SET conta_id = $2, token_hash = NULL WHERE id = $1', [antigo.id, contaId]);
      } else if (ids.length === 1) perfilId = ids[0];
    }
    await pool.query('UPDATE codigos_entrada SET usado = true WHERE id = $1', [c.id]);
    await abrirSessao(reply, contaId, perfilId);
    return estadoDaConta(contaId, perfilId);
  });

  app.get('/api/conta', async (req, reply) => {
    const s = await exigirSessao(req, reply); if (!s) return;
    return { ...(await estadoDaConta(s.conta_id, s.perfil_id)), emailLigado: modoEmail() !== 'desligado' };
  });

  // ---------- Perfis ----------
  // Um perfil novo já fica escolhido neste aparelho.
  app.post('/api/perfis', { config: { rateLimit: { max: lim(10), timeWindow: '1 minute' } } }, async (req, reply) => {
    const s = await exigirSessao(req, reply); if (!s) return;
    const n = (await pool.query('SELECT count(*)::int AS n FROM jogadores WHERE conta_id = $1', [s.conta_id])).rows[0].n;
    if (n >= MAX_PERFIS) return reply.code(409).send({ erro: `A conta já tem ${MAX_PERFIS} perfis. Apague um para criar outro.` });
    const apelido = limparApelido(req.body?.apelido), ficha = String(req.body?.ficha || ''), nivel = lerNivel(req.body?.nivel);
    const erro = erroDoPerfil(apelido, ficha, nivel);
    if (erro) return reply.code(400).send({ erro });
    const id = (await pool.query('INSERT INTO jogadores (apelido, ficha, nivel, conta_id) VALUES ($1, $2, $3, $4) RETURNING id', [apelido, ficha, nivel, s.conta_id])).rows[0].id;
    await pool.query('UPDATE sessoes SET perfil_id = $2 WHERE id = $1', [s.id, id]);
    return estadoDaConta(s.conta_id, id);
  });

  // Quem vai jogar neste aparelho. Só muda este aparelho: os outros continuam com o perfil que escolheram.
  app.post('/api/perfis/escolher', async (req, reply) => {
    const s = await exigirSessao(req, reply); if (!s) return;
    const id = String(req.body?.id || '');
    const ok = /^[0-9a-f-]{36}$/i.test(id) && (await pool.query('SELECT 1 FROM jogadores WHERE id = $1 AND conta_id = $2', [id, s.conta_id])).rowCount;
    if (!ok) return reply.code(404).send({ erro: 'Esse perfil não é desta conta.' });
    await pool.query('UPDATE sessoes SET perfil_id = $2 WHERE id = $1', [s.id, id]);
    return estadoDaConta(s.conta_id, id);
  });

  // Código para apagar pontuação: vai para o e-mail da conta (o responsável), nunca para quem está com o aparelho.
  app.post('/api/conta/codigo-apagar', { config: { rateLimit: { max: lim(6), timeWindow: '1 minute' } } }, async (req, reply) => {
    const s = await exigirSessao(req, reply); if (!s) return;
    if (modoEmail() === 'desligado') return reply.code(503).send({ erro: 'O envio de e-mail ainda não está ligado neste servidor.' });
    const acao = req.body?.acao;
    if (acao !== 'apagar_perfil' && acao !== 'apagar_conta') return reply.code(400).send({ erro: 'Ação desconhecida.' });
    let alvo = null, apelido = '';
    if (acao === 'apagar_perfil') {
      alvo = String(req.body?.id || '');
      const p = /^[0-9a-f-]{36}$/i.test(alvo) && (await pool.query('SELECT apelido FROM jogadores WHERE id = $1 AND conta_id = $2', [alvo, s.conta_id])).rows[0];
      if (!p) return reply.code(404).send({ erro: 'Esse perfil não é desta conta.' });
      apelido = p.apelido;
    }
    const recente = await pool.query("SELECT 1 FROM codigos_acao WHERE conta_id = $1 AND criado_em > now() - interval '1 second' * $2", [s.conta_id, ESPERA_S()]);
    if (recente.rowCount) return reply.code(429).send({ erro: 'Espere 1 minuto para pedir outro código.' });
    const hoje = await pool.query("SELECT count(*)::int AS n FROM codigos_acao WHERE conta_id = $1 AND criado_em > now() - interval '24 hours'", [s.conta_id]);
    if (hoje.rows[0].n >= 10) return reply.code(429).send({ erro: 'Muitos códigos hoje. Tente de novo amanhã.' });
    const email = (await pool.query('SELECT email FROM contas WHERE id = $1', [s.conta_id])).rows[0].email;
    const codigo = novoCodigo();
    try { await enviarCodigo(email, codigo, req.log, { motivo: acao, apelido }); } catch (e) {
      req.log.error({ err: e }, 'falha ao enviar o código por e-mail');
      return reply.code(503).send({ erro: 'Não foi possível enviar o e-mail agora. Tente de novo mais tarde.' });
    }
    await pool.query(
      "INSERT INTO codigos_acao (conta_id, acao, alvo, codigo_hash, expira_em) VALUES ($1, $2, $3, $4, now() + interval '15 minutes')",
      [s.conta_id, acao, alvo, sha(`${codigo}:${acao}:${alvo || ''}:${s.conta_id}`)]);
    return { ok: true, email: mascarar(email) };
  });

  // Apagar um perfil leva as partidas, as insígnias e o código de recuperação dele. A conta continua.
  // Se o perfil tem pontuação, precisa do código enviado ao e-mail da conta.
  app.post('/api/perfis/apagar', { config: { rateLimit: { max: lim(5), timeWindow: '1 minute' } } }, async (req, reply) => {
    const s = await exigirSessao(req, reply); if (!s) return;
    if (req.body?.confirmo !== true) return reply.code(400).send({ erro: 'Confirme que quer apagar o perfil.' });
    const id = String(req.body?.id || '');
    const ok = /^[0-9a-f-]{36}$/i.test(id) && (await pool.query('SELECT 1 FROM jogadores WHERE id = $1 AND conta_id = $2', [id, s.conta_id])).rowCount;
    if (!ok) return reply.code(404).send({ erro: 'Esse perfil não é desta conta.' });
    if (await emPartida('j.id', id)) return reply.code(409).send({ erro: EM_PARTIDA });
    if ((await perfisComPontuacao([id])).size) {
      if (!req.body?.codigo) return reply.code(403).send({ erro: PEDE_CODIGO, precisaCodigo: true });
      const erro = await conferirAcao(s.conta_id, 'apagar_perfil', id, req.body.codigo);
      if (erro) return reply.code(400).send({ erro });
    }
    await pool.query('DELETE FROM jogadores WHERE id = $1', [id]);
    return estadoDaConta(s.conta_id, s.perfil_id === id ? null : s.perfil_id);
  });

  // Quadro de recordes: o responsável escolhe, para cada perfil, se ele aparece (só apelido, ficha e pontos).
  app.post('/api/conta/quadro', async (req, reply) => {
    const j = await exigirPerfil(req, reply); if (!j) return;
    if (typeof req.body?.sim !== 'boolean') return reply.code(400).send({ erro: 'Diga se o perfil entra ou sai do quadro.' });
    await pool.query('UPDATE jogadores SET no_quadro = $2 WHERE id = $1', [j.id, req.body.sim]);
    return { ok: true, noQuadro: req.body.sim };
  });

  // ---------- Trocar o e-mail da conta ----------
  // O código vai para o e-mail novo, e só depois de confirmado ele vira o login.
  app.post('/api/conta/email', { config: { rateLimit: { max: lim(6), timeWindow: '1 minute' } } }, async (req, reply) => {
    const s = await exigirSessao(req, reply); if (!s) return;
    if (modoEmail() === 'desligado') return reply.code(503).send({ erro: 'O envio de e-mail ainda não está ligado neste servidor.' });
    const email = lerEmail(req.body?.email);
    if (!email) return reply.code(400).send({ erro: 'Escreva um e-mail válido, por exemplo responsavel@exemplo.com.br.' });
    if ((await pool.query('SELECT 1 FROM contas WHERE email = $1', [email])).rowCount) {
      return reply.code(409).send({ erro: 'Esse e-mail já é de uma conta. Use outro.' });
    }
    const recente = await pool.query("SELECT 1 FROM codigos_email WHERE conta_id = $1 AND criado_em > now() - interval '1 second' * $2", [s.conta_id, ESPERA_S()]);
    if (recente.rowCount) return reply.code(429).send({ erro: 'Espere 1 minuto para pedir outro código.' });
    const porEmail = await pool.query("SELECT count(*)::int AS n FROM codigos_email WHERE email = $1 AND criado_em > now() - interval '24 hours'", [email]);
    const porConta = await pool.query("SELECT count(*)::int AS n FROM codigos_email WHERE conta_id = $1 AND criado_em > now() - interval '24 hours'", [s.conta_id]);
    if (porEmail.rows[0].n >= 5 || porConta.rows[0].n >= 10) return reply.code(429).send({ erro: 'Muitos códigos hoje. Tente de novo amanhã.' });
    const codigo = novoCodigo();
    if (!await mandar(req, reply, email, codigo)) return;
    await pool.query(
      "INSERT INTO codigos_email (conta_id, email, codigo_hash, expira_em) VALUES ($1, $2, $3, now() + interval '15 minutes')",
      [s.conta_id, email, sha(`${codigo}:${s.conta_id}`)]);
    return { ok: true, email: mascarar(email) };
  });

  app.post('/api/conta/email/confirmar', { config: { rateLimit: { max: lim(10), timeWindow: '1 minute' } } }, async (req, reply) => {
    const s = await exigirSessao(req, reply); if (!s) return;
    const codigo = String(req.body?.codigo || '').replace(/\D/g, '');
    const c = (await pool.query(
      `SELECT id, email, codigo_hash, tentativas FROM codigos_email
        WHERE conta_id = $1 AND NOT usado AND expira_em > now() AND tentativas < 5 ORDER BY criado_em DESC LIMIT 1`, [s.conta_id])).rows[0];
    if (!c) return reply.code(400).send({ erro: 'Não há código válido. Peça um novo.' });
    if (!conferir(codigo, s.conta_id, c.codigo_hash)) {
      await pool.query('UPDATE codigos_email SET tentativas = tentativas + 1 WHERE id = $1', [c.id]);
      return reply.code(400).send({ erro: c.tentativas + 1 >= 5 ? 'Muitas tentativas erradas. Peça um novo código.' : 'Esse código não confere.' });
    }
    try {
      await pool.query('UPDATE contas SET email = $2, confirmado_em = now() WHERE id = $1', [s.conta_id, c.email]);
    } catch (e) {
      if (e.code === '23505') return reply.code(409).send({ erro: 'Esse e-mail já é de uma conta. Use outro.' });
      throw e;
    }
    await pool.query('UPDATE codigos_email SET usado = true WHERE id = $1', [c.id]);
    return { ok: true, email: mascarar(c.email) };
  });

  // Sair deste aparelho (aparelho emprestado, celular da chefia): só esta sessão acaba; a conta e os
  // outros aparelhos continuam.
  app.post('/api/conta/sair', async (req, reply) => {
    const s = await sessaoDoCookie(req.cookies);
    if (s) await pool.query('DELETE FROM sessoes WHERE id = $1', [s.id]);
    sairDoAparelho(reply);
    return { ok: true };
  });

  // Apagar a conta: o e-mail, os perfis, as partidas, as insígnias, os códigos de recuperação e as
  // sessões de todos os aparelhos vão juntos (ON DELETE CASCADE). Se algum perfil tem pontuação, precisa do
  // código enviado ao e-mail da conta.
  app.post('/api/conta/apagar', { config: { rateLimit: { max: lim(5), timeWindow: '1 minute' } } }, async (req, reply) => {
    const s = await exigirSessao(req, reply); if (!s) return;
    if (req.body?.confirmo !== true) return reply.code(400).send({ erro: 'Confirme que quer apagar a conta.' });
    if (await emPartida('j.conta_id', s.conta_id)) return reply.code(409).send({ erro: EM_PARTIDA });
    const ids = (await pool.query('SELECT id FROM jogadores WHERE conta_id = $1', [s.conta_id])).rows.map((x) => x.id);
    if ((await perfisComPontuacao(ids)).size) {
      if (!req.body?.codigo) return reply.code(403).send({ erro: PEDE_CODIGO, precisaCodigo: true });
      const erro = await conferirAcao(s.conta_id, 'apagar_conta', null, req.body.codigo);
      if (erro) return reply.code(400).send({ erro });
    }
    await pool.query('DELETE FROM contas WHERE id = $1', [s.conta_id]);
    sairDoAparelho(reply);
    return { ok: true };
  });

  // ---------- Quadro de recordes: os perfis que o responsável inscreveu, e só para quem tem conta ----------
  app.get('/api/recordes', async (req, reply) => {
    if (!await exigirSessao(req, reply)) return;
    const linhas = (await pool.query(
      `WITH base AS (
         SELECT p.jogador_id, s.tipo AS modo, p.pontos FROM participacoes p JOIN salas s ON s.codigo = p.sala_codigo
          WHERE (p.estado->>'fim')::boolean
         UNION ALL SELECT jogador_id, 'solo', pontos FROM partidas_solo
         UNION ALL SELECT jogador_id, 'desafio', pontos FROM desafios_dia
       ), melhor AS (SELECT jogador_id, modo, max(pontos) AS pontos FROM base GROUP BY 1, 2)
       SELECT m.modo, j.apelido, j.ficha, m.pontos
         FROM melhor m JOIN jogadores j ON j.id = m.jogador_id AND j.no_quadro AND j.conta_id IS NOT NULL
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
