import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  COMMUNITY_POST_MEDIA_TYPES,
  COMMUNITY_POST_STATUSES,
  COMMUNITY_POST_MEDIA_LIMIT,
  type CommunityPostMediaItem,
  type CommunityPostStatus,
} from '../entities/community-post.entity';
import { IsMediaLibraryPath } from '../../../common/validators/media-library.validator';

export class CommunityPostMediaItemDto implements CommunityPostMediaItem {
  @ApiProperty({ enum: COMMUNITY_POST_MEDIA_TYPES })
  @IsIn(COMMUNITY_POST_MEDIA_TYPES)
  type: CommunityPostMediaItem['type'];

  @ApiProperty({ description: '图片或 live 实况图的 /uploads/... 相对路径' })
  @IsString()
  @MaxLength(500)
  @IsMediaLibraryPath()
  url: string;
}

export class UpsertCommunityPostDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  channel: string;

  @ApiPropertyOptional({
    enum: COMMUNITY_POST_STATUSES,
    default: 'published',
    description:
      '管理后台创建时可指定；公开提交端点会忽略此字段并强制 pending_review',
  })
  @IsOptional()
  @IsIn(COMMUNITY_POST_STATUSES)
  status?: CommunityPostStatus;

  @ApiProperty({ type: Object })
  @IsObject()
  user: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  userEmail?: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  excerpt: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsMediaLibraryPath()
  image?: string;

  @ApiPropertyOptional({
    type: [CommunityPostMediaItemDto],
    maxItems: COMMUNITY_POST_MEDIA_LIMIT,
    description:
      '多图 / live 实况图媒体数组；type=live 时 url 为实况图文件路径（与图片共用上传端点），上限 9 项',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(COMMUNITY_POST_MEDIA_LIMIT)
  @ValidateNested({ each: true })
  @Type(() => CommunityPostMediaItemDto)
  media?: CommunityPostMediaItem[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  route?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mood?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  likes?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  saves?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  featured?: boolean;
}
