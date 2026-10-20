// Apelido: limpeza e bloqueio de palavrões, ofensas e temas impróprios.
// O apelido aparece no placar e no mural para outras crianças, então o servidor recusa o que estiver nas listas.
// Para incluir palavras, escreva em minúsculas e sem acento.

// Bloqueadas quando aparecem como palavra inteira (curtas demais para buscar dentro de outras palavras).
const INTEIRAS = ['cu', 'puta', 'puto', 'viado', 'viada', 'xota', 'cacete', 'corno', 'bixa', 'pqp', 'vsf', 'tnc', 'dick', 'cock', 'ass', 'sexo', 'sexy'];

// Bloqueadas mesmo dentro de outras palavras ou com os caracteres separados ("m.e.r.d.a").
const RAIZES = [
  'porra', 'caralh', 'buceta', 'boceta', 'merda', 'foda', 'foder', 'fodid', 'fodas', 'bosta', 'piroc', 'pirok', 'xoxot',
  'xereca', 'arromb', 'punhet', 'cuzao', 'cuzinh', 'viadinh', 'putaria', 'putinh', 'filhodaput', 'filhadaput', 'fdp',
  'vagabund', 'vadia', 'safad', 'babaca', 'otari', 'imbecil', 'idiota', 'retardad', 'escrot', 'baitola', 'boiola',
  'traveco', 'macumbeir', 'penis', 'vagina', 'peladona', 'porn', 'nazi', 'hitler', 'estupr', 'pedofil',
  'maconh', 'cocaina', 'crack', 'fuck', 'shit', 'bitch', 'pussy', 'nigg', 'whore', 'slut',
];

const NUMEROS = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b' };

// Minúsculas, sem acento e com números trocados pelas letras parecidas ("m3rd4" vira "merda").
const base = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[0134578]/g, (c) => NUMEROS[c]);

export function limparApelido(a) {
  return String(a || '').normalize('NFC').replace(/[^\p{L}\p{N} ._-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20);
}

export function apelidoProibido(apelido) {
  const b = base(apelido);
  // Letras repetidas: até 2 seguidas para as raízes ("porrrra" vira "porra"), 1 para as palavras inteiras ("cuuu" vira "cu").
  const junto = b.replace(/[\s._-]+/g, '').replace(/(.)\1{2,}/g, '$1$1');
  const palavras = b.replace(/(.)\1+/g, '$1').split(/[\s._-]+/);
  return RAIZES.some((r) => junto.includes(r)) || palavras.some((p) => INTEIRAS.includes(p));
}
