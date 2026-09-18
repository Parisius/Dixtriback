import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;
  private readonly isProd: boolean;

  constructor(config: ConfigService) {
    const smtp = config.get<{
      host: string;
      port: number;
      secure: boolean;
      user: string;
      pass: string;
      from: string;
    }>('smtp')!;
    this.from = smtp.from;
    this.isProd = config.get<string>('nodeEnv') === 'production';

    this.transporter = smtp.host
      ? nodemailer.createTransport({
          host: smtp.host,
          port: smtp.port,
          secure: smtp.secure,
          auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
        })
      : null;

    if (!this.transporter) {
      this.logger.warn(
        this.isProd
          ? 'SMTP_HOST is not set: OTP emails cannot be sent.'
          : 'SMTP_HOST is not set: OTP codes will be logged to the console (dev only).',
      );
    }
  }

  /** True when emails are really sent; false = dev mode (static code, console log). */
  get enabled(): boolean {
    return this.transporter !== null;
  }

  async sendOtp(to: string, code: string, ttlMinutes: number): Promise<void> {
    if (!this.transporter) {
      if (this.isProd) {
        throw new ServiceUnavailableException("L'envoi d'emails n'est pas configuré.");
      }
      this.logger.log(`[dev] OTP for ${to}: ${code}`);
      return;
    }
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: 'Votre code de vérification',
        text: `Votre code de vérification est : ${code}\nIl expire dans ${ttlMinutes} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
        html: `<p>Votre code de vérification est :</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>Il expire dans ${ttlMinutes} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`,
      });
    } catch (err) {
      this.logger.error(`Failed to send OTP email: ${(err as Error).message}`);
      throw new ServiceUnavailableException("Impossible d'envoyer l'email pour le moment.");
    }
  }
}
