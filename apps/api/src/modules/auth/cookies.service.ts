import { Injectable } from '@nestjs/common';
import type { CookieOptions, Response } from 'express';

import { EnvService } from '../../config/env.service';

@Injectable()
export class CookiesService {
  constructor(private readonly env: EnvService) {}

  private get cookiePath(): string {
    const prefix = this.env.get('API_GLOBAL_PREFIX').replace(/^\/?/, '/').replace(/\/$/, '');
    return `${prefix}/auth`;
  }

  private baseOptions(): CookieOptions {
    const domain = this.env.get('AUTH_COOKIE_DOMAIN');
    return {
      httpOnly: true,
      secure: this.env.get('AUTH_COOKIE_SECURE'),
      sameSite: this.env.get('AUTH_COOKIE_SAMESITE'),
      path: this.cookiePath,
      ...(domain ? { domain } : {}),
    };
  }

  setRefreshToken(res: Response, token: string): void {
    res.cookie(this.env.get('AUTH_COOKIE_NAME'), token, {
      ...this.baseOptions(),
      maxAge: this.env.get('AUTH_REFRESH_TOKEN_TTL_SECONDS') * 1000,
    });
  }

  clearRefreshToken(res: Response): void {
    // Pass the same options as when setting the cookie — otherwise some
    // browsers keep the old cookie because path/domain don't match.
    res.clearCookie(this.env.get('AUTH_COOKIE_NAME'), this.baseOptions());
  }
}
