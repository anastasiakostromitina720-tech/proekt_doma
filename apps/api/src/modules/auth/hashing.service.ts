import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';

import { EnvService } from '../../config/env.service';

@Injectable()
export class HashingService {
  constructor(private readonly env: EnvService) {}

  hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.env.get('AUTH_BCRYPT_COST'));
  }

  comparePassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  /**
   * SHA-256 is sufficient for refresh tokens because the input is a full
   * signed JWT (high entropy). We do NOT use bcrypt here — it would be
   * prohibitively slow for per-request lookup.
   */
  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  safeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
  }
}
