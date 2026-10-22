-- Etapa 2 do RFC: o leilão do Canivete vira tipo de movimento, e os eventos da sala
-- (sorteados ou votados) e os lances do leilão ficam gravados.

ALTER TABLE movimentos DROP CONSTRAINT movimentos_tipo_check;
ALTER TABLE movimentos ADD CONSTRAINT movimentos_tipo_check
  CHECK (tipo IN ('compra', 'credito', 'pedagio', 'gratificacao', 'dado_duplo', 'leilao'));

CREATE TABLE eventos_sala (
  sala_codigo  char(5) NOT NULL REFERENCES salas(codigo) ON DELETE CASCADE,
  rodada       smallint NOT NULL,
  tipo         text NOT NULL,
  loja         text,
  origem       text NOT NULL CHECK (origem IN ('sorteio', 'votacao')),
  PRIMARY KEY (sala_codigo, rodada)
);

CREATE TABLE lances (
  id           bigserial PRIMARY KEY,
  sala_codigo  char(5) NOT NULL REFERENCES salas(codigo) ON DELETE CASCADE,
  rodada       smallint NOT NULL,
  jogador_id   uuid NOT NULL REFERENCES jogadores(id) ON DELETE CASCADE,
  valor_bc     smallint NOT NULL,
  ganhou       boolean NOT NULL DEFAULT false,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sala_codigo, rodada, jogador_id)
);
