import { Controller, Get, NotFoundException } from '@nestjs/common';
import type { User } from '@app/contracts';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../types/express';
import { toUserDto } from './users.mapper';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@CurrentUser() current: AuthenticatedUser): Promise<User> {
    const user = await this.users.findById(current.id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toUserDto(user);
  }
}
