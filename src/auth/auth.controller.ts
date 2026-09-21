import { Body, Controller, Post, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { OtpRequestDto } from './dto/otp-request.dto';
import { OtpVerifyDto } from './dto/otp-verify.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { TenancyService } from '../tenancy/tenancy.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly tenancy: TenancyService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Créer un compte client (auto-inscription, marketplace)',
    description:
      "Public. Crée toujours un compte avec le rôle 'customer' — le rôle ne peut pas être choisi par l'appelant.",
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Se connecter (email + mot de passe)' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Demander un code de vérification par email' })
  requestOtp(@Body() dto: OtpRequestDto) {
    return this.authService.requestOtp(dto.email);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Vérifier le code reçu par email — connecte ou finalise l\'inscription',
    description:
      "Si l'email n'a pas de compte associé, en crée un automatiquement (rôle 'customer').",
  })
  verifyOtp(@Body() dto: OtpVerifyDto) {
    return this.authService.verifyOtp(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rafraîchir le jeton d'accès" })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Se déconnecter (révoque les refresh tokens)' })
  logout(@CurrentUser('userId') userId: string) {
    return this.authService.logout(userId);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({
    summary: "Profil de l'utilisateur authentifié",
    description: 'Inclut `companyIds` : les entreprises accessibles avec ce compte.',
  })
  async me(@CurrentUser() user: AuthUser) {
    const profile = await this.usersService.findById(user.userId);
    // Companies this account can access (a super admin's = the ones they created).
    return { ...profile.toJSON(), companyIds: await this.tenancy.allowedCompanyIds(user) };
  }
}
