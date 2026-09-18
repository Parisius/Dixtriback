import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { Role } from '../common/constants/roles.enum';
import { RefreshToken, RefreshTokenDocument } from './schemas/refresh-token.schema';
import { OtpCode, OtpCodeDocument } from './schemas/otp-code.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { OtpVerifyDto } from './dto/otp-verify.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private config: ConfigService,
    private mailService: MailService,
    @InjectModel(RefreshToken.name)
    private refreshTokenModel: Model<RefreshTokenDocument>,
    @InjectModel(OtpCode.name) private otpCodeModel: Model<OtpCodeDocument>,
  ) {}

  // ---- Email + password -------------------------------------------------

  async register(dto: Record<string, any>) {
    const { email, phone } = dto;
    if (!email && !phone) {
      throw new ConflictException('Un email ou un téléphone est requis.');
    }
    if (email && (await this.usersService.findByEmail(email))) {
      throw new ConflictException('Cet email est déjà utilisé.');
    }
    if (phone && (await this.usersService.findByPhone(phone))) {
      throw new ConflictException('Ce téléphone est déjà utilisé.');
    }

    // role is never taken from the caller — always forced to customer here.
    const { role: _ignored, ...rest } = dto;
    const user = await this.usersService.create({ ...rest, role: Role.CUSTOMER });
    return this.issueTokens(user.id, user.role, user.companyId?.toString() ?? null);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Identifiants invalides.');
    }
    const match = await bcrypt.compare(dto.password, user.passwordHash);
    if (!match) throw new UnauthorizedException('Identifiants invalides.');

    return this.issueTokens(user.id, user.role, user.companyId?.toString() ?? null);
  }

  // ---- Email + OTP --------------------------------------------------------

  private static readonly OTP_RESEND_COOLDOWN_MS = 60_000;
  private static readonly OTP_MAX_ATTEMPTS = 5;

  async requestOtp(rawEmail: string) {
    const email = rawEmail.trim().toLowerCase();
    const ttlSeconds = this.config.get<number>('otp.ttlSeconds')!;

    // Anti mail-bombing: at most one code per address per cooldown window.
    const last = await this.otpCodeModel.findOne({ email }).sort('-createdAt').exec();
    const createdAt = (last as any)?.createdAt as Date | undefined;
    if (
      createdAt &&
      Date.now() - createdAt.getTime() < AuthService.OTP_RESEND_COOLDOWN_MS
    ) {
      throw new HttpException(
        'Un code a déjà été envoyé. Réessayez dans une minute.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Without SMTP (local dev only) a fixed code lets the flow run end-to-end.
    const code = this.mailService.enabled
      ? this.generateCode()
      : this.config.get<string>('otp.devStaticCode')!;
    const codeHash = await bcrypt.hash(code, 10);

    await this.mailService.sendOtp(email, code, Math.ceil(ttlSeconds / 60));
    await this.otpCodeModel.create({
      email,
      codeHash,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    });
    return { sent: true };
  }

  async verifyOtp(dto: OtpVerifyDto) {
    const email = dto.email.trim().toLowerCase();
    const record = await this.otpCodeModel
      .findOne({ email, consumed: false })
      .sort('-createdAt')
      .exec();
    if (
      !record ||
      record.expiresAt < new Date() ||
      record.attempts >= AuthService.OTP_MAX_ATTEMPTS
    ) {
      throw new UnauthorizedException('Code invalide ou expiré.');
    }
    const match = await bcrypt.compare(dto.code, record.codeHash);
    if (!match) {
      record.attempts += 1;
      await record.save();
      throw new UnauthorizedException('Code invalide ou expiré.');
    }

    record.consumed = true;
    await record.save();

    let user = await this.usersService.findByEmail(email);
    if (user && !user.isActive) {
      throw new UnauthorizedException('Compte désactivé.');
    }
    if (!user) {
      user = await this.usersService.create({
        name: email,
        email,
        role: Role.CUSTOMER,
        password: crypto.randomBytes(16).toString('hex'), // unusable random password; login stays OTP-only
        emailVerified: true,
      });
    } else if (!user.emailVerified) {
      user = await this.usersService.update(user.id, { emailVerified: true });
    }
    return this.issueTokens(user.id, user.role, user.companyId?.toString() ?? null);
  }

  // ---- Refresh & logout -----------------------------------------------

  async refresh(refreshToken: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalide ou expiré.');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.refreshTokenModel.findOne({
      userId: payload.sub,
      tokenHash,
      revoked: false,
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token invalide ou expiré.');
    }
    stored.revoked = true; // rotate: old token is single-use
    await stored.save();

    const user = await this.usersService.findById(payload.sub);
    return this.issueTokens(user.id, user.role, user.companyId?.toString() ?? null);
  }

  async logout(userId: string) {
    await this.refreshTokenModel.updateMany(
      { userId, revoked: false },
      { revoked: true },
    );
    return { loggedOut: true };
  }

  // ---- Internals ---------------------------------------------------------

  private async issueTokens(userId: string, role: string, companyId: string | null) {
    const payload = { sub: userId, role, companyId };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: this.config.get<string>('jwt.accessExpiresIn'),
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('jwt.refreshSecret'),
      expiresIn: this.config.get<string>('jwt.refreshExpiresIn'),
    });

    const decoded: any = this.jwtService.decode(refreshToken);
    await this.refreshTokenModel.create({
      userId,
      tokenHash: this.hashToken(refreshToken),
      expiresAt: new Date(decoded.exp * 1000),
    });

    const user = await this.usersService.findById(userId);
    return { accessToken, refreshToken, user };
  }

  private hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generateCode() {
    return crypto.randomInt(100000, 1000000).toString();
  }
}
