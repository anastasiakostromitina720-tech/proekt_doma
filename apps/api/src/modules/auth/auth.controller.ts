import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  type AuthSession,
  type LoginInput,
  loginInputSchema,
  type RegisterInput,
  registerInputSchema,
  type User,
} from '@app/contracts';

import { EnvService } from '../../config/env.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../../types/express';
import { toUserDto } from '../users/users.mapper';
import { UsersService } from '../users/users.service';
import { AuthService, type AuthContext } from './auth.service';
import { CookiesService } from './cookies.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: CookiesService,
    private readonly env: EnvService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body(new ZodValidationPipe(registerInputSchema)) dto: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    const { session, refreshToken } = await this.auth.register(dto, this.contextFrom(req));
    this.cookies.setRefreshToken(res, refreshToken);
    return session;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginInputSchema)) dto: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    const { session, refreshToken } = await this.auth.login(dto, this.contextFrom(req));
    this.cookies.setRefreshToken(res, refreshToken);
    return session;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    const cookieName = this.env.get('AUTH_COOKIE_NAME');
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
    const rawToken = cookies?.[cookieName];

    if (!rawToken) {
      this.cookies.clearRefreshToken(res);
      // 401 signals the client to clear its session and send the user to /login.
      throw new UnauthorizedException('No refresh token');
    }

    try {
      const { session, refreshToken } = await this.auth.refresh(rawToken, this.contextFrom(req));
      this.cookies.setRefreshToken(res, refreshToken);
      return session;
    } catch (err) {
      this.cookies.clearRefreshToken(res);
      throw err;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const cookieName = this.env.get('AUTH_COOKIE_NAME');
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
    const rawToken = cookies?.[cookieName];
    await this.auth.logout(rawToken);
    this.cookies.clearRefreshToken(res);
  }

  @Get('me')
  async me(@CurrentUser() current: AuthenticatedUser): Promise<User> {
    const user = await this.users.findById(current.id);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    return toUserDto(user);
  }

  private contextFrom(req: Request): AuthContext {
    const ua = req.headers['user-agent'];
    return {
      userAgent: typeof ua === 'string' ? ua.slice(0, 512) : undefined,
      ip: req.ip,
    };
  }
}
