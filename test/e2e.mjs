// Teste ponta a ponta contra um servidor rodando.
// Uso: EMAIL_MODO=teste LIMITE_CONTA_X=50 INTERVALO_MS=800 CONTAGEM_FILA_MS=1500 RODADA_MS=1500 npm start  (num terminal)
//      node test/e2e.mjs                                                                            (em outro)
// EMAIL_MODO=teste é obrigatório: toda conta é de um responsável e nasce do código enviado por e-mail.
import WebSocket from 'ws';
import assert from 'node:assert/strict';
import * as E from '../public/js/engine.js';
import { ITENS } from '../public/js/engine.js';
import crypto from 'node:crypto';

const BASE = process.env.BASE || 'http://localhost:3000';

const post = (corpo, cookie = '') => ({ method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(corpo) });
const codigoDe = async (email) => (await (await fetch(`${BASE}/api/_teste/codigo?email=${encodeURIComponent(email)}`)).json()).codigo;
if ((await fetch(`${BASE}/api/_teste/codigo?email=x`)).status === 404) {
  console.error('Suba o servidor com EMAIL_MODO=teste: toda conta nasce do código enviado por e-mail.');
  process.exit(1);
}
const sufixo = crypto.randomBytes(4).toString('hex');   // e-mails novos a cada execução
const emailDe = (nome) => `${nome.toLowerCase()}-${sufixo}@exemplo.com.br`;

// Cria a conta como o responsável faria: e-mail, declaração de maioridade, código e o apelido da criança.
async function novoJogador(apelido, ficha) {
  const email = emailDe(apelido);
  const r1 = await fetch(`${BASE}/api/conta/codigo`, post({ email, maior: true }));
  assert.equal(r1.status, 200, await r1.clone().text());
  const r = await fetch(`${BASE}/api/conta/entrar`, post({ email, codigo: await codigoDe(email), maior: true, apelido, ficha }));
  assert.equal(r.status, 200, await r.clone().text());
  const cookie = r.headers.get('set-cookie').split(';')[0];
  return { apelido, cookie, email };
}

function conectar(j) {
  const ws = new WebSocket(BASE.replace('http', 'ws') + '/ws', { headers: { cookie: j.cookie } });
  j.ws = ws; j.msgs = []; j.estado = null; j.erros = [];
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    j.msgs.push(m);
    if (m.t === 'estado') j.estado = m;
    if (m.t === 'erro') j.erros.push(m.msg);
  });
  return new Promise((ok) => ws.on('open', ok));
}
const send = (j, m) => j.ws.send(JSON.stringify(m));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
async function ate(cond, ms = 8000) {
  const t0 = Date.now();
  while (!cond()) { if (Date.now() - t0 > ms) throw new Error('tempo esgotado esperando condição'); await espera(30); }
}

// Vota e dá lance quando a sala abre a janela entre rodadas.
function janelas(j) {
  const s = j.estado?.sala;
  if (s?.voto && s.voto.meuVoto === null) send(j, { t: 'votar_evento', i: 0 });
  if (s?.leilao && s.leilao.meuLance === null) send(j, { t: 'dar_lance', valor: 10 });
}

// Joga a vez atual do jogador de forma simples: compra o que der, responde 0, paga.
function jogarVez(j) {
  const eu = j.estado?.eu;
  if (!eu || eu.fim) return;
  if (!eu.rolou) return send(j, { t: 'rolar' });
  if (eu.pend?.tipo === 'loja') {
    const item = ITENS.find((i) => i.loja === eu.pend.loja && !eu.kit.includes(i.id) && i.preco + eu.extra <= eu.saldo);
    return send(j, item ? { t: 'comprar', itens: [item.id] } : { t: 'sair_loja' });
  }
  if (eu.pend?.tipo === 'carta') return send(j, { t: 'responder', i: 0 });
  if (eu.pend?.tipo === 'troca') return send(j, { t: 'sair_troca' });
  if (eu.pend?.tipo === 'perdido') return send(j, { t: 'arriscar' });
  if (eu.pend) return send(j, { t: 'pagar' });
}

