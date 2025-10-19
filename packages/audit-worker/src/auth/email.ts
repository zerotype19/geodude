/**
 * Email service for sending magic link emails via SMTP2GO
 */

export interface MagicLinkEmail {
  to: string;
  verifyUrl: string;
  expiresMinutes: number;
  domain?: string; // optional context
}

/**
 * Send magic link email via SMTP2GO
 */
export async function sendMagicLinkEmail(
  apiKey: string,
  email: MagicLinkEmail
): Promise<{ ok: boolean; error?: string }> {
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to Optiview</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                OPTIVIEW.AI
              </h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 20px 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333333;">
                Hi there,
              </p>
              
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333333;">
                ${email.domain ? `Click below to sign in to Optiview and continue with your audit for <strong>${email.domain}</strong>:` : 'Click below to sign in to Optiview:'}
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${email.verifyUrl}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                      Sign In to Optiview
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 20px 0; font-size: 14px; line-height: 1.6; color: #666666;">
                Or copy and paste this link into your browser:
              </p>
              
              <p style="margin: 0 0 20px; padding: 12px; background-color: #f5f5f5; border-radius: 4px; font-size: 13px; word-break: break-all; color: #333333;">
                ${email.verifyUrl}
              </p>
              
              <p style="margin: 20px 0 0; font-size: 14px; line-height: 1.6; color: #666666;">
                This link expires in <strong>${email.expiresMinutes} minutes</strong>. If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 40px; border-top: 1px solid #eeeeee;">
              <p style="margin: 0; font-size: 13px; color: #999999; text-align: center;">
                — Optiview<br>
                <a href="https://optiview.ai" style="color: #667eea; text-decoration: none;">optiview.ai</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const textBody = `
Hi there,

${email.domain ? `Click to sign in to Optiview and continue with your audit for ${email.domain}:` : 'Click to sign in to Optiview:'}

${email.verifyUrl}

This link expires in ${email.expiresMinutes} minutes. If you didn't request this, you can safely ignore this email.

— Optiview
optiview.ai
  `.trim();

  try {
    const response = await fetch('https://api.smtp2go.com/v3/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Smtp2go-Api-Key': apiKey
      },
      body: JSON.stringify({
        api_key: apiKey,
        to: [email.to],
        sender: 'Optiview <noreply@optiview.ai>',
        subject: email.domain 
          ? `Sign in to Optiview – ${email.domain}`
          : 'Your Optiview sign-in link',
        html_body: htmlBody,
        text_body: textBody
      })
    });

    const data = await response.json() as any;

    if (!response.ok || data.data?.error) {
      console.error('[EMAIL] SMTP2GO error:', data);
      return { 
        ok: false, 
        error: data.data?.error || data.data?.error_code || 'Failed to send email' 
      };
    }

    console.log('[EMAIL] Magic link sent to:', email.to);
    return { ok: true };

  } catch (error) {
    console.error('[EMAIL] Failed to send magic link:', error);
    return { 
      ok: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

