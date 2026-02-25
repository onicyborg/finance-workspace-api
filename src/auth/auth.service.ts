import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { MailService } from 'src/mail/mail.service';

type AccessTokenPayload = {
  sub: string;
  email: string;
  sid: string;
};

type RefreshTokenPayload = {
  sub: string;
  email: string;
  sid: string;
  type: 'refresh';
};

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
  ) {}

  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private sha256Hex(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private safeEqualHex(a: string, b: string) {
    const aBuf = Buffer.from(a, 'hex');
    const bBuf = Buffer.from(b, 'hex');
    if (aBuf.length !== bBuf.length) return false;
    return timingSafeEqual(aBuf, bBuf);
  }

  private parseDurationToMs(value: string | number) {
    if (typeof value === 'number') {
      return value * 1000;
    }

    const match = value.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error('Invalid duration format');
    }

    const amount = Number(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return amount * 1000;
      case 'm':
        return amount * 60 * 1000;
      case 'h':
        return amount * 60 * 60 * 1000;
      case 'd':
        return amount * 24 * 60 * 60 * 1000;
      default:
        throw new Error('Invalid duration unit');
    }
  }

  private async issueAccessToken(payload: AccessTokenPayload) {
    return this.jwtService.signAsync(payload);
  }

  private async issueRefreshToken(payload: Omit<RefreshTokenPayload, 'type'>) {
    const refreshExpiresIn = this.configService.getOrThrow<string | number>(
      'JWT_REFRESH_EXPIRES_IN',
    );

    return this.jwtService.signAsync(
      { ...payload, type: 'refresh' },
      {
        expiresIn: refreshExpiresIn as any,
      },
    );
  }

  private async buildSessionMeta(req?: any) {
    const ipAddress =
      (req?.ip as string | undefined) ||
      (req?.headers?.['x-forwarded-for'] as string | undefined) ||
      undefined;
    const userAgent =
      (req?.headers?.['user-agent'] as string | undefined) || undefined;

    return { ipAddress, userAgent };
  }

  async register(dto: RegisterDto) {
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingEmail) {
      throw new ConflictException('Email already registered');
    }

    const existingUsername = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (existingUsername) {
      throw new ConflictException('Username already taken');
    }

    const existingPhone = await this.prisma.user.findUnique({
      where: { phoneNumber: dto.phoneNumber },
    });

    if (existingPhone) {
      throw new ConflictException('Phone number already registered');
    }

    const saltRounds =
      this.configService.get<number>('BCRYPT_SALT_ROUNDS') ?? 10;

    const hashedPassword = await bcrypt.hash(dto.password, saltRounds);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        username: dto.username,
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        password: hashedPassword,
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
      },
    });

    // generate raw token
    const rawToken = this.generateToken();
    const tokenHash = this.sha256Hex(rawToken);

    // expire 30 menit
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    // simpan ke VerificationToken
    await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        type: 'EMAIL_VERIFICATION',
        tokenHash,
        expiresAt,
      },
    });

    // kirim email
    await this.mailService.sendEmailVerification(user.email, rawToken);

    return {
      message:
        'Registration successful. Please check your email to verify your account.',
    };
  }

  async confirmEmail(rawToken: string) {
    const tokenHash = this.sha256Hex(rawToken);

    const record = await this.prisma.verificationToken.findFirst({
      where: {
        tokenHash,
        type: 'EMAIL_VERIFICATION',
        usedAt: null,
      },
    });

    if (!record) {
      throw new BadRequestException('Invalid verification token');
    }

    if (record.expiresAt < new Date()) {
      throw new BadRequestException('Verification token expired');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return {
      message: 'Email successfully verified. You can now login.',
    };
  }

  async resendEmailVerification(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Always return generic response (no info leak)
    const genericResponse = {
      message:
        'If the email exists and is not verified, a verification email has been sent.',
    };

    if (!user) {
      return genericResponse;
    }

    if (user.emailVerifiedAt) {
      return genericResponse;
    }

    // Delete old unused verification tokens
    await this.prisma.verificationToken.deleteMany({
      where: {
        userId: user.id,
        type: 'EMAIL_VERIFICATION',
        usedAt: null,
      },
    });

    const rawToken = this.generateToken();
    const tokenHash = this.sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        type: 'EMAIL_VERIFICATION',
        tokenHash,
        expiresAt,
      },
    });

    await this.mailService.sendEmailVerification(user.email, rawToken);

    return genericResponse;
  }

  async login(dto: LoginDto, req?: any) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException('Email not verified');
    }

    const session = await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: 'pending',
        expiresAt: new Date(0),
        ...(await this.buildSessionMeta(req)),
      },
    });

    const refreshToken = await this.issueRefreshToken({
      sub: user.id,
      email: user.email,
      sid: session.id,
    });

    const refreshExpiresIn = this.configService.getOrThrow<string | number>(
      'JWT_REFRESH_EXPIRES_IN',
    );
    const refreshExpiresAt = new Date(
      Date.now() + this.parseDurationToMs(refreshExpiresIn),
    );

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.sha256Hex(refreshToken),
        expiresAt: refreshExpiresAt,
      },
    });

    const accessToken = await this.issueAccessToken({
      sub: user.id,
      email: user.email,
      sid: session.id,
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    const genericResponse = {
      message: 'If the email exists, a password reset link has been sent.',
    };

    if (!user) {
      return genericResponse;
    }

    // delete old unused reset tokens
    await this.prisma.verificationToken.deleteMany({
      where: {
        userId: user.id,
        type: 'PASSWORD_RESET',
        usedAt: null,
      },
    });

    const rawToken = this.generateToken();
    const tokenHash = this.sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        type: 'PASSWORD_RESET',
        tokenHash,
        expiresAt,
      },
    });

    // TODO: Replace with real email template
    const resetUrl = `http://localhost:3000/auth/reset-password?token=${rawToken}`;

    await this.mailService.sendMail(
      user.email,
      'Reset Your Password',
      `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Password Reset</title>
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
                Reset Your Password
              </h2>

              <p style="font-size:15px;line-height:1.6;margin-bottom:20px;">
                We received a request to reset your password. Click the button below to set a new password.
              </p>

              <!-- Button -->
              <div style="text-align:center;margin:30px 0;">
                <a href="${resetUrl}" 
                   style="
                     background:#dc2626;
                     color:#ffffff;
                     padding:14px 28px;
                     text-decoration:none;
                     border-radius:6px;
                     display:inline-block;
                     font-weight:bold;
                     font-size:14px;">
                  Reset Password
                </a>
              </div>

              <p style="font-size:13px;color:#6b7280;">
                This reset link will expire in <strong>30 minutes</strong>.
              </p>

              <p style="font-size:13px;color:#6b7280;margin-top:20px;">
                If you did not request a password reset, you can safely ignore this email.
              </p>

              <hr style="border:none;border-top:1px solid #e5e7eb;margin:30px 0;" />

              <p style="font-size:12px;color:#9ca3af;word-break:break-all;">
                If the button above doesn't work, copy and paste this link into your browser:
                <br />
                <a href="${resetUrl}" style="color:#dc2626;">${resetUrl}</a>
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
`,
    );

    return genericResponse;
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const tokenHash = this.sha256Hex(rawToken);

    const record = await this.prisma.verificationToken.findFirst({
      where: {
        tokenHash,
        type: 'PASSWORD_RESET',
        usedAt: null,
      },
    });

    if (!record) {
      throw new BadRequestException('Invalid reset token');
    }

    if (record.expiresAt < new Date()) {
      throw new BadRequestException('Reset token expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: record.userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const saltRounds =
      this.configService.get<number>('BCRYPT_SALT_ROUNDS') ?? 10;

    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await this.prisma.$transaction([
      // update password
      this.prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),

      // mark token used
      this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),

      // revoke all sessions
      this.prisma.userSession.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
    ]);

    return {
      message: 'Password has been reset successfully.',
    };
  }

  async refresh(refreshToken: string, req?: any) {
    let payload: RefreshTokenPayload;
    try {
      payload = (await this.jwtService.verifyAsync(
        refreshToken,
      )) as RefreshTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!payload?.sid || payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.prisma.userSession.findUnique({
      where: { id: payload.sid },
    });

    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.revokedAt) {
      throw new UnauthorizedException('Session revoked');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const presentedHash = this.sha256Hex(refreshToken);
    if (!this.safeEqualHex(presentedHash, session.refreshTokenHash)) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const meta = await this.buildSessionMeta(req);
    const newSession = await this.prisma.userSession.create({
      data: {
        userId: session.userId,
        refreshTokenHash: 'pending',
        expiresAt: new Date(0),
        ...meta,
      },
    });

    const newRefreshToken = await this.issueRefreshToken({
      sub: payload.sub,
      email: payload.email,
      sid: newSession.id,
    });

    const refreshExpiresIn = this.configService.getOrThrow<string | number>(
      'JWT_REFRESH_EXPIRES_IN',
    );
    const refreshExpiresAt = new Date(
      Date.now() + this.parseDurationToMs(refreshExpiresIn),
    );

    await this.prisma.userSession.update({
      where: { id: newSession.id },
      data: {
        refreshTokenHash: this.sha256Hex(newRefreshToken),
        expiresAt: refreshExpiresAt,
      },
    });

    const newAccessToken = await this.issueAccessToken({
      sub: payload.sub,
      email: payload.email,
      sid: newSession.id,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshToken: string) {
    let payload: RefreshTokenPayload;
    try {
      payload = (await this.jwtService.verifyAsync(
        refreshToken,
      )) as RefreshTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!payload?.sid || payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.prisma.userSession.findUnique({
      where: { id: payload.sid },
    });

    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const presentedHash = this.sha256Hex(refreshToken);
    if (!this.safeEqualHex(presentedHash, session.refreshTokenHash)) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    return { message: 'Logged out' };
  }

  async logoutAllDevices(userId: string) {
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Logged out from all devices' };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phoneNumber: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return { user };
  }
}
