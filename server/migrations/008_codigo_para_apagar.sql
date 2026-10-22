-- Apagar pontuação pede o código enviado ao e-mail da conta: apagar um perfil que já tem partidas ou
-- insígnias, ou apagar a conta quando algum perfil tem. Assim uma criança com o aparelho na mão não
-- apaga o progresso de ninguém sem o responsável.
CREATE TABLE codigos_acao (
  id           bigserial PRIMARY KEY,
  conta_id     uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  acao         text NOT NULL CHECK (acao IN ('apagar_perfil', 'apagar_conta')),
  alvo         uuid,                -- o perfil, em apagar_perfil
  codigo_hash  text NOT NULL,
  expira_em    timestamptz NOT NULL,
  tentativas   smallint NOT NULL DEFAULT 0,
  usado        boolean NOT NULL DEFAULT false,
  criado_em    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX codigos_acao_por_conta ON codigos_acao (conta_id, criado_em DESC);
