-- Perfis como num serviço de streaming: a conta é do responsável (um e-mail) e tem vários perfis,
-- um para cada criança. Cada aparelho tem a sua sessão: entrar num aparelho não desconecta os outros.

-- A conta do responsável.
CREATE TABLE contas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              text NOT NULL UNIQUE,
  declarou_maior_em  timestamptz,
  confirmado_em      timestamptz NOT NULL DEFAULT now(),
  criado_em          timestamptz NOT NULL DEFAULT now()
);

-- Cada jogador passa a ser um perfil de uma conta. O quadro de recordes é escolha por perfil.
ALTER TABLE jogadores ADD COLUMN conta_id uuid REFERENCES contas(id) ON DELETE CASCADE;
ALTER TABLE jogadores ADD COLUMN no_quadro boolean NOT NULL DEFAULT false;
CREATE INDEX jogadores_por_conta ON jogadores (conta_id);

-- Quem já tinha responsável vira uma conta com um perfil.
INSERT INTO contas (email, declarou_maior_em, confirmado_em)
  SELECT email, declarou_maior_em, confirmado_em FROM responsaveis;
UPDATE jogadores j SET conta_id = c.id, no_quadro = r.no_quadro
  FROM responsaveis r JOIN contas c ON c.email = r.email
 WHERE r.jogador_id = j.id;

-- Sessão de cada aparelho: o cookie aponta para a conta e para o perfil escolhido no aparelho.
CREATE TABLE sessoes (
  id          bigserial PRIMARY KEY,
  token_hash  text NOT NULL UNIQUE,
  conta_id    uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  perfil_id   uuid REFERENCES jogadores(id) ON DELETE SET NULL,
  criado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessoes_por_conta ON sessoes (conta_id);

-- Os aparelhos que já estavam conectados continuam, com o perfil que tinham.
INSERT INTO sessoes (token_hash, conta_id, perfil_id)
  SELECT token_hash, conta_id, id FROM jogadores WHERE conta_id IS NOT NULL;

-- O token em jogadores fica só para quem jogou antes da conta do responsável (vira conta ao entrar).
ALTER TABLE jogadores ALTER COLUMN token_hash DROP NOT NULL;
UPDATE jogadores SET token_hash = NULL WHERE conta_id IS NOT NULL;

-- A troca de e-mail agora é da conta. Os códigos pendentes valem 15 minutos e podem ser descartados.
DROP TABLE codigos_email;
CREATE TABLE codigos_email (
  id           bigserial PRIMARY KEY,
  conta_id     uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  email        text NOT NULL,
  codigo_hash  text NOT NULL,
  expira_em    timestamptz NOT NULL,
  tentativas   smallint NOT NULL DEFAULT 0,
  usado        boolean NOT NULL DEFAULT false,
  criado_em    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX codigos_email_por_email ON codigos_email (email, criado_em);
CREATE INDEX codigos_email_por_conta ON codigos_email (conta_id, criado_em DESC);

DROP TABLE responsaveis;