// ---------- Sala com código, ritmo livre ----------
const a = await novoJogador('Ana', 'f01');
const b = await novoJogador('Beto', 'f01'); // mesma ficha: pode repetir na sala com código
const r = await fetch(`${BASE}/api/salas`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: a.cookie }, body: JSON.stringify({ rodadas: 8 }) });
const { codigo } = await r.json();
assert.match(codigo, /^[A-Z0-9]{5}$/);
await conectar(a); await conectar(b);
send(a, { t: 'entrar', codigo }); send(b, { t: 'entrar', codigo });
await ate(() => a.estado?.placar.length === 2 && b.estado?.eu);
assert.notEqual(a.estado.placar[0].cor, a.estado.placar[1].cor, 'bordas com cores diferentes');
assert.equal(a.estado.sala.souAnfitriao, true);
assert.equal(b.estado.sala.souAnfitriao, false);

for (let i = 0; i < 200 && !(a.estado.eu.fim && b.estado.eu.fim); i++) {
  jogarVez(a); jogarVez(b);
  await espera(25);
}
if (!(a.estado.eu.fim && b.estado.eu.fim)) console.log(JSON.stringify(a.estado.eu).slice(0,600), [...new Set(a.erros)], [...new Set(b.erros)]);
assert.ok(a.estado.eu.fim && b.estado.eu.fim, 'os dois terminaram as 8 rodadas');
assert.equal(a.estado.eu.rodada, 8);
console.log('sala com código ok:', codigo, a.estado.placar.map((p) => `${p.apelido} ${p.pontos} pts`).join(' | '));

// Recarregar a página: a sala continua com o mesmo estado.
a.ws.close(); await conectar(a); send(a, { t: 'entrar', codigo });
await ate(() => a.estado?.eu?.fim);
send(a, { t: 'encerrar' });
await ate(() => a.estado.sala.status === 'encerrada');
console.log('reconexão e encerramento ok');

// ---------- Sala de espera, rodadas sincronizadas ----------
const c = await novoJogador('Caio', 'f03');
const d = await novoJogador('Duda', 'f03'); // mesma ficha: na sala de espera, a segunda troca
await conectar(c); await conectar(d);
send(c, { t: 'fila_entrar' });
await ate(() => c.msgs.some((m) => m.t === 'fila'));
send(d, { t: 'fila_entrar' });
await ate(() => c.msgs.some((m) => m.t === 'fila' && m.inicioEm));
await ate(() => c.estado?.sala?.tipo === 'espera' && d.estado?.sala?.tipo === 'espera', 5000);
assert.equal(c.estado.sala.codigo, d.estado.sala.codigo);
const fichas = c.estado.placar.map((p) => p.ficha);
assert.equal(new Set(fichas).size, 2, 'fichas exclusivas na sala de espera');

// Caio joga; Duda não faz nada (o servidor joga por ela quando o tempo acaba).
let rodadasVistas = new Set();
for (let i = 0; i < 2000 && c.estado.sala.status !== 'encerrada'; i++) {
  rodadasVistas.add(c.estado.sala.rodadaSync);
  janelas(c);
  if (c.estado.eu.rodada === c.estado.sala.rodadaSync - 1) jogarVez(c);
  await espera(25);
}
assert.equal(c.estado.sala.status, 'encerrada');
assert.equal(c.estado.eu.rodada, 12);
// A última mensagem da Duda pode chegar um instante depois da do Caio.
await ate(() => d.estado.eu.rodada === 12, 3000).catch(() => {});
assert.equal(d.estado.eu.rodada, 12, 'Duda também completou as 12 rodadas por tempo esgotado');
assert.ok(rodadasVistas.size >= 12);
console.log('sala de espera ok:', c.estado.mural.at(-1).texto);

