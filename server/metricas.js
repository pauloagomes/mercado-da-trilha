// Métricas de uso do RFC, direto do banco: npm run metricas
// (DATABASE_URL como no servidor). Não mostra nenhum dado pessoal.
import { pool } from './db.js';

const pct = (v) => (v == null ? 'sem dado' : `${(v * 100).toFixed(1)}%`);
const um = async (sql) => (await pool.query(sql)).rows[0];

// Uma linha por partida terminada: quem jogou e quando acabou, venha de sala, do jogo sozinho ou do desafio.
const FIM = `
  SELECT p.jogador_id, p.atualizado_em AS quando FROM participacoes p WHERE (p.estado->>'fim')::boolean
  UNION ALL SELECT jogador_id, criada_em FROM partidas_solo
  UNION ALL SELECT jogador_id, enviado_em FROM desafios_dia`;

try {
  const salas = await um("SELECT count(*) FILTER (WHERE (estado->>'fim')::boolean)::float AS fim, count(*)::float AS total FROM participacoes");
  const solo = await um("SELECT coalesce(sum(total) FILTER (WHERE evento = 'fim'), 0)::float AS fim, coalesce(sum(total) FILTER (WHERE evento = 'inicio'), 0)::float AS inicio FROM contador_solo");
  const terminadas = { salas: salas.total ? salas.fim / salas.total : null, solo: solo.inicio ? solo.fim / solo.inicio : null,
    todas: salas.total + solo.inicio ? (salas.fim + solo.fim) / (salas.total + solo.inicio) : null };

  const nova = await um(`WITH fins AS (${FIM}), prox AS (SELECT quando, lead(quando) OVER (PARTITION BY jogador_id ORDER BY quando) AS prox FROM fins)
    SELECT count(*) FILTER (WHERE prox - quando <= interval '10 minutes')::float / NULLIF(count(*), 0) AS v, count(*) AS n FROM prox`);

  const voltam = await um(`WITH fins AS (${FIM}),
    dias AS (SELECT jogador_id, (quando AT TIME ZONE 'America/Sao_Paulo')::date AS dia FROM fins GROUP BY 1, 2),
    prim AS (SELECT jogador_id, min(dia) AS d0 FROM dias GROUP BY 1)
    SELECT count(*) FILTER (WHERE EXISTS (SELECT 1 FROM dias d WHERE d.jogador_id = p.jogador_id AND d.dia > p.d0 AND d.dia <= p.d0 + 7))::float / NULLIF(count(*), 0) AS v, count(*) AS n
      FROM prim p WHERE p.d0 <= (now() AT TIME ZONE 'America/Sao_Paulo')::date - 7`);

  const rodada = await um(`WITH g AS (SELECT extract(epoch FROM lead(j.criado_em) OVER (PARTITION BY j.sala_codigo, j.jogador_id ORDER BY j.rodada) - j.criado_em) AS s
      FROM jogadas j JOIN salas s ON s.codigo = j.sala_codigo WHERE s.tipo = 'espera')
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY s) AS mediana, count(*) AS n FROM g WHERE s BETWEEN 1 AND 120`);

  const linhas = [
    ['Partidas terminadas, das iniciadas', pct(terminadas.todas), '75% ou mais', `salas ${pct(terminadas.salas)} · solo ${pct(terminadas.solo)} (contador anônimo)`],
    ['Nova partida até 10 min depois de terminar', pct(nova.v), '35% ou mais', `${nova.n} partidas terminadas`],
    ['Jogadores que voltam em 7 dias', pct(voltam.v), '20% ou mais', `${voltam.n} jogadores com 7 dias de histórico`],
    ['Duração da rodada na sala de espera', rodada.mediana == null ? 'sem dado' : `${Number(rodada.mediana).toFixed(1)} s`, '15 a 25 s', `mediana de ${rodada.n} jogadas`],
  ];
  console.log('Métrica'.padEnd(46), 'Agora'.padEnd(10), 'Meta'.padEnd(14), 'Base');
  for (const [m, v, meta, base] of linhas) console.log(m.padEnd(46), v.padEnd(10), meta.padEnd(14), base);
} finally {
  await pool.end();
}
