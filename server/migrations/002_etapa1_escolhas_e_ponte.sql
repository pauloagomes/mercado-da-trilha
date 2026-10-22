-- Etapa 1 do RFC: dado duplo e gratificação viram tipos de movimento, a meta secreta e a
-- rolagem escolhida passam a ser gravadas, e o guardião de cada ponte sobrevive a um reinício.

ALTER TABLE movimentos DROP CONSTRAINT movimentos_tipo_check;
ALTER TABLE movimentos ADD CONSTRAINT movimentos_tipo_check
  CHECK (tipo IN ('compra', 'credito', 'pedagio', 'gratificacao', 'dado_duplo'));

ALTER TABLE participacoes ADD COLUMN meta text;

ALTER TABLE jogadas ADD COLUMN rolagem text CHECK (rolagem IN ('normal', 'duplo', 'ajuda'));

-- casa do tabuleiro -> id do jogador que guarda a ponte
ALTER TABLE salas ADD COLUMN pontes jsonb NOT NULL DEFAULT '{}';
