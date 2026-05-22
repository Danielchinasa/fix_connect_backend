import { Injectable, Logger } from '@nestjs/common';

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
}

// ─── EmailService ──────────────────────────────────────────────────────────────
// In development, emails are logged to the console so you can see the OTP code
// without needing a real email provider set up.
//
// When you are ready for production, replace the body of sendEmail() with a call
// to nodemailer, SendGrid, Mailgun, etc.  The rest of the codebase never changes.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendEmail(options: SendEmailOptions): Promise<void> {
    // TODO: swap this block for a real transport (nodemailer / SendGrid) in production
    this.logger.log(`📧  To      : ${options.to}`);
    this.logger.log(`📧  Subject : ${options.subject}`);
    this.logger.log(`📧  Body    : ${options.text}`);
  }

  async sendOtp(email: string, code: string, purpose: string): Promise<void> {
    const isVerification = purpose === 'VERIFY_EMAIL';

    const subject = isVerification
      ? 'FixConnect – Email Verification Code'
      : 'FixConnect – Password Reset Code';

    const action = isVerification
      ? 'verify your email address'
      : 'reset your password';

    const text = [
      `Your FixConnect code is: ${code}`,
      '',
      `Use this code to ${action}. It expires in 10 minutes.`,
      '',
      'If you did not request this, please ignore this message.',
    ].join('\n');

    await this.sendEmail({ to: email, subject, text });
  }
}
