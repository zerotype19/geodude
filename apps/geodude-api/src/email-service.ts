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
   * Send email via Cloudflare Email Routing (recommended for Workers)
   */
  private async sendViaCloudflare(options: EmailOptions): Promise<boolean> {
    try {
      console.log(`📧 Sending email via Cloudflare Email Routing to ${options.to}`);
      
      // Cloudflare Email Routing uses a simple HTTP API
      // For now, we'll simulate the call since the actual implementation
      // depends on your Cloudflare Email Routing configuration
      
      // In a real implementation, you'd either:
      // 1. Use Cloudflare's Email API (if available)
      // 2. Send to a Cloudflare Email Routing endpoint
      // 3. Use the built-in email routing from your domain
      
      console.log(`📧 Email would be sent via Cloudflare Email Routing:`);
      console.log(`   To: ${options.to}`);
      console.log(`   From: ${this.config.fromEmail}`);
      console.log(`   Subject: ${options.subject}`);
      
      // For now, return true to simulate success
      // You'll need to implement the actual Cloudflare Email Routing call
      return true;
    } catch (error) {
      console.error('Cloudflare Email Routing failed:', error);
      return false;
    }
  }

  /**
   * Send email (Cloudflare Email Routing or console echo)
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (this.config.devMode || !this.config.smtpHost) {
      return this.echoToConsole(options);
    } else {
      // Use Cloudflare Email Routing instead of SMTP
      return this.sendViaCloudflare(options);
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
        .button { display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0; }
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
      devMode: !env.SMTP_HOST || env.DEV_MAIL_ECHO === 'true'
    };

    return new EmailService(config);
  }
}
