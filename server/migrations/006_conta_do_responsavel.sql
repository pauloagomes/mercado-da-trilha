-- A conta passa a ser do responsável: um adulto entra ou cria a conta com o próprio e-mail,
-- confirmado por código, e a criança joga dentro dela. Sem conta, só o jogo sozinho no aparelho.

-- O quadro de recordes vira uma escolha do responsável. Quem já tinha confirmado o e-mail
-- fez isso justamente para entrar no quadro, então continua nele.
ALTER TABLE responsaveis ADD COLUMN no_quadro boolean NOT NULL DEFAULT false;
UPDATE responsaveis SET no_quadro = true;

-- Quando o responsável declarou ter 18 anos ou mais e responder pela criança.
ALTER TABLE responsaveis ADD COLUMN declarou_maior_em timestamptz;

-- O e-mail é o login: um e-mail, uma conta. Se o mesmo e-mail confirmou mais de um jogador,
-- fica a confirmação mais recente.
DELETE FROM responsaveis r USING responsaveis o
 WHERE r.email = o.email AND (r.confirmado_em, r.jogador_id) < (o.confirmado_em, o.jogador_id);
CREATE UNIQUE INDEX responsaveis_email ON responsaveis (email);

-- Código para entrar ou criar a conta. Ainda não há jogador: o código é do e-mail.
CREATE TABLE codigos_entrada (
  id           bigserial PRIMARY KEY,
  email        text NOT NULL,
  codigo_hash  text NOT NULL,
  expira_em    timestamptz NOT NULL,
  tentativas   smallint NOT NULL DEFAULT 0,
  usado        boolean NOT NULL DEFAULT false,
  criado_em    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX codigos_entrada_por_email ON codigos_entrada (email, criado_em DESC);

-- Apagar a conta de quem criou uma sala não pode falhar: a sala antiga fica sem anfitrião.
ALTER TABLE salas DROP CONSTRAINT salas_anfitriao_id_fkey;
ALTER TABLE salas ADD CONSTRAINT salas_anfitriao_id_fkey
  FOREIGN KEY (anfitriao_id) REFERENCES jogadores(id) ON DELETE SET NULL;
