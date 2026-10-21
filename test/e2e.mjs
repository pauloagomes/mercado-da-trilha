// Teste ponta a ponta contra um servidor rodando.
// Uso: CONTAGEM_FILA_MS=1500 RODADA_MS=1500 npm start  (num terminal)
//      node test/e2e.mjs                                 (em outro)
import WebSocket from 'ws';
import assert from 'node:assert/strict';
import * as E from '../public/js/engine.js';
import { ITENS } from '../public/js/engine.js';
import crypto from 'node:crypto';

const BASE = process.env.BASE || 'http://localhost:3000';

async function novoJogador(apelido, ficha) {
  const r = await fetch(`${BASE}/api/eu`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ apelido, ficha }) });
  assert.equal(r.status, 200, await r.clone().text());
  const cookie = r.headers.get('set-cookie').split(';')[0];
  return { apelido, cookie };
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
assert.equal((await (await http({ cookie: antigoCookie }, '/api/eu')).json()).jogador, null, 'o navegador antigo sai');
a.cookie = novoCookie;
const gerado2 = await (await http(a, '/api/recuperacao', {})).json();
assert.equal((await http({ cookie: '' }, '/api/recuperar', { palavras: gerado.palavras.join(' ') })).status, 400, 'um código novo invalida o anterior');
const rec2 = await http({ cookie: '' }, '/api/recuperar', { palavras: gerado2.palavras.join(' ') });
assert.equal(rec2.status, 200);
a.cookie = rec2.headers.get('set-cookie').split(';')[0]; // cada recuperação troca o cookie do aparelho
console.log('código de recuperação ok');

const emailR = 'responsavel@exemplo.com.br';
const sondagem = await fetch(`${BASE}/api/_teste/codigo?email=${emailR}`);
if (sondagem.status === 404) console.log('e-mail do responsável: pulado (suba o servidor com EMAIL_MODO=teste)');
else {
  assert.equal((await http(a, '/api/responsavel', { email: 'isso-nao-e-email' })).status, 400);
  const pedido = await http(a, '/api/responsavel', { email: emailR });
  assert.equal(pedido.status, 200, await pedido.clone().text());
  assert.match((await pedido.json()).email, /^r\*\*\*@exemplo\.com\.br$/, 'o e-mail só volta mascarado');
  assert.equal((await http(a, '/api/responsavel', { email: emailR })).status, 429, 'um código por minuto');
  const codigo = (await (await fetch(`${BASE}/api/_teste/codigo?email=${emailR}`)).json()).codigo;
  assert.match(codigo, /^\d{6}$/);
  assert.equal((await http(a, '/api/responsavel/confirmar', { codigo: codigo === '000000' ? '111111' : '000000' })).status, 400);
  assert.equal((await (await http(a, '/api/responsavel')).json()).confirmado, false, 'sem confirmar não conta');
  assert.equal((await (await fetch(`${BASE}/api/recordes`)).json()).solo.some((x) => x.apelido === 'Ana'), false, 'fora do quadro até confirmar');
  assert.equal((await http(a, '/api/responsavel/confirmar', { codigo })).status, 200);
  assert.equal((await http(a, '/api/responsavel/confirmar', { codigo })).status, 400, 'o código vale uma vez');
  const quadro = await (await fetch(`${BASE}/api/recordes`)).json();
  assert.ok(quadro.solo.some((x) => x.apelido === 'Ana' && x.pontos >= 88), 'Ana entra no quadro depois da confirmação');
  assert.ok(!JSON.stringify(quadro).includes('exemplo.com.br'), 'o quadro nunca mostra e-mail');
  assert.equal((await http(b, '/api/responsavel/confirmar', { codigo })).status, 400, 'o código é de quem pediu');
  assert.equal((await http(a, '/api/responsavel', null)).status, 200);
  assert.equal((await (await http(a, '/api/responsavel')).json()).confirmado, true);
  const saiu = await fetch(`${BASE}/api/responsavel`, { method: 'DELETE', headers: { cookie: a.cookie } });
  assert.equal(saiu.status, 200);
  assert.equal((await (await fetch(`${BASE}/api/recordes`)).json()).solo.some((x) => x.apelido === 'Ana'), false, 'sair do quadro apaga o e-mail');
  console.log('e-mail do responsável e quadro de recordes ok');
}

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
