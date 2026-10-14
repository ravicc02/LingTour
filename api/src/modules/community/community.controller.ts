import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CommunityService } from './community.service';
import { UploadService } from '../upload/upload.service';
import {
  MAX_IMAGE_FILE_SIZE,
  MAX_LIVE_FILE_SIZE,
  discardUploadedFile,
  hasValidUploadSignature,
  isAllowedImageUpload,
  isAllowedLiveUpload,
  readUploadHead,
} from '../upload/upload-policy';
import { UpsertCommunityPostDto } from './dto/upsert-community-post.dto';
import { UpdateCommunityStatusDto } from './dto/update-community-status.dto';
import { UpsertCommunityBriefDto } from './dto/upsert-community-brief.dto';
import {
  COMMUNITY_POST_STATUSES,
  type CommunityPostStatus,
} from './entities/community-post.entity';
import {
  AuditInterceptor as AuditLogInterceptor,
  AuditAction,
} from '../../common/interceptors/audit.interceptor';

interface AuthenticatedRequest extends Request {
  user?: { sub?: string; email?: string; role?: string };
}

@ApiTags('Community')
@Controller('api/v1')
export class CommunityController {
  constructor(
    private readonly communityService: CommunityService,
    private readonly uploadService: UploadService,
  ) {}

  private requireUserId(req: AuthenticatedRequest) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user');
    }
    return userId;
  }

  /**
   * community 上传与 admin 上传共用同一套媒体安全策略：MIME + 扩展名白名单
   * 加磁盘文件头签名校验；校验失败时清理 diskStorage 已落盘的文件，不留孤儿。
   * （Multer 的 fileFilter 在装饰器求值期无法引用实例方法，故放在方法体内。）
   *
   * 社区帖子媒体只有 image 与 live 两种。live 实况图与图片走同一个上传端点，
   * 由文件本身决定归类，前端不分支调用；图片沿用 10MB 上限，live 实况图附带
   * 一段短运动片段，沿用视频侧的 100MB 上限。
   */
  private async verifyCommunityUpload(
    file: Express.Multer.File,
  ): Promise<void> {
    const isImage = isAllowedImageUpload(file);
    const isLive = isAllowedLiveUpload(file);
    if (!isImage && !isLive) {
      await discardUploadedFile(file);
      throw new BadRequestException(
        'Only JPEG, PNG, WebP or GIF images are allowed, plus live photo clips (MP4, WebM, MOV or M4V)',
      );
    }
    const ceiling = isImage ? MAX_IMAGE_FILE_SIZE : MAX_LIVE_FILE_SIZE;
    if (typeof file.size === 'number' && file.size > ceiling) {
      await discardUploadedFile(file);
      throw new BadRequestException(
        isImage
          ? 'Images must be 10MB or smaller'
          : 'Live photo clips must be 100MB or smaller',
      );
    }
    const head = await readUploadHead(file);
    if (!head || !hasValidUploadSignature({ ...file, buffer: head })) {
      await discardUploadedFile(file);
      throw new BadRequestException(
        'File content does not match its declared type',
      );
    }
  }

  @Public()
  @Get('public/community/posts')
  @ApiOperation({ summary: 'Get community posts (public)' })
  @ApiQuery({ name: 'channel', required: false })
  @ApiQuery({ name: 'route', required: false })
  @ApiQuery({ name: 'location', required: false })
  @ApiQuery({ name: 'tag', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getPublicPosts(
    @Query('channel') channel?: string,
    @Query('route') route?: string,
    @Query('location') location?: string,
    @Query('tag') tag?: string,
    @Query('q') q?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.communityService.getPublicPosts({
      channel,
      route,
      location,
      tag,
      q,
      page: +page,
      limit: +limit,
    });
  }

  @Public()
  @Get('public/community/posts/:id')
  async getPublicPost(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.communityService.getPublicPostById(id);
  }

  @Post('public/community/posts')
  @ApiBearerAuth()
  async createPublicPost(
    @Body() dto: UpsertCommunityPostDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.communityService.create({
      ...dto,
      userId: this.requireUserId(req),
      userEmail: req.user?.email ?? dto.userEmail ?? '',
      status: 'pending_review',
      // Public submissions cannot self-assign engagement counters or the
      // featured slot: counts only grow from real reactions, featuring is
      // an editorial decision (report P3-3).
      likes: 0,
      saves: 0,
      featured: false,
    });
  }

  @Post('public/community/upload')
  @ApiBearerAuth()
  // One endpoint for both community media kinds: a photo and a live photo
  // (实况图) differ only by the file the traveller picked, so the client never
  // branches. The multer ceiling is the live one and the image ceiling is
  // enforced per type inside verifyCommunityUpload. Without a dedicated
  // throttle the global 60/min would be enough to fill the uploads volume
  // (report P2-C).
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({
    summary: 'Upload a photo or live photo for a community post (public)',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_LIVE_FILE_SIZE },
    }),
  )
  async uploadCommunityMedia(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    await this.verifyCommunityUpload(file);
    const result = await this.uploadService.storeUploadedFile(
      file,
      'community',
    );
    return { url: result.url };
  }

  /**
   * @deprecated Compatibility alias only. Live photos upload through
   * `/public/community/upload` exactly like images; this path survives so a
   * client built against the previous contract does not 404. Remove it once no
   * shipped client calls it.
   */
  @Post('public/community/upload/video')
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({
    summary:
      'Deprecated alias for a live photo upload (use /public/community/upload)',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_LIVE_FILE_SIZE },
    }),
  )
  async uploadCommunityMediaAlias(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    await this.verifyCommunityUpload(file);
    const result = await this.uploadService.storeUploadedFile(
      file,
      'community',
    );
    return { url: result.url };
  }

  @Get('public/community/me/reactions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user community reactions' })
  async getMyCommunityReactions(@Req() req: AuthenticatedRequest) {
    return this.communityService.getReactionSummary(this.requireUserId(req));
  }

  @Get('public/community/me/saves')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get posts saved by the current user' })
  async getMySavedCommunityPosts(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit = 12,
  ) {
    return this.communityService.listSavedPosts(
      this.requireUserId(req),
      +limit,
    );
  }

  @Post('public/community/posts/:id/like')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle like on a post' })
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async likePost(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.communityService.toggleLike(id, this.requireUserId(req));
  }

  @Post('public/community/posts/:id/save')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle save on a post' })
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async savePost(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.communityService.toggleSave(id, this.requireUserId(req));
  }

  @Roles('admin', 'editor')
  @Get('admin/community/posts')
  @ApiBearerAuth()
  @ApiQuery({ name: 'status', required: false, enum: COMMUNITY_POST_STATUSES })
  @ApiQuery({ name: 'channel', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'includeDeleted', required: false, type: Boolean })
  async getAdminPosts(
    @Query('status') status?: CommunityPostStatus,
    @Query('channel') channel?: string,
    @Query('q') q?: string,
    @Query('includeDeleted') includeDeleted?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.communityService.listAdmin({
      status,
      channel,
      q,
      includeDeleted: includeDeleted === 'true' || includeDeleted === '1',
      page: +page,
      limit: +limit,
    });
  }

  @Roles('admin', 'editor')
  @Get('admin/community/posts/:id')
  @ApiBearerAuth()
  async getAdminPost(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.communityService.getAdminById(id, true);
  }

  @Roles('admin', 'editor')
  @Post('admin/community/posts')
  @ApiBearerAuth()
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction('create', 'community_post')
  async createAdminPost(@Body() dto: UpsertCommunityPostDto) {
    return this.communityService.create(dto);
  }

  @Roles('admin', 'editor')
  @Put('admin/community/posts/:id')
  @ApiBearerAuth()
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction('update', 'community_post')
  async updateAdminPost(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpsertCommunityPostDto,
  ) {
    return this.communityService.update(id, dto);
  }

  @Roles('admin', 'editor')
  @Patch('admin/community/posts/:id/status')
  @ApiBearerAuth()
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction('update', 'community_post')
  async updateAdminPostStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCommunityStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.communityService.updateStatus(id, dto.status, {
      userId: req.user?.sub,
      reason: dto.reason,
    });
  }

  @Roles('admin', 'editor')
  @Patch('admin/community/posts/:id/review')
  @ApiBearerAuth()
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction('review', 'community_post')
  async reviewAdminPost(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCommunityStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.communityService.updateStatus(id, dto.status, {
      userId: req.user?.sub,
      reason: dto.reason,
    });
  }

  @Roles('admin', 'editor')
  @Post('admin/community/posts/:id/resend-email')
  @ApiBearerAuth()
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction('update', 'community_post')
  @ApiOperation({
    summary: 'Re-send the review-outcome email for a post (admin)',
  })
  async resendReviewEmail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.communityService.resendReviewEmail(id);
  }

  @Roles('admin', 'editor')
  @Patch('admin/community/posts/:id/featured')
  @ApiBearerAuth()
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction('update', 'community_post')
  async toggleFeatured(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body('featured') featured: boolean,
  ) {
    return this.communityService.toggleFeatured(id, featured);
  }

  @Roles('admin', 'editor')
  @Delete('admin/community/posts/:id')
  @ApiBearerAuth()
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction('delete', 'community_post')
  @ApiOperation({ summary: 'Soft-delete a post' })
  async deleteAdminPost(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.communityService.remove(id);
  }

  @Roles('admin', 'editor')
  @Post('admin/community/posts/:id/restore')
  @ApiBearerAuth()
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction('restore', 'community_post')
  @ApiOperation({ summary: 'Restore a soft-deleted post' })
  async restoreAdminPost(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.communityService.restore(id);
  }

  @Public()
  @Get('public/community/briefs')
  @ApiOperation({ summary: 'List active community field briefs (public)' })
  async getPublicBriefs() {
    return this.communityService.listPublicBriefs();
  }

  @Roles('admin', 'editor')
  @Get('admin/community/briefs')
  @ApiBearerAuth()
  async getAdminBriefs() {
    return this.communityService.listAdminBriefs();
  }

  @Roles('admin', 'editor')
  @Get('admin/community/briefs/:id')
  @ApiBearerAuth()
  async getAdminBrief(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.communityService.getAdminBriefById(id);
  }

  @Roles('admin', 'editor')
  @Post('admin/community/briefs')
  @ApiBearerAuth()
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction('create', 'community_brief')
  async createAdminBrief(@Body() dto: UpsertCommunityBriefDto) {
    return this.communityService.createBrief(dto);
  }

  @Roles('admin', 'editor')
  @Put('admin/community/briefs/:id')
  @ApiBearerAuth()
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction('update', 'community_brief')
  async updateAdminBrief(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpsertCommunityBriefDto,
  ) {
    return this.communityService.updateBrief(id, dto);
  }

  @Roles('admin', 'editor')
  @Delete('admin/community/briefs/:id')
  @ApiBearerAuth()
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction('delete', 'community_brief')
  async deleteAdminBrief(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.communityService.removeBrief(id);
  }
}
