import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: false,
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    });
  }

  async sendMail(to: string, subject: string, html: string) {
    await this.transporter.sendMail({
      from: this.configService.get('SMTP_FROM'),
      to,
      subject,
      html,
    });
  }

  async sendEmailVerification(to: string, token: string) {
    const verifyUrl = `http://localhost:3000/auth/email-verify/confirm?token=${token}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Email Verification</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
          
          <!-- Header -->
          <tr>
            <td style="background:#111827;padding:20px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:20px;">
                Finance Workspace
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 30px;color:#374151;">
              <h2 style="margin-top:0;font-size:22px;color:#111827;">
                Verify Your Email
              </h2>

              <p style="font-size:15px;line-height:1.6;margin-bottom:20px;">
                Thanks for registering. Please confirm your email address by clicking the button below.
              </p>

              <!-- Button -->
              <div style="text-align:center;margin:30px 0;">
                <a href="${verifyUrl}" 
                   style="
                     background:#2563eb;
                     color:#ffffff;
                     padding:14px 28px;
                     text-decoration:none;
                     border-radius:6px;
                     display:inline-block;
                     font-weight:bold;
                     font-size:14px;">
                  Verify Email
                </a>
              </div>

              <p style="font-size:13px;color:#6b7280;">
                This verification link will expire in <strong>30 minutes</strong>.
              </p>

              <hr style="border:none;border-top:1px solid #e5e7eb;margin:30px 0;" />

              <p style="font-size:12px;color:#9ca3af;word-break:break-all;">
                If the button above doesn't work, copy and paste this link into your browser:
                <br />
                <a href="${verifyUrl}" style="color:#2563eb;">${verifyUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px;text-align:center;font-size:12px;color:#9ca3af;">
              © ${new Date().getFullYear()} Finance Workspace. All rights reserved.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

    await this.sendMail(to, 'Verify Your Email', html);
  }
}
