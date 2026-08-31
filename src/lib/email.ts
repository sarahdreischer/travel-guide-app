import nodemailer from 'nodemailer'

/**
 * Email utility — sends transactional emails.
 *
 * Configuration via environment variables:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * In development without SMTP configured, logs the email to the console
 * and uses nodemailer's Ethereal test account.
 */

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

async function getTransport() {
  const host = process.env.SMTP_HOST
  const port = parseInt(process.env.SMTP_PORT || '587', 10)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    })
  }

  // Fallback: Ethereal test account (emails viewable at ethereal.email)
  const testAccount = await nodemailer.createTestAccount()
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  })
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<void> {
  const from = process.env.SMTP_FROM || 'Trip Guide <noreply@tripguide.app>'
  const transport = await getTransport()

  const info = await transport.sendMail({ from, to, subject, html, text })

  // In dev/test with Ethereal, log the preview URL
  const previewUrl = nodemailer.getTestMessageUrl(info)
  if (previewUrl) {
    console.log('[Email] Preview URL:', previewUrl)
  }
}
