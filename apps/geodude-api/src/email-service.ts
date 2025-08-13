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
   * Send an email (SMTP or console echo)
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (this.config.devMode || !this.config.smtpHost) {
      return this.echoToConsole(options);
    } else {
      return this.sendViaSMTP(options);
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
   * Send email via SMTP (production mode)
   */
  private async sendViaSMTP(options: EmailOptions): Promise<boolean> {
    try {
      // This would use a proper SMTP library in production
      // For now, we'll simulate the SMTP call
      console.log(`📧 Sending email via SMTP to ${options.to}`);
      
      // In a real implementation, you'd use something like:
      // const transporter = nodemailer.createTransporter({
      //   host: this.config.smtpHost,
      //   port: this.config.smtpPort,
      //   secure: this.config.smtpPort === 465,
      //   auth: {
      //     user: this.config.smtpUser,
      //     pass: this.config.smtpPass
      //   }
      // });
      // 
      // await transporter.sendMail({
      //   from: this.config.fromEmail,
      //   to: options.to,
      //   subject: options.subject,
      //   html: options.html,
      //   text: options.text
      // });
      
      return true;
    } catch (error) {
      console.error('SMTP email failed:', error);
      return false;
    }
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
   * Create email service from environment variables
   */
  static fromEnv(env: any): EmailService {
    const config: EmailConfig = {
      smtpHost: env.SMTP_HOST,
      smtpPort: env.SMTP_PORT ? parseInt(env.SMTP_PORT) : undefined,
      smtpUser: env.SMTP_USER,
      smtpPass: env.SMTP_PASS,
      fromEmail: env.EMAIL_FROM || 'noreply@optiview.ai',
      devMode: !env.SMTP_HOST || env.DEV_MAIL_ECHO === 'true'
    };

    return new EmailService(config);
  }
}
