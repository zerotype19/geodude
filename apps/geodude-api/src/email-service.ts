/**
 * Email service for sending OTP codes
 * Supports both SMTP (production) and console echo (development)
 */

export interface EmailConfig {
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  fromEmail: string;
  devMode: boolean;
  resendKey?: string; // Added for Resend API
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
  }

  /**
   * Send email via Resend API (production mode)
   */
  private async sendViaResend(options: EmailOptions): Promise<boolean> {
    try {
      console.log(`📧 Sending email via Resend to ${options.to}`);

      // Use Resend's REST API to send emails
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.config.fromEmail,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Email sent successfully via Resend. ID: ${result.id}`);
        return true;
      } else {
        const error = await response.text();
        console.error(`❌ Resend API error: ${response.status} - ${error}`);
        return false;
      }
    } catch (error) {
      console.error('Resend email failed:', error);
      return false;
    }
  }

  /**
   * Send email (Resend API or console echo)
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (this.config.devMode || !this.config.resendKey) {
      return this.echoToConsole(options);
    } else {
      return this.sendViaResend(options);
    }
  }

  /**
   * Echo email to console (development mode)
   */
  private async echoToConsole(options: EmailOptions): Promise<boolean> {
    const divider = '='.repeat(80);

    console.log('\n' + divider);
    console.log('📧 EMAIL WOULD BE SENT (DEV MODE)');
    console.log(divider);
    console.log(`To: ${options.to}`);
    console.log(`From: ${this.config.fromEmail}`);
    console.log(`Subject: ${options.subject}`);
    console.log(divider);
    console.log('HTML Content:');
    console.log(options.html);
    if (options.text) {
      console.log(divider);
      console.log('Text Content:');
      console.log(options.text);
    }
    console.log(divider + '\n');

    return true;
  }

  /**
   * Send Magic Link email
   */
  async sendMagicLinkEmail(email: string, magicLinkUrl: string, expiresInMinutes: number = 15): Promise<boolean> {
    const subject = "Sign in to Optiview";
    const html = this.generateMagicLinkEmailHTML(email, magicLinkUrl, expiresInMinutes);
    const text = this.generateMagicLinkEmailText(email, magicLinkUrl, expiresInMinutes);

    return this.sendEmail({
      to: email,
      subject,
      html,
      text
    });
  }

  /**
   * Generate OTP email HTML content
   */
  generateOTPEmailHTML(email: string, code: string, expiresInMinutes: number = 10): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Optiview Login Code</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .code { font-size: 48px; font-weight: bold; text-align: center; letter-spacing: 8px; color: #2563eb; margin: 30px 0; }
        .expires { text-align: center; color: #6b7280; font-size: 14px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Your Login Code</h1>
        </div>
        
        <p>Hi there!</p>
        
        <p>You requested a login code for your Optiview account. Here it is:</p>
        
        <div class="code">${code}</div>
        
        <p>Enter this code in the login form to access your account.</p>
        
        <div class="expires">
            ⏰ This code expires in ${expiresInMinutes} minutes
        </div>
        
        <p><strong>Security note:</strong> Never share this code with anyone. Optiview will never ask for it via email, phone, or text.</p>
        
        <p>If you didn't request this code, you can safely ignore this email.</p>
        
        <div class="footer">
            <p>This email was sent to ${email}</p>
            <p>&copy; ${new Date().getFullYear()} Optiview. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate OTP email text content
   */
  generateOTPEmailText(email: string, code: string, expiresInMinutes: number = 10): string {
    return `Your Optiview Login Code

Hi there!

You requested a login code for your Optiview account. Here it is:

${code}

Enter this code in the login form to access your account.

This code expires in ${expiresInMinutes} minutes.

Security note: Never share this code with anyone. Optiview will never ask for it via email, phone, or text.

If you didn't request this code, you can safely ignore this email.

This email was sent to ${email}

© ${new Date().getFullYear()} Optiview. All rights reserved.`;
  }

  /**
   * Generate Magic Link email HTML content
   */
  generateMagicLinkEmailHTML(email: string, magicLinkUrl: string, expiresInMinutes: number = 15): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sign in to Optiview</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .button { display: inline-block; background-color: #2563eb; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; text-align: center; min-width: 120px; }
        .button:hover { background-color: #1d4ed8; }
        .expires { text-align: center; color: #6b7280; font-size: 14px; margin: 20px 0; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Sign in to Optiview</h1>
        </div>
        
        <p>Hi there!</p>
        
        <p>Click the button below to sign in to your Optiview account:</p>
        
        <div style="text-align: center;">
            <a href="${magicLinkUrl}" class="button">Sign in</a>
        </div>
        
        <div class="expires">
            ⏰ This link expires in ${expiresInMinutes} minutes
        </div>
        
        <p><strong>Security note:</strong> This link is for you only. If you didn't request this, you can safely ignore this email.</p>
        
        <div class="footer">
            <p>This email was sent to ${email}</p>
            <p>&copy; ${new Date().getFullYear()} Optiview. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate Magic Link email text content
   */
  generateMagicLinkEmailText(email: string, magicLinkUrl: string, expiresInMinutes: number = 15): string {
    return `Sign in to Optiview

Hi there!

Click the link below to sign in to your Optiview account:

${magicLinkUrl}

This link expires in ${expiresInMinutes} minutes.

Security note: This link is for you only. If you didn't request this, you can safely ignore this email.

This email was sent to ${email}

© ${new Date().getFullYear()} Optiview. All rights reserved.`;
  }

  /**
   * Generate Invite email HTML content
   */
  generateInviteEmailHTML(email: string, inviteUrl: string, inviterName: string, orgName: string, role: string, expiresInDays: number = 7): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You're invited to join Optiview</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .button { display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0; }
        .expires { text-align: center; color: #6b7280; font-size: 14px; margin: 20px 0; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>👥 You're invited to join Optiview</h1>
        </div>
        
        <p>Hi there!</p>
        
        <p><strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> on Optiview as a <strong>${role}</strong>.</p>
        
        <div style="text-align: center;">
            <a href="${inviteUrl}" class="button">Accept Invitation</a>
        </div>
        
        <div class="expires">
            ⏰ This invitation expires in ${expiresInDays} days
        </div>
        
        <p>Optiview helps teams understand their website traffic and user behavior with privacy-first analytics.</p>
        
        <div class="footer">
            <p>This email was sent to ${email}</p>
            <p>&copy; ${new Date().getFullYear()} Optiview. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate Invite email text content
   */
  generateInviteEmailText(email: string, inviteUrl: string, inviterName: string, orgName: string, role: string, expiresInDays: number = 7): string {
    return `You're invited to join Optiview

Hi there!

${inviterName} has invited you to join ${orgName} on Optiview as a ${role}.

Click the link below to accept the invitation:

${inviteUrl}

This invitation expires in ${expiresInDays} days.

Optiview helps teams understand their website traffic and user behavior with privacy-first analytics.

This email was sent to ${email}

© ${new Date().getFullYear()} Optiview. All rights reserved.`;
  }

  /**
   * Create email service from environment variables
   */
  static fromEnv(env: any): EmailService {
    const config: EmailConfig = {
      smtpHost: env.SMTP_HOST,
      smtpPort: env.SMTP_PORT ? parseInt(env.SMTP_PORT) : undefined,
      smtpUser: env.SMTP_USER,
      smtpPass: env.SMTP_PASS,
      fromEmail: env.EMAIL_FROM || 'support@optiview.ai',
      devMode: !env.SMTP_HOST || env.DEV_MAIL_ECHO === 'true',
      resendKey: env.RESEND_KEY // Added for Resend API
    };

    return new EmailService(config);
  }
}
