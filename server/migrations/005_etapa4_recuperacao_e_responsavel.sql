-- Etapa 4 do RFC: missão da sala, código de recuperação, e-mail do responsável confirmado
-- por código (para o quadro de recordes) e contador anônimo do jogo sozinho.

-- {id, vencedor}: a missão sai da semente; o vencedor (id do jogador) fica gravado
ALTER TABLE salas ADD COLUMN missao jsonb;

CREATE TABLE config (
  chave  text PRIMARY KEY,
  valor  text NOT NULL
);

-- Código de recuperação de 6 palavras. Só o HMAC fica no banco; as palavras aparecem uma vez, na tela.
CREATE TABLE recuperacao (
  jogador_id   uuid PRIMARY KEY REFERENCES jogadores(id) ON DELETE CASCADE,
  codigo_hmac  text NOT NULL UNIQUE,
  criado_em    timestamptz NOT NULL DEFAULT now()
);

-- O único dado pessoal do jogo: o e-mail de quem responde pela criança, só para o quadro de recordes.
CREATE TABLE responsaveis (
  jogador_id     uuid PRIMARY KEY REFERENCES jogadores(id) ON DELETE CASCADE,
  email          text NOT NULL,
  confirmado_em  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE codigos_email (
  id          bigserial PRIMARY KEY,
  jogador_id  uuid NOT NULL REFERENCES jogadores(id) ON DELETE CASCADE,
  email       text NOT NULL,
  codigo_hash text NOT NULL,
  expira_em   timestamptz NOT NULL,
  tentativas  smallint NOT NULL DEFAULT 0,
  usado       boolean NOT NULL DEFAULT false,
  criado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX codigos_email_por_email ON codigos_email (email, criado_em);
CREATE INDEX codigos_email_por_jogador ON codigos_email (jogador_id, criado_em DESC);

-- Partidas do jogo sozinho, contadas por dia, sem identificar ninguém.
CREATE TABLE contador_solo (
  dia     date NOT NULL,
  evento  text NOT NULL CHECK (evento IN ('inicio', 'fim')),
  total   integer NOT NULL DEFAULT 0,
  PRIMARY KEY (dia, evento)
);
