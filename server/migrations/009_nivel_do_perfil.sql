-- Nível do perfil: define quais cartas saem no baralho (Lobinho ou Escoteiro em diante).
-- É só uma escolha de dificuldade feita pelo responsável, não guarda idade nem data de nascimento.
-- Os perfis que já existiam ficam em "escoteiro", que era a leitura padrão das cartas.
ALTER TABLE jogadores ADD COLUMN nivel text NOT NULL DEFAULT 'escoteiro' CHECK (nivel IN ('lobinho', 'escoteiro'));