// ---------- Etapa 3: jogo sozinho, desafio do dia e Minha trilha ----------
const http = (j, caminho, corpo) => fetch(`${BASE}${caminho}`, {
  method: corpo ? 'POST' : 'GET', headers: { 'content-type': 'application/json', cookie: j.cookie }, body: corpo ? JSON.stringify(corpo) : undefined,
});
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

const idSolo = crypto.randomUUID();
const solo = { id: idSolo, pontos: 88, saldo: 70, acertos: 4, kit: 5, rodadas: 12, posicao: 2, insignias: ['poupador', 'inventada'] };
let r1 = await http(a, '/api/solo', solo);
assert.equal(r1.status, 200);
const insSolo = (await r1.json()).insignias;
assert.ok(insSolo.includes('poupador') && !insSolo.includes('inventada'), 'insígnia desconhecida é ignorada');
assert.equal((await http(a, '/api/solo', solo)).status, 200, 'reenviar o mesmo resultado é seguro');
assert.equal((await http(a, '/api/solo', { ...solo, id: crypto.randomUUID(), pontos: 5000 })).status, 400);
assert.equal((await http({ cookie: '' }, '/api/solo', solo)).status, 401);

// joga o desafio de hoje como o celular faria e manda as ações
const ctx = E.novoDesafio(hoje), eu = ctx.estados.get('eu'), acoes = [];
const passo = (m) => { assert.ok(E.passoDoDesafio(ctx, m).ok, JSON.stringify(m)); acoes.push(m); };
for (let i = 0; i < 300 && !eu.fim; i++) {
  if (!eu.rolou) passo({ t: 'rolar' });
  else if (eu.pend?.tipo === 'loja') { const it = ITENS.find((x) => x.loja === eu.pend.loja && !eu.kit.includes(x.id) && E.precoItem(eu, x) + eu.extra <= eu.saldo); passo(it ? { t: 'comprar', itens: [it.id] } : { t: 'sair_loja' }); }
  else if (eu.pend?.tipo === 'carta') passo({ t: 'responder', i: 0 });
  else if (eu.pend?.tipo === 'perdido') passo({ t: 'arriscar' });
  else if (eu.pend?.tipo === 'troca') passo({ t: 'sair_troca' });
  else passo({ t: 'pagar' });
}
const esperado = E.pontuacao(eu).total;
const d1 = await http(a, '/api/desafio', { dia: hoje, acoes });
assert.equal(d1.status, 200, await d1.clone().text());
const dj = await d1.json();
assert.deepEqual([dj.valeu, dj.pontos], [true, esperado], 'o servidor repete a partida e chega aos mesmos pontos');
const d2 = await (await http(a, '/api/desafio', { dia: hoje, acoes })).json();
assert.equal(d2.valeu, false, 'só a primeira tentativa do dia vale');
assert.equal((await http(b, '/api/desafio', { dia: hoje, acoes: acoes.slice(0, 5) })).status, 400, 'partida incompleta');
assert.equal((await http(b, '/api/desafio', { dia: '2099-01-01', acoes })).status, 400, 'dia no futuro');
assert.equal((await http(b, '/api/desafio', { dia: '2020-01-01', acoes })).status, 400, 'dia que já fechou');
assert.equal((await http(b, '/api/desafio', { dia: hoje, acoes: [{ t: 'comprar', itens: ['lona'] }] })).status, 400);
const rk = await (await http(a, `/api/desafio/ranking?dia=${hoje}`)).json();
assert.ok(rk.total >= 1 && rk.top.some((x) => x.eu && x.pontos === esperado), 'a primeira tentativa entra no placar do dia');
assert.equal(rk.jogou, true);
assert.equal((await (await http(b, `/api/desafio/ranking?dia=${hoje}`)).json()).jogou, false);

