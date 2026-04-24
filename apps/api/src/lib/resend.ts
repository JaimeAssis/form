import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  // Em desenvolvimento, logar aviso mas não lançar erro
  console.warn('[resend] RESEND_API_KEY não configurado — e-mails não serão enviados')
}

export const resend = new Resend(process.env.RESEND_API_KEY ?? 'dummy')
