import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { User as PrismaUser } from '@prisma/client';
import type { AuthSession, LoginInput, RegisterInput } from '@app/contracts';

import { toUserDto } from '../users/users.mapper';
import { UsersService } from '../users/users.service';
import { HashingService } from './hashing.service';
import { TokensService } from './tokens.service';

export interface AuthContext {
  userAgent?: string;
  ip?: string;
}

export interface SessionWithRefresh {
  session: AuthSession;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokensService,
    private readonly hashing: HashingService,
  ) {}

  async register(input: RegisterInput, context: AuthContext): Promise<SessionWithRefresh> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await this.hashing.hashPassword(input.password);
    const user = await this.users.create({
      email: input.email,
      passwordHash,
      name: input.name,
    });

    return this.buildSession(user, context);
  }

  async login(input: LoginInput, context: AuthContext): Promise<SessionWithRefresh> {
    const user = await this.users.findByEmail(input.email);
    if (!user) {
      // Same error for missing vs wrong password — no user enumeration.
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await this.hashing.comparePassword(input.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildSession(user, context);
  }

  async refresh(rawToken: string, context: AuthContext): Promise<SessionWithRefresh> {
    const payload = await this.tokens.validateRefreshToken(rawToken);

    const user = await this.users.findById(payload.sub);
    if (!user) {
      await this.tokens.revokeByJti(payload.jti);
      throw new UnauthorizedException('User no longer exists');
    }

    // Rotate: revoke old, issue new.
    await this.tokens.revokeByJti(payload.jti);

    return this.buildSession(user, context);
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    try {
      const payload = await this.tokens.validateRefreshToken(rawToken);
      await this.tokens.revokeByJti(payload.jti);
    } catch {
      // A malformed or already-invalid token on logout is not an error for
      // the client — the goal is just to clear the session.
    }
  }

  private async buildSession(
    user: PrismaUser,
    context: AuthContext,
  ): Promise<SessionWithRefresh> {
    const access = await this.tokens.issueAccessToken(user.id, user.email);
    const refresh = await this.tokens.issueRefreshToken(user.id, context);

    return {
      session: {
        user: toUserDto(user),
        accessToken: access.token,
        accessTokenExpiresAt: access.expiresAt,
      },
      refreshToken: refresh.token,
    };
  }
}