const trilha = await (await http(a, '/api/minha-trilha')).json();
assert.ok(trilha.partidas.some((p) => p.modo === 'solo' && p.pontos === 88));
assert.ok(trilha.partidas.some((p) => p.modo === 'desafio' && p.pontos === esperado));
assert.equal(trilha.recordes.solo, 88);
assert.ok(trilha.insignias.some((i) => i.id === 'poupador'));
assert.ok((await (await http(a, '/api/eu')).json()).insignias.includes('poupador'), '/api/eu traz as insígnias');
console.log('jogo sozinho, desafio do dia e Minha trilha ok');

// ---------- Etapa 4: código de recuperação, responsável, quadro de recordes e contador ----------
const gerado = await (await http(a, '/api/recuperacao', {})).json();
assert.equal(gerado.palavras.length, 6);
assert.equal((await http({ cookie: '' }, '/api/recuperar', { palavras: 'onca onca onca onca onca onca' })).status, 400, 'código errado');
assert.equal((await http({ cookie: '' }, '/api/recuperar', { palavras: 'lixo' })).status, 400);
const antigoCookie = a.cookie;
const rec = await http({ cookie: '' }, '/api/recuperar', { palavras: gerado.palavras.join('  ').toUpperCase() });
assert.equal(rec.status, 200, 'maiúsculas e espaços a mais não atrapalham');
const novoCookie = rec.headers.get('set-cookie').split(';')[0];
assert.notEqual(novoCookie, antigoCookie);
const eu2 = await (await http({ cookie: novoCookie }, '/api/eu')).json();
assert.equal(eu2.jogador.apelido, 'Ana');
assert.ok(eu2.insignias.includes('poupador'), 'as insígnias voltam com a conta');
assert.equal((await (await http({ cookie: antigoCookie }, '/api/eu')).json()).jogador.apelido, 'Ana', 'o aparelho antigo continua conectado');
a.cookie = novoCookie;
const gerado2 = await (await http(a, '/api/recuperacao', {})).json();
assert.equal((await http({ cookie: '' }, '/api/recuperar', { palavras: gerado.palavras.join(' ') })).status, 400, 'um código novo invalida o anterior');
const rec2 = await http({ cookie: '' }, '/api/recuperar', { palavras: gerado2.palavras.join(' ') });
assert.equal(rec2.status, 200);
a.cookie = rec2.headers.get('set-cookie').split(';')[0]; // cada recuperação abre uma sessão nova neste aparelho
console.log('código de recuperação ok');

// ---------- Conta do responsável ----------
const sem = { cookie: '' };
for (const [caminho, corpo] of [['/api/eu', { apelido: 'Teo', ficha: 'f01' }], ['/api/salas', { rodadas: 8 }], ['/api/minha-trilha'], ['/api/recordes'], [`/api/desafio/ranking?dia=${hoje}`], ['/api/conta'], ['/api/recuperacao', {}]]) {
  assert.equal((await http(sem, caminho, corpo)).status, 401, `sem conta: ${caminho}`);
}
assert.equal((await fetch(`${BASE}/api/conta/codigo`, post({ email: emailDe('teo') }))).status, 400, 'sem declarar maioridade');
assert.equal((await fetch(`${BASE}/api/conta/codigo`, post({ email: 'isso-nao-e-email', maior: true }))).status, 400);
const pedido = await fetch(`${BASE}/api/conta/codigo`, post({ email: emailDe('teo'), maior: true }));
assert.equal(pedido.status, 200);
assert.match((await pedido.json()).email, /^t\*\*\*@exemplo\.com\.br$/, 'o e-mail só volta mascarado');
assert.equal((await fetch(`${BASE}/api/conta/codigo`, post({ email: emailDe('teo'), maior: true }))).status, 429, 'um código de cada vez');
const codTeo = await codigoDe(emailDe('teo'));
const errado = codTeo === '000000' ? '111111' : '000000';
assert.equal((await fetch(`${BASE}/api/conta/entrar`, post({ email: emailDe('teo'), codigo: errado, maior: true, apelido: 'Teo', ficha: 'f02' }))).status, 400, 'código errado');
assert.equal((await fetch(`${BASE}/api/conta/entrar`, post({ email: emailDe('teo'), codigo: codTeo, maior: true, apelido: 'merda', ficha: 'f02' }))).status, 400, 'apelido proibido');
assert.equal((await fetch(`${BASE}/api/conta/entrar`, post({ email: emailDe('teo'), codigo: codTeo, maior: true, apelido: 'Teo', ficha: 'f02', nivel: 'mestre' }))).status, 400, 'nível desconhecido');
const teo = await fetch(`${BASE}/api/conta/entrar`, post({ email: emailDe('teo'), codigo: codTeo, maior: true, apelido: 'Teo', ficha: 'f02', nivel: 'lobinho' }));
assert.equal(teo.status, 200, 'o código continua valendo depois de corrigir o apelido e o nível');
const teoJson = await teo.json();
assert.equal(teoJson.jogador.apelido, 'Teo');
assert.equal(teoJson.jogador.nivel, 'lobinho', 'o primeiro perfil nasce com o nível escolhido');
assert.equal((await fetch(`${BASE}/api/conta/entrar`, post({ email: emailDe('teo'), codigo: codTeo, maior: true, apelido: 'Teo', ficha: 'f02' }))).status, 400, 'o código vale uma vez');

