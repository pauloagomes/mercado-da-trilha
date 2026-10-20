-- Mercado da Trilha — estrutura inicial

CREATE TABLE jogadores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash  text NOT NULL UNIQUE,
  apelido     text NOT NULL CHECK (char_length(apelido) BETWEEN 2 AND 20),
  ficha       text NOT NULL,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE salas (
  codigo            char(5) PRIMARY KEY,
  tipo              text NOT NULL CHECK (tipo IN ('codigo', 'espera')),
  status            text NOT NULL CHECK (status IN ('aberta', 'em_jogo', 'encerrada')),
  anfitriao_id      uuid REFERENCES jogadores(id),
  rodadas           smallint NOT NULL CHECK (rodadas IN (8, 12, 16)),
  semente           integer NOT NULL,
  rodada_sync       smallint NOT NULL DEFAULT 1,
  criada_em         timestamptz NOT NULL DEFAULT now(),
  ultima_atividade  timestamptz NOT NULL DEFAULT now(),
  encerrada_em      timestamptz
);
CREATE INDEX salas_abertas ON salas (status, ultima_atividade);

CREATE TABLE participacoes (
  id             bigserial PRIMARY KEY,
  sala_codigo    char(5) NOT NULL REFERENCES salas(codigo) ON DELETE CASCADE,
  jogador_id     uuid NOT NULL REFERENCES jogadores(id) ON DELETE CASCADE,
  ordem          smallint NOT NULL,
  cor            text NOT NULL,
  rodada         smallint NOT NULL DEFAULT 0,
  posicao        smallint NOT NULL DEFAULT 0,
  saldo_bc       integer NOT NULL,
  kit            jsonb NOT NULL DEFAULT '[]',
  pontos         integer NOT NULL DEFAULT 0,
  estado         jsonb NOT NULL,
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sala_codigo, jogador_id)
);

CREATE TABLE movimentos (
  id               bigserial PRIMARY KEY,
  participacao_id  bigint NOT NULL REFERENCES participacoes(id) ON DELETE CASCADE,
  tipo             text NOT NULL CHECK (tipo IN ('compra', 'credito', 'pedagio')),
  valor_bc         integer NOT NULL,
  saldo_depois     integer NOT NULL,
  descricao        text NOT NULL,
  criado_em        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE jogadas (
  id           bigserial PRIMARY KEY,
  sala_codigo  char(5) NOT NULL REFERENCES salas(codigo) ON DELETE CASCADE,
  jogador_id   uuid NOT NULL REFERENCES jogadores(id) ON DELETE CASCADE,
  rodada       smallint NOT NULL,
  dado         smallint,
  casa         text NOT NULL,
  criado_em    timestamptz NOT NULL DEFAULT now()
);

-- Cliques nos links do Trilha HUB, contados por tela e dia, sem identificar o jogador.
CREATE TABLE cliques (
  slot   text NOT NULL,
  dia    date NOT NULL DEFAULT current_date,
  total  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (slot, dia)
);
