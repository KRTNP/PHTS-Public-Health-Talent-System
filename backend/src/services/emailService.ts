type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true';

export class EmailService {
  static isEnabled(): boolean {
    return EMAIL_ENABLED;
  }

  static async sendEmail(_message: EmailMessage): Promise<void> {
    if (!EMAIL_ENABLED) {
      return;
    }

    // NOTE: Email delivery is intentionally disabled until SMTP is configured.
    // Planned: use Postal SMTP (self-hosted) with env config below.
    // - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE
    // - SMTP_FROM (e.g., "PHTS Notification <no-reply@hospital.local>")
    //
    // Example implementation (requires nodemailer):
    // const transporter = nodemailer.createTransport({
    //   host: process.env.SMTP_HOST,
    //   port: Number(process.env.SMTP_PORT || 25),
    //   secure: process.env.SMTP_SECURE === 'true',
    //   auth: process.env.SMTP_USER
    //     ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    //     : undefined,
    // });
    // await transporter.sendMail({
    //   from: process.env.SMTP_FROM,
    //   to: message.to,
    //   subject: message.subject,
    //   text: message.text,
    //   html: message.html,
    // });
  }
}