// Entrar de novo com o e-mail, em outro aparelho: é a mesma conta, com as insígnias, e o aparelho
// antigo continua conectado.
await espera(2100);
assert.equal((await fetch(`${BASE}/api/conta/codigo`, post({ email: a.email, maior: true }))).status, 200);
const deNovo = await fetch(`${BASE}/api/conta/entrar`, post({ email: a.email, codigo: await codigoDe(a.email), maior: true, apelido: 'Outro', ficha: 'f05' }));
assert.equal(deNovo.status, 200);
const contaA = await deNovo.json();
assert.equal(contaA.jogador.apelido, 'Ana', 'conta existente: o apelido do pedido é ignorado');
assert.ok(contaA.insignias.includes('poupador'));
const aparelhoAntigo = { cookie: a.cookie };
a.cookie = deNovo.headers.get('set-cookie').split(';')[0];
assert.equal((await (await http(a, '/api/eu')).json()).jogador.apelido, 'Ana');
assert.equal((await (await http(aparelhoAntigo, '/api/eu')).json()).jogador.apelido, 'Ana', 'o aparelho antigo continua conectado');
console.log('entrar e criar a conta pelo e-mail ok');

// ---------- Perfis (como num serviço de streaming) ----------
assert.equal((await http(a, '/api/perfis', { apelido: 'merda', ficha: 'f02' })).status, 400, 'apelido proibido');
assert.equal((await http(a, '/api/perfis', { apelido: 'Cris', ficha: 'f02', nivel: 'mestre' })).status, 400, 'nível desconhecido');
const comBia = await (await http(a, '/api/perfis', { apelido: 'Bia', ficha: 'f02', nivel: 'lobinho' })).json();
assert.equal(comBia.perfil.apelido, 'Bia', 'o perfil novo fica escolhido neste aparelho');
assert.deepEqual(comBia.perfis.map((x) => x.nivel), ['escoteiro', 'lobinho'], 'sem escolher, o perfil é Escoteiro em diante');
assert.equal((await (await http(a, '/api/eu')).json()).jogador.nivel, 'lobinho');
assert.equal((await http(a, '/api/eu', { apelido: 'Bia', ficha: 'f02', nivel: 'mestre' })).status, 400, 'nível desconhecido ao editar');
assert.equal((await (await http(a, '/api/eu', { apelido: 'Bia', ficha: 'f02', nivel: 'escoteiro' })).json()).jogador.nivel, 'escoteiro', 'o nível muda no perfil');
assert.equal((await (await http(a, '/api/eu', { apelido: 'Bia', ficha: 'f02' })).json()).jogador.nivel, 'escoteiro', 'sem o campo, o nível fica como está');
assert.equal((await (await http(a, '/api/eu', { apelido: 'Bia', ficha: 'f02', nivel: 'lobinho' })).json()).jogador.nivel, 'lobinho');
assert.deepEqual(comBia.perfis.map((x) => x.apelido), ['Ana', 'Bia']);
const idAna = comBia.perfis[0].id, idBia = comBia.perfil.id;
assert.deepEqual(comBia.perfis.map((x) => x.pontuacao), [true, false], 'a tela sabe quais perfis têm pontuação');
assert.equal((await (await http(aparelhoAntigo, '/api/eu')).json()).jogador.apelido, 'Ana', 'cada aparelho fica com o seu perfil');
assert.equal((await (await http(a, '/api/minha-trilha')).json()).partidas.length, 0, 'o perfil novo começa sem partidas');
assert.equal((await http(a, '/api/perfis/escolher', { id: crypto.randomUUID() })).status, 404);
assert.equal((await http(b, '/api/perfis/escolher', { id: idAna })).status, 404, 'perfil de outra conta');
await espera(2100);
assert.equal((await fetch(`${BASE}/api/conta/codigo`, post({ email: a.email, maior: true }))).status, 200);
const terceiro = await fetch(`${BASE}/api/conta/entrar`, post({ email: a.email, codigo: await codigoDe(a.email), maior: true }));
const tj = await terceiro.json();
assert.equal(tj.perfil, null, 'com mais de um perfil, o aparelho novo pergunta quem vai jogar');
const aparelho3 = { cookie: terceiro.headers.get('set-cookie').split(';')[0] };
const eu3 = await (await http(aparelho3, '/api/eu')).json();
assert.deepEqual([eu3.conta, eu3.jogador], [true, null]);
assert.equal((await http(aparelho3, '/api/salas', { rodadas: 8 })).status, 401, 'sem perfil escolhido não joga');
assert.equal((await (await http(aparelho3, '/api/perfis/escolher', { id: idBia })).json()).perfil.apelido, 'Bia');
for (let i = 0; i < 4; i++) assert.equal((await http(aparelho3, '/api/perfis', { apelido: `Extra ${i}`, ficha: 'f03' })).status, 200);
assert.equal((await http(aparelho3, '/api/perfis', { apelido: 'Sobrando', ficha: 'f03' })).status, 409, 'no máximo 6 perfis');

