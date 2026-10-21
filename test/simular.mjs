// Mostra as métricas do RFC com o motor atual: npm run simular
import * as E from '../public/js/engine.js';
import { FAIXAS, ETAPA, medirSolo, medirMesa, medirRepeticao, REFERENCIA, ESPERTO, SEM_ESCOLHAS, CUIDADOSO } from './sim.js';

const n = Number(process.env.SIM_PARTIDAS) || 4000;
const pct = (v) => `${(v * 100).toFixed(1)}%`;
const solo = medirSolo(E, { n, politica: REFERENCIA });
const antes = medirSolo(E, { n, politica: SEM_ESCOLHAS });
const esperto = medirSolo(E, { n, politica: ESPERTO });
const cuidadoso = medirSolo(E, { n, politica: CUIDADOSO });
const mesa = medirMesa(E, { n, base: REFERENCIA });
const rep = medirRepeticao(E, { n: Math.min(n, 1500) });
const valores = { semEscolha: solo.semEscolha.toFixed(2), venceQuemSabe: pct(mesa.venceQuemSabe), recusou: pct(solo.recusou) };
const f = (k, [a, b]) => (k === 'semEscolha' ? `${a} a ${b}` : `${pct(a)} a ${pct(b)}`);
console.log(`Etapa ${ETAPA} · ${n} partidas por medida · jogador de referência do RFC\n`);
console.log('Métrica'.padEnd(46), 'Agora'.padEnd(8), 'Faixa da etapa'.padEnd(18), 'Meta de lançamento');
for (const [k, fx] of Object.entries(FAIXAS)) console.log(fx.rotulo.padEnd(46), String(valores[k]).padEnd(8), f(k, fx.etapa).padEnd(18), f(k, fx.lancamento));
console.log('\nAcompanhadas (sem faixa nesta etapa):');
console.log(`  Partidas sem nenhuma comemoração .... ${pct(solo.semComemoracao)} (antes: ${pct(antes.semComemoracao)}) · meta 0% (D6, etapa 2)`);
console.log(`  Cartas já vistas em 3 partidas ...... ${pct(rep)} · meta 15% ou menos (F3, etapa 3)`);
console.log(`  Kit completo ......................... ${pct(solo.kitCompleto)} (antes: ${pct(antes.kitCompleto)})`);
console.log(`  Saldo final médio .................... ${solo.saldoFinal.toFixed(0)} BC (antes: ${antes.saldoFinal.toFixed(0)} BC)`);
console.log(`  Pontos por partida ................... ${solo.pontos.toFixed(1)} (antes: ${antes.pontos.toFixed(1)}; escolhendo bem o dado: ${esperto.pontos.toFixed(1)}; cuidadoso: ${cuidadoso.pontos.toFixed(1)})`);
console.log(`  Dados duplos por partida ............. ${solo.duplos.toFixed(1)}`);
