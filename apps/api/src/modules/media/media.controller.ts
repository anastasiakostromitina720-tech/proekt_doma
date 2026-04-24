import {
  type MediaAssetDto,
  type MediaListResponse,
  type PresignedUploadResponse,
  type RequestMediaUploadInput,
  requestMediaUploadSchema,
  uuidSchema,
} from '@app/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../../types/express';

import { MediaService } from './media.service';

@Controller('projects/:projectId/media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('upload-url')
  @HttpCode(HttpStatus.CREATED)
  requestUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ZodValidationPipe(uuidSchema)) projectId: string,
    @Body(new ZodValidationPipe(requestMediaUploadSchema)) dto: RequestMediaUploadInput,
  ): Promise<PresignedUploadResponse> {
    return this.media.requestUpload(user.id, projectId, dto);
  }

  @Post(':mediaId/confirm')
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ZodValidationPipe(uuidSchema)) projectId: string,
    @Param('mediaId', new ZodValidationPipe(uuidSchema)) mediaId: string,
  ): Promise<MediaAssetDto> {
    return this.media.confirmUpload(user.id, projectId, mediaId);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ZodValidationPipe(uuidSchema)) projectId: string,
  ): Promise<MediaListResponse> {
    return this.media.list(user.id, projectId);
  }

  @Delete(':mediaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ZodValidationPipe(uuidSchema)) projectId: string,
    @Param('mediaId', new ZodValidationPipe(uuidSchema)) mediaId: string,
  ): Promise<void> {
    return this.media.remove(user.id, projectId, mediaId);
  }
}