// O mesmo perfil joga em um aparelho por vez: o aparelho novo assume e o antigo sai da sala, sem sair da conta.
await http(aparelho3, '/api/perfis/escolher', { id: idBia });
const salaBia = (await (await http(aparelho3, '/api/salas', { rodadas: 8 })).json()).codigo;
const biaA = { cookie: aparelho3.cookie }, biaB = { cookie: a.cookie };
await conectar(biaA); send(biaA, { t: 'entrar', codigo: salaBia });
await ate(() => biaA.estado?.eu);
assert.equal((await http(a, '/api/perfis/apagar', { id: idBia, confirmo: true })).status, 409, 'perfil com partida em andamento');
await conectar(biaB);
await ate(() => biaA.msgs.some((m) => m.t === 'outro_aparelho'));
send(biaB, { t: 'entrar', codigo: salaBia });
await ate(() => biaB.estado?.eu);
assert.equal(biaB.estado.placar.length, 1, 'é a mesma Bia, não uma jogadora nova na sala');
assert.equal((await (await http(biaA, '/api/eu')).json()).jogador.apelido, 'Bia', 'o aparelho antigo continua na conta');
send(biaB, { t: 'encerrar' });
await ate(() => biaB.estado.sala.status === 'encerrada');
biaB.ws.close();

