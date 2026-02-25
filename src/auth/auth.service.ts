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
