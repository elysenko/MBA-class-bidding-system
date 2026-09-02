import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../common/config.service';

export const RESEND_API_KEY_ENV =
  'RESEND_REST_API_POST_HTTPS_API_RESEND_COM_EMAILS_API_KEY';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const TIMEOUT_MS = 5000;

/**
 * Resend REST client for the one-time student sign-in links.
 *
 * `sendLoginToken` NEVER throws: account provisioning must succeed even when
 * email delivery does not, so the caller gets a boolean and the UI surfaces a
 * persistent "email not delivered" banner with a resend action.
 */
@Injectable()
export class ResendService {
  private readonly logger = new Logger(ResendService.name);

  constructor(private readonly config: AppConfigService) {}

  async isConfigured(): Promise<boolean> {
    return this.config.isConfigured(RESEND_API_KEY_ENV);
  }

  private async baseUrl(): Promise<string> {
    const configured = await this.config.resolveConfig('APP_BASE_URL');
    return (configured ?? 'http://localhost:4200').replace(/\/+$/, '');
  }

  async loginLink(token: string): Promise<string> {
    return `${await this.baseUrl()}/login/token?token=${encodeURIComponent(token)}`;
  }

  async sendLoginToken(email: string, name: string, token: string): Promise<boolean> {
    const apiKey = await this.config.resolveConfig(RESEND_API_KEY_ENV);
    if (!apiKey) {
      this.logger.error(
        `Cannot email a sign-in link to ${email}: ${RESEND_API_KEY_ENV} is not configured.`,
      );
      return false;
    }
    const from = (await this.config.resolveConfig('RESEND_FROM')) ?? 'onboarding@resend.dev';
    const link = await this.loginLink(token);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [email],
          subject: 'Your class bidding sign-in link',
          html: this.template(name, link, token),
          text: `Hello ${name},\n\nUse this single-use link to sign in and bid for classes:\n${link}\n\nThe link expires in 7 days and can only be used once.`,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        this.logger.error(
          `Resend rejected the sign-in email for ${email}: ${response.status} ${body.slice(0, 300)}`,
        );
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error(`Sending the sign-in email to ${email} failed: ${String(error)}`);
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  private template(name: string, link: string, token: string): string {
    return `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5">
      <h2>Class bidding sign-in</h2>
      <p>Hello ${name},</p>
      <p>Use this single-use link to sign in and bid for your classes:</p>
      <p><a href="${link}" style="background:#2f4bd8;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Sign in</a></p>
      <p style="color:#555;font-size:13px">Or paste this token on the sign-in page: <code>${token}</code></p>
      <p style="color:#777;font-size:12px">The link expires in 7 days and can only be used once.</p>
    </body></html>`;
  }
}