// Apagar um perfil: leva as partidas dele, e a conta continua com os outros. Perfil sem pontuação sai
// com a confirmação na tela; com pontuação, só com o código enviado ao e-mail da conta.
const semExtras = await (await http(aparelho3, '/api/conta')).json();
for (const x of semExtras.perfis.filter((y) => y.apelido.startsWith('Extra'))) {
  assert.equal((await http(aparelho3, '/api/perfis/apagar', { id: x.id, confirmo: true })).status, 200);
}
const pedeCodigo = await http(aparelho3, '/api/perfis/apagar', { id: idBia, confirmo: true });
assert.equal(pedeCodigo.status, 403, 'a Bia jogou numa sala: tem pontuação');
assert.equal((await pedeCodigo.json()).precisaCodigo, true);
assert.equal((await http(aparelho3, '/api/conta/codigo-apagar', { acao: 'apagar_perfil', id: crypto.randomUUID() })).status, 404);
assert.equal((await http(aparelho3, '/api/conta/codigo-apagar', { acao: 'apagar_perfil', id: idBia })).status, 200);
const codBia = await codigoDe(a.email);
assert.match(codBia, /^\d{6}$/, 'o código vai para o e-mail da conta');
assert.equal((await http(aparelho3, '/api/perfis/apagar', { id: idBia, confirmo: true, codigo: codBia === '000000' ? '111111' : '000000' })).status, 400, 'código errado');
assert.equal((await http(aparelho3, '/api/perfis/apagar', { id: idAna, confirmo: true, codigo: codBia })).status, 400, 'o código da Bia não apaga a Ana');
const semBiaResp = await http(aparelho3, '/api/perfis/apagar', { id: idBia, confirmo: true, codigo: codBia });
assert.equal(semBiaResp.status, 200);
const semBia = await semBiaResp.json();
assert.deepEqual(semBia.perfis.map((x) => x.apelido), ['Ana']);
assert.equal(semBia.perfil, null, 'o aparelho que estava com a Bia volta para a escolha');
assert.equal((await (await http(a, '/api/eu')).json()).jogador, null, 'outro aparelho com a Bia também');
await http(a, '/api/perfis/escolher', { id: idAna });
console.log('perfis e um aparelho por vez ok');

// Quadro de recordes: o responsável escolhe, e o quadro nunca mostra e-mail.
const naLista = async () => (await (await http(a, '/api/recordes')).json()).solo.some((x) => x.apelido === 'Ana');
assert.equal(await naLista(), false, 'fora do quadro até o responsável escolher');
assert.equal((await http(a, '/api/conta/quadro', { sim: 'talvez' })).status, 400);
assert.equal((await http(a, '/api/conta/quadro', { sim: true })).status, 200);
assert.equal(await naLista(), true);
assert.ok(!JSON.stringify(await (await http(a, '/api/recordes')).json()).includes('exemplo.com.br'), 'o quadro nunca mostra e-mail');
assert.equal((await (await http(a, '/api/conta')).json()).perfil.noQuadro, true);
assert.equal((await http(a, '/api/conta/quadro', { sim: false })).status, 200);
assert.equal(await naLista(), false, 'saiu do quadro');
console.log('quadro de recordes por escolha do responsável ok');

// Trocar o e-mail: só vale depois de confirmar o código que chegou no e-mail novo.
assert.equal((await http(a, '/api/conta/email', { email: b.email })).status, 409, 'e-mail de outra conta');
const novoEmail = emailDe('ana-nova');
assert.equal((await http(a, '/api/conta/email', { email: novoEmail })).status, 200);
const codTroca = await codigoDe(novoEmail);
assert.equal((await http(a, '/api/conta/email/confirmar', { codigo: codTroca === '000000' ? '111111' : '000000' })).status, 400);
assert.equal((await http(b, '/api/conta/email/confirmar', { codigo: codTroca })).status, 400, 'o código é de quem pediu');
assert.equal((await http(a, '/api/conta/email/confirmar', { codigo: codTroca })).status, 200);
assert.match((await (await http(a, '/api/conta')).json()).conta.email, /^a\*\*\*@exemplo\.com\.br$/);
assert.equal((await fetch(`${BASE}/api/conta/codigo`, post({ email: novoEmail, maior: true }))).status, 200);
const comNovo = await fetch(`${BASE}/api/conta/entrar`, post({ email: novoEmail, codigo: await codigoDe(novoEmail), maior: true }));
assert.equal((await comNovo.json()).jogador.apelido, 'Ana', 'o e-mail novo entra na mesma conta');
a.cookie = comNovo.headers.get('set-cookie').split(';')[0];
console.log('trocar o e-mail ok');

