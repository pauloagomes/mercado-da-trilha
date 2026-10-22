-- Etapa 3 do RFC: patrulhas sorteadas, insígnias, histórico do jogador ("Minha trilha")
-- e o desafio do dia. Os resultados do jogo sozinho sobem quando houver conexão.

ALTER TABLE participacoes ADD COLUMN patrulha smallint;

-- o histórico lê as partidas de um jogador, da mais nova para a mais velha
CREATE INDEX participacoes_por_jogador ON participacoes (jogador_id, atualizado_em DESC);

CREATE TABLE insignias (
  jogador_id  uuid NOT NULL REFERENCES jogadores(id) ON DELETE CASCADE,
  insignia    text NOT NULL,
  ganha_em    timestamptz NOT NULL DEFAULT now(),
  origem      text NOT NULL CHECK (origem IN ('sala', 'solo', 'desafio')),
  PRIMARY KEY (jogador_id, insignia)
);

-- Resultado de uma partida do jogo sozinho, enviado pelo aparelho. O id vem do aparelho,
-- então enviar duas vezes (rede ruim) não duplica.
CREATE TABLE partidas_solo (
  id          uuid PRIMARY KEY,
  jogador_id  uuid NOT NULL REFERENCES jogadores(id) ON DELETE CASCADE,
  pontos      integer NOT NULL CHECK (pontos BETWEEN 0 AND 1000),
  saldo_bc    integer NOT NULL CHECK (saldo_bc BETWEEN 0 AND 300),
  acertos     smallint NOT NULL,
  kit         smallint NOT NULL,
  rodadas     smallint NOT NULL CHECK (rodadas IN (8, 12, 16)),
  posicao     smallint,
  criada_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX partidas_solo_por_jogador ON partidas_solo (jogador_id, criada_em DESC);

-- A primeira tentativa do dia vale para o placar do dia; o servidor repete a partida para conferir.
CREATE TABLE desafios_dia (
  dia         date NOT NULL,
  jogador_id  uuid NOT NULL REFERENCES jogadores(id) ON DELETE CASCADE,
  pontos      integer NOT NULL,
  saldo_bc    integer NOT NULL,
  acertos     smallint NOT NULL,
  kit         smallint NOT NULL,
  enviado_em  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dia, jogador_id)
);
CREATE INDEX desafios_dia_placar ON desafios_dia (dia, pontos DESC, saldo_bc DESC);
