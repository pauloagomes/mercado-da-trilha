// Envio do código que o responsável usa para entrar, criar a conta, trocar o e-mail ou confirmar que quer apagar pontuação.
// Nada é enviado sem configuração explícita:
//   SMTP_URL (smtps://usuario:senha@servidor) liga o envio de verdade;
//   EMAIL_MODO=log  escreve o código no log (só para desenvolvimento);
//   EMAIL_MODO=teste  guarda o código na memória, para os testes lerem;
//   sem nada  o recurso fica desligado e a API responde 503.
export const modoEmail = () => process.env.EMAIL_MODO || (process.env.SMTP_URL ? 'smtp' : 'desligado');

const guardados = new Map();
export const codigoDeTeste = (email) => (modoEmail() === 'teste' ? guardados.get(email) : undefined);

let transporte = null;

// motivo: 'entrar' (entrar, criar a conta ou trocar o e-mail), 'apagar_perfil' (com o apelido) ou 'apagar_conta'.
const TEXTOS = {
  entrar: () => ({
    assunto: (c) => `${c} é o seu código do Mercado da Trilha`,
    corpo: 'Você recebeu este e-mail porque este endereço foi informado para entrar ou criar a conta de responsável no Mercado da Trilha, o jogo de treino do Trilha HUB. A conta é de um adulto, e cada criança joga num perfil dentro dela.\n\nSe não foi você, ignore esta mensagem: sem o código, nenhuma conta é criada ou aberta.',
  }),
  apagar_perfil: (apelido) => ({
    assunto: (c) => `${c}: código para apagar o perfil ${apelido}`,
    corpo: `Alguém pediu para apagar o perfil ${apelido} da sua conta no Mercado da Trilha. Isso apaga para sempre as partidas, as insígnias e o código de recuperação desse perfil.\n\nSe não foi você, ignore esta mensagem: sem o código, nada é apagado.`,
  }),
  apagar_conta: () => ({
    assunto: (c) => `${c}: código para apagar a sua conta do Mercado da Trilha`,
    corpo: 'Alguém pediu para apagar a sua conta no Mercado da Trilha. Isso apaga para sempre o e-mail, todos os perfis, as partidas, as insígnias e os códigos de recuperação.\n\nSe não foi você, ignore esta mensagem: sem o código, nada é apagado.',
  }),
};

export async function enviarCodigo(email, codigo, log = console, { motivo = 'entrar', apelido = '' } = {}) {
  const modo = modoEmail();
  if (modo === 'desligado') { const e = new Error('O envio de e-mail não está configurado.'); e.codigo = 'EMAIL_DESLIGADO'; throw e; }
  if (modo === 'teste') { guardados.set(email, codigo); return; }
  if (modo === 'log') { log.info?.(`[e-mail de desenvolvimento] código ${codigo} para ${email}`); return; }
  const texto = (TEXTOS[motivo] || TEXTOS.entrar)(apelido);
  const nodemailer = (await import('nodemailer')).default;
  transporte ||= nodemailer.createTransport(process.env.SMTP_URL);
  await transporte.sendMail({
    from: process.env.EMAIL_DE || 'Mercado da Trilha <nao-responda@mercado.local>',
    to: email,
    subject: texto.assunto(codigo),
    text: `Seu código é ${codigo}. Ele vale por 15 minutos.\n\n${texto.corpo}`,
  });
}