// Sair deste aparelho: só esta sessão acaba; a conta e os outros aparelhos continuam.
const saiu = await fetch(`${BASE}/api/conta/sair`, post({}, a.cookie));
assert.equal(saiu.status, 200);
assert.match(saiu.headers.get('set-cookie'), /mt_token=;/, 'o cookie é apagado');
assert.equal((await (await http(a, '/api/eu')).json()).jogador, null, 'o cookie deste aparelho não entra mais');
assert.equal((await (await http(aparelhoAntigo, '/api/eu')).json()).jogador.apelido, 'Ana', 'os outros aparelhos continuam');
console.log('sair do aparelho ok');

// Apagar a conta: não dá com partida em andamento numa sala aberta; depois, apaga tudo.
const lia = await novoJogador('Lia', 'f04');
const salaLia = (await (await fetch(`${BASE}/api/salas`, post({ rodadas: 8 }, lia.cookie))).json()).codigo;
await conectar(lia); send(lia, { t: 'entrar', codigo: salaLia });
await ate(() => lia.estado?.eu);
assert.equal((await http(lia, '/api/conta/apagar', {})).status, 400, 'precisa confirmar');
assert.equal((await http(lia, '/api/conta/apagar', { confirmo: true })).status, 409, 'partida em andamento');
send(lia, { t: 'encerrar' });
await ate(() => lia.estado.sala.status === 'encerrada');
await http(lia, '/api/solo', { ...solo, id: crypto.randomUUID() });
assert.equal((await http(lia, '/api/conta/apagar', { confirmo: true })).status, 403, 'conta com pontuação pede o código');
assert.equal((await http(lia, '/api/conta/codigo-apagar', { acao: 'apagar_conta' })).status, 200);
const codLia = await codigoDe(lia.email);
assert.equal((await http(lia, '/api/conta/apagar', { confirmo: true, codigo: codLia === '000000' ? '111111' : '000000' })).status, 400);
assert.equal((await http(lia, '/api/conta/apagar', { confirmo: true, codigo: codLia })).status, 200);
assert.equal((await (await http(lia, '/api/eu')).json()).conta, false, 'a conta sumiu');
await espera(2100);
assert.equal((await fetch(`${BASE}/api/conta/codigo`, post({ email: lia.email, maior: true }))).status, 200);
const liaNova = await (await fetch(`${BASE}/api/conta/entrar`, post({ email: lia.email, codigo: await codigoDe(lia.email), maior: true, apelido: 'Lia Nova', ficha: 'f04' }))).json();
assert.equal(liaNova.jogador.apelido, 'Lia Nova', 'o mesmo e-mail cria uma conta nova, vazia');
assert.deepEqual(liaNova.insignias, []);
lia.ws.close();
console.log('apagar a conta ok');

assert.equal((await fetch(`${BASE}/api/contador`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ inicio: 2, fim: 1 }) })).status, 200);
assert.equal((await fetch(`${BASE}/api/contador`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ inicio: 999 }) })).status, 400);
console.log('contador anônimo ok');

// Link do Trilha HUB
const red = await fetch(`${BASE}/r/resultado`, { redirect: 'manual' });
assert.equal(red.status, 302);
assert.match(red.headers.get('location'), /utm_content=resultado/);
console.log('link UTM ok');

for (const j of [a, b, c, d]) j.ws.close();
console.log('TUDO OK');
