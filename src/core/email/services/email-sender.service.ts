/**
 * Email Sender Service
 * Handles sending emails with multiple adapter implementations
 * Development: Mock email sender (logs to console)
 * Production: SendGrid integration (Phase 3F.4+)
 * Phase 3F.4: Email verification system
 */

export interface EmailPayload {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
}

export interface EmailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Email sender port (interface for implementations)
 */
export interface EmailSenderPort {
  send(payload: EmailPayload): Promise<EmailResult>;
}

/**
 * Mock Email Sender - Development only
 * Logs emails to console instead of sending
 * Useful for testing without SendGrid
 */
export class MockEmailSender implements EmailSenderPort {
  async send(payload: EmailPayload): Promise<EmailResult> {
    console.log('\n' + '='.repeat(80));
    console.log('📧 [MockEmailSender] Email would be sent:');
    console.log('─'.repeat(80));
    console.log(`To: ${payload.to}`);
    console.log(`Subject: ${payload.subject}`);
    console.log('─'.repeat(80));
    console.log('HTML Body:');
    console.log(payload.htmlBody);
    console.log('─'.repeat(80));
    if (payload.textBody) {
      console.log('Text Body:');
      console.log(payload.textBody);
      console.log('─'.repeat(80));
    }
    console.log('='.repeat(80) + '\n');

    return {
      ok: true,
      messageId: `mock-${Date.now()}`,
    };
  }
}

/**
 * SendGrid Email Sender - Production
 * Requires SENDGRID_API_KEY environment variable
 * TODO: Implement in Phase 3F.4+
 */
export class SendGridEmailSender implements EmailSenderPort {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env['SENDGRID_API_KEY'] || '';
    if (!this.apiKey) {
      console.warn('[SendGrid] ⚠️ SENDGRID_API_KEY not set. Emails will not be sent.');
    }
  }

  async send(payload: EmailPayload): Promise<EmailResult> {
    try {
      // TODO: Implement SendGrid API call
      // For now, fall back to mock
      console.warn('[SendGrid] SendGrid integration not yet implemented. Using mock sender.');
      const mock = new MockEmailSender();
      return mock.send(payload);
    } catch (error) {
      console.error('[SendGrid] ❌ Error sending email:', error);
      return {
        ok: false,
        error: 'Failed to send email',
      };
    }
  }
}

/**
 * Email Sender Factory
 * Returns appropriate sender based on environment
 */
export function createEmailSender(): EmailSenderPort {
  const nodeEnv = process.env['NODE_ENV'] || 'development';

  if (nodeEnv === 'production' && process.env['SENDGRID_API_KEY']) {
    console.log('[Email] Using SendGrid sender');
    return new SendGridEmailSender();
  }

  console.log('[Email] Using mock sender (development mode)');
  return new MockEmailSender();
}

/**
 * Email template builder
 * Creates formatted HTML/text emails
 */
export class EmailTemplateBuilder {
  /**
   * Build email verification template
   */
  static buildVerificationEmail(userEmail: string, verificationToken: string): EmailPayload {
    const verificationUrl = `${process.env['FRONTEND_URL'] || 'http://localhost:4200'}/verify-email?token=${verificationToken}`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
    .header { background: #000; color: #fff; padding: 20px; text-align: center; }
    .content { background: #fff; padding: 20px; margin: 20px 0; }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background: #000;
      color: #fff;
      text-decoration: none;
      border-radius: 4px;
      margin: 20px 0;
    }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Faded Chapter</h1>
      <p>Verify Your Email</p>
    </div>

    <div class="content">
      <h2>Welcome to Faded Chapter!</h2>
      <p>Thank you for signing up. To complete your registration, please verify your email address by clicking the button below:</p>

      <a href="${verificationUrl}" class="button">Verify Email Address</a>

      <p>Or copy and paste this link in your browser:</p>
      <p><code>${verificationUrl}</code></p>

      <div class="warning">
        <strong>⚠️ This link expires in 24 hours</strong>
      </div>

      <p>If you didn't create this account, you can safely ignore this email.</p>

      <hr />

      <p>
        <strong>Questions?</strong><br />
        Contact us at support@fadedchapter.com
      </p>
    </div>

    <div class="footer">
      <p>&copy; 2024 Faded Chapter. All rights reserved.</p>
      <p><a href="https://fadedchapter.com" style="color: #666;">Visit our website</a></p>
    </div>
  </div>
</body>
</html>
    `;

    const textBody = `
Faded Chapter - Verify Your Email

Welcome! Please verify your email address by visiting this link:

${verificationUrl}

This link expires in 24 hours.

If you didn't create this account, you can safely ignore this email.

---
Questions? Contact support@fadedchapter.com
© 2024 Faded Chapter. All rights reserved.
    `;

    return {
      to: userEmail,
      subject: 'Verify Your Faded Chapter Email',
      htmlBody: htmlBody.trim(),
      textBody: textBody.trim(),
    };
  }

  /**
   * Build password reset template
   * TODO: Phase 3F.5
   */
  static buildPasswordResetEmail(userEmail: string, resetToken: string): EmailPayload {
    const resetUrl = `${process.env['FRONTEND_URL'] || 'http://localhost:4200'}/reset-password?token=${resetToken}`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
    .header { background: #000; color: #fff; padding: 20px; text-align: center; }
    .content { background: #fff; padding: 20px; margin: 20px 0; }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background: #000;
      color: #fff;
      text-decoration: none;
      border-radius: 4px;
      margin: 20px 0;
    }
    .warning { background: #f8d7da; border-left: 4px solid #dc3545; padding: 10px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Faded Chapter</h1>
      <p>Reset Your Password</p>
    </div>

    <div class="content">
      <h2>Password Reset Request</h2>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>

      <a href="${resetUrl}" class="button">Reset Password</a>

      <p>Or copy and paste this link in your browser:</p>
      <p><code>${resetUrl}</code></p>

      <div class="warning">
        <strong>⚠️ Security Notice</strong><br />
        This link expires in 24 hours. If you didn't request this, please ignore this email.
      </div>

      <hr />

      <p>
        <strong>Need help?</strong><br />
        Contact us at support@fadedchapter.com
      </p>
    </div>
  </div>
</body>
</html>
    `;

    return {
      to: userEmail,
      subject: 'Reset Your Faded Chapter Password',
      htmlBody: htmlBody.trim(),
    };
  }
}

// Export singleton sender
export const emailSender = createEmailSender();
