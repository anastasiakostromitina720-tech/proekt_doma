import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';

import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CookiesService } from './cookies.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { HashingService } from './hashing.service';
import { TokensService } from './tokens.service';

@Module({
  imports: [
    // We intentionally do NOT configure a default signing secret here — each
    // sign/verify call passes the correct secret (access or refresh) explicitly.
    // This avoids accidentally using one secret where the other was intended.
    JwtModule.register({}),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokensService,
    HashingService,
    CookiesService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [AuthService, TokensService],
})
export class AuthModule {}
