// Envio do código de confirmação do e-mail do responsável.
// Nada é enviado sem configuração explícita:
//   SMTP_URL (smtps://usuario:senha@servidor) liga o envio de verdade;
//   EMAIL_MODO=log  escreve o código no log (só para desenvolvimento);
//   EMAIL_MODO=teste  guarda o código na memória, para os testes lerem;
//   sem nada  o recurso fica desligado e a API responde 503.
export const modoEmail = () => process.env.EMAIL_MODO || (process.env.SMTP_URL ? 'smtp' : 'desligado');

const guardados = new Map();
export const codigoDeTeste = (email) => (modoEmail() === 'teste' ? guardados.get(email) : undefined);

let transporte = null;

export async function enviarCodigo(email, codigo, log = console) {
  const modo = modoEmail();
  if (modo === 'desligado') { const e = new Error('O envio de e-mail não está configurado.'); e.codigo = 'EMAIL_DESLIGADO'; throw e; }
  if (modo === 'teste') { guardados.set(email, codigo); return; }
  if (modo === 'log') { log.info?.(`[e-mail de desenvolvimento] código ${codigo} para ${email}`); return; }
  const nodemailer = (await import('nodemailer')).default;
  transporte ||= nodemailer.createTransport(process.env.SMTP_URL);
  await transporte.sendMail({
    from: process.env.EMAIL_DE || 'Mercado da Trilha <nao-responda@mercado.local>',
    to: email,
    subject: 'Seu código do quadro de recordes do Mercado da Trilha',
    text: `Seu código é ${codigo}. Ele vale por 15 minutos.\n\nVocê recebeu este e-mail porque este endereço foi informado como o do responsável por um jogador do Mercado da Trilha, para que ele apareça no quadro de recordes. Se não foi você, ignore esta mensagem: nada será publicado.`,
  });
}
