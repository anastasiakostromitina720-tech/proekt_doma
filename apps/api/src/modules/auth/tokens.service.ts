import { randomUUID } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { EnvService } from '../../config/env.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { HashingService } from './hashing.service';

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

export interface IssuedAccessToken {
  token: string;
  /** ISO string. */
  expiresAt: string;
}

export interface IssuedRefreshToken {
  token: string;
  jti: string;
  expiresAt: Date;
}

export interface IssueRefreshMetadata {
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly env: EnvService,
    private readonly prisma: PrismaService,
    private readonly hashing: HashingService,
  ) {}

  async issueAccessToken(userId: string, email: string): Promise<IssuedAccessToken> {
    const ttl = this.env.get('AUTH_ACCESS_TOKEN_TTL_SECONDS');
    const token = await this.jwt.signAsync(
      { sub: userId, email } satisfies AccessTokenPayload,
      {
        secret: this.env.get('AUTH_JWT_ACCESS_SECRET'),
        expiresIn: ttl,
      },
    );
    return {
      token,
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      return await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.env.get('AUTH_JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  async issueRefreshToken(
    userId: string,
    meta: IssueRefreshMetadata = {},
  ): Promise<IssuedRefreshToken> {
    const jti = randomUUID();
    const ttl = this.env.get('AUTH_REFRESH_TOKEN_TTL_SECONDS');
    const expiresAt = new Date(Date.now() + ttl * 1000);

    const token = await this.jwt.signAsync(
      { sub: userId, jti } satisfies RefreshTokenPayload,
      {
        secret: this.env.get('AUTH_JWT_REFRESH_SECRET'),
        expiresIn: ttl,
      },
    );

    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        userId,
        tokenHash: this.hashing.hashRefreshToken(token),
        expiresAt,
        userAgent: meta.userAgent ?? null,
        ip: meta.ip ?? null,
      },
    });

    return { token, jti, expiresAt };
  }

  /**
   * Validate a refresh token against its DB record.
   * Returns the payload if valid. Throws UnauthorizedException otherwise.
   *
   * Implements token-reuse detection: if a request comes in with a token
   * that is signed correctly but already revoked, we revoke ALL sessions
   * of this user as a safety measure.
   */
  async validateRefreshToken(token: string): Promise<RefreshTokenPayload> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.env.get('AUTH_JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const record = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
    });

    if (!record || record.userId !== payload.sub) {
      throw new UnauthorizedException('Refresh token not recognized');
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const expectedHash = this.hashing.hashRefreshToken(token);
    if (!this.hashing.safeEqual(record.tokenHash, expectedHash)) {
      throw new UnauthorizedException('Refresh token mismatch');
    }

    if (record.revokedAt) {
      // Token reuse detected: invalidate every active session of this user.
      await this.revokeAllForUser(payload.sub);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    return payload;
  }

  async revokeByJti(jti: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { id: jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
