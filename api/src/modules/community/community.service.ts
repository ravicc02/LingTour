import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { clampPagination } from '../../common/pagination';
import {
  CommunityPost,
  CommunityPostStatus,
} from './entities/community-post.entity';
import { CommunityBrief } from './entities/community-brief.entity';
import { CommunityPostLike } from './entities/community-post-like.entity';
import { CommunityPostSave } from './entities/community-post-save.entity';
import { UpsertCommunityPostDto } from './dto/upsert-community-post.dto';
import { UpsertCommunityBriefDto } from './dto/upsert-community-brief.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { MailerService } from '../email/mailer.service';

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CommunityPost)
    private readonly postRepo: Repository<CommunityPost>,
    @InjectRepository(CommunityBrief)
    private readonly briefRepo: Repository<CommunityBrief>,
    @InjectRepository(CommunityPostLike)
    private readonly likeRepo: Repository<CommunityPostLike>,
    @InjectRepository(CommunityPostSave)
    private readonly saveRepo: Repository<CommunityPostSave>,
    private readonly notificationsService: NotificationsService,
    private readonly mailerService: MailerService,
  ) {}

  async getPublicPosts(query: {
    channel?: string;
    route?: string;
    location?: string;
    tag?: string;
    q?: string;
    page?: number;
    limit?: number;
  }) {
    const { page, limit, skip } = clampPagination(query.page, query.limit);
    const qb = this.postRepo
      .createQueryBuilder('p')
      .where('p.status = :status', {
        status: 'published',
      });

    if (query.channel) {
      qb.andWhere('p.channel = :channel', { channel: query.channel });
    }
    if (query.route) {
      qb.andWhere('p.route = :route', { route: query.route });
    }
    if (query.location) {
      qb.andWhere('p.location = :location', { location: query.location });
    }
    if (query.tag) {
      qb.andWhere('p.tags::text ILIKE :tag', { tag: `%${query.tag}%` });
    }
    if (query.q) {
      qb.andWhere(
        '(p.title::text ILIKE :q OR p.excerpt::text ILIKE :q OR p.route ILIKE :q OR p.location ILIKE :q OR p.tags::text ILIKE :q)',
        { q: `%${query.q}%` },
      );
    }

    const [items, total] = await qb
      .orderBy('p.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { data: items, total, page, pageSize: limit };
  }

  async getPublicPostById(id: string) {
    const post = await this.postRepo.findOne({
      where: { id, status: 'published' },
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async listAdmin(query: {
    status?: CommunityPostStatus;
    channel?: string;
    q?: string;
    page?: number;
    limit?: number;
    /** 是否包含已软删除的记录，默认不包含 */
    includeDeleted?: boolean;
  }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;

    const qb = this.postRepo.createQueryBuilder('p');
    if (query.includeDeleted) qb.withDeleted();
    if (query.status)
      qb.andWhere('p.status = :status', { status: query.status });
    if (query.channel)
      qb.andWhere('p.channel = :channel', { channel: query.channel });
    if (query.q) {
      qb.andWhere('(p.title::text ILIKE :q OR p.excerpt::text ILIKE :q)', {
        q: `%${query.q}%`,
      });
    }

    const [items, total] = await qb
      .orderBy('p.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data: items, total, page, pageSize: limit };
  }

  async getAdminById(id: string, includeDeleted = false) {
    const post = await this.postRepo.findOne({
      where: { id },
      withDeleted: includeDeleted,
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async create(dto: UpsertCommunityPostDto) {
    const post = this.postRepo.create({
      channel: dto.channel,
      status: dto.status ?? 'published',
      user: dto.user,
      userId: dto.userId ?? null,
      userEmail: dto.userEmail ?? '',
      title: dto.title,
      excerpt: dto.excerpt,
      tags: dto.tags ?? [],
      image: dto.image ?? null,
      media: dto.media ?? [],
      location: dto.location ?? '',
      route: dto.route ?? '',
      mood: dto.mood ?? '',
      featured: dto.featured ?? false,
      likes: dto.likes ?? 0,
      // 评论功能已下线：计数列仅为兼容历史数据保留，新帖固定为 0。
      comments: 0,
      saves: dto.saves ?? 0,
    });
    const saved = await this.postRepo.save(post);
    if (saved.status === 'pending_review') {
      await this.notificationsService.notifyStaff({
        type: 'review',
        title: '新的社区内容待审核',
        body:
          saved.title ||
          `${saved.user} 提交了一篇社区内容。`,
        resourceType: 'community_post',
        resourceId: saved.id,
        link: `/admin/community/${saved.id}`,
      });
    }
    return saved;
  }

  async update(id: string, dto: UpsertCommunityPostDto) {
    const post = await this.getAdminById(id);
    Object.assign(post, dto);
    if (dto.status) post.status = dto.status;
    if (dto.userId !== undefined) post.userId = dto.userId;
    if (dto.userEmail !== undefined) post.userEmail = dto.userEmail;
    if (dto.media !== undefined) post.media = dto.media;
    return this.postRepo.save(post);
  }

  /**
   * 修改帖子状态。如果是 admin 操作，会同步记录 reviewer 信息。
   */
  async updateStatus(
    id: string,
    status: CommunityPostStatus,
    reviewer?: { userId?: string; reason?: string },
  ) {
    const post = await this.getAdminById(id);
    const previousStatus = post.status;
    post.status = status;
    post.reviewedAt = new Date();
    if (reviewer?.userId) {
      post.reviewedBy = reviewer.userId;
    }
    if (reviewer?.reason !== undefined) {
      post.rejectionReason = reviewer.reason || null;
    }
    const saved = await this.postRepo.save(post);

    // The author is told once, when the decision itself changes — saving the
    // same status again (or editing an unrelated field) must not email them a
    // second time.
    if (
      saved.status !== previousStatus &&
      (saved.status === 'published' || saved.status === 'hidden')
    ) {
      await this.sendReviewEmail(saved);
    }
    return saved;
  }

  // ─── Notification email ───────────────────────────────────────────

  /**
   * Tells the author whether their note went live. A submission may carry no
   * mailbox at all, so a missing address is reported instead of bounced.
   * Never throws: a mail problem must not fail an admin review action.
   */
  private async sendReviewEmail(
    post: CommunityPost,
  ): Promise<{ ok: boolean; message: string }> {
    const to = (post.userEmail ?? '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.toLowerCase())) {
      return { ok: false, message: '该帖子没有可投递的邮箱地址。' };
    }

    const approved = post.status === 'published';
    try {
      const sent = await this.mailerService.sendTemplated(
        'community_post_reviewed',
        to,
        {
          title: approved
            ? 'Your community post is live'
            : 'Your community post needs another look',
          postTitle: post.title,
          result: approved ? 'Approved' : 'Not approved',
          reason: approved
            ? 'No further action is needed — your note is now visible on the community page.'
            : post.rejectionReason?.trim() ||
              'The review team sent it back. Please revise the post and submit it again.',
          siteName: 'Culvoy',
        },
        'en',
        { resourceType: 'community_post', resourceId: post.id },
      );
      return sent
        ? { ok: true, message: `已通知 ${to}。` }
        : { ok: false, message: '发送未成功，请在「发送日志」中查看原因。' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Community review email for post ${post.id} failed: ${message}`,
      );
      return { ok: false, message: `发送失败：${message}` };
    }
  }

  /** Admin: re-send the review-outcome email for a post. */
  async resendReviewEmail(
    id: string,
  ): Promise<{ ok: boolean; message: string }> {
    const post = await this.getAdminById(id);
    return this.sendReviewEmail(post);
  }

  async toggleFeatured(id: string, featured: boolean) {
    const post = await this.getAdminById(id);
    post.featured = featured;
    return this.postRepo.save(post);
  }

  /**
   * 软删除：保留数据库记录，仅设置 deletedAt。
   * 列表默认不会查到，仍可通过 includeDeleted = true 查回。
   */
  async remove(id: string) {
    const post = await this.getAdminById(id);
    await this.postRepo.softRemove(post);
    return { deleted: true };
  }

  /**
   * 恢复已软删除的帖子。
   */
  async restore(id: string) {
    const post = await this.getAdminById(id, true);
    if (!post.deletedAt) {
      return post; // 没删过，无需恢复
    }
    await this.postRepo.recover(post);
    return this.getAdminById(id);
  }

  async getReactionSummary(userId: string) {
    const [likedRows, savedRows] = await Promise.all([
      this.likeRepo
        .createQueryBuilder('reaction')
        .select('reaction.post_id', 'postId')
        .where('reaction.user_id = :userId', { userId })
        .getRawMany<{ postId: string }>(),
      this.saveRepo
        .createQueryBuilder('reaction')
        .select('reaction.post_id', 'postId')
        .where('reaction.user_id = :userId', { userId })
        .getRawMany<{ postId: string }>(),
    ]);

    return {
      likedPostIds: likedRows.map((row) => row.postId),
      savedPostIds: savedRows.map((row) => row.postId),
    };
  }

  async listSavedPosts(userId: string, limit = 12) {
    const safeLimit = Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), 50)
      : 12;
    const saves = await this.saveRepo
      .createQueryBuilder('save')
      .innerJoinAndSelect('save.post', 'post')
      .where('save.user_id = :userId', { userId })
      .andWhere('post.status = :status', {
        status: 'published' as CommunityPostStatus,
      })
      .orderBy('save.createdAt', 'DESC')
      .take(safeLimit)
      .getMany();

    if (!saves.length) return [];

    const likedIds = new Set(
      (
        await this.likeRepo
          .createQueryBuilder('like')
          .select('like.post_id', 'postId')
          .where('like.user_id = :userId', { userId })
          .andWhere('like.post_id IN (:...postIds)', {
            postIds: saves.map((save) => save.post.id),
          })
          .getRawMany<{ postId: string }>()
      ).map((row) => row.postId),
    );

    return saves.map((save) => ({
      ...save.post,
      liked: likedIds.has(save.post.id),
      saved: true,
    }));
  }

  async toggleLike(id: string, userId: string) {
    return this.toggleReaction(id, userId, 'likes');
  }

  async toggleSave(id: string, userId: string) {
    return this.toggleReaction(id, userId, 'saves');
  }

  private async toggleReaction(
    id: string,
    userId: string,
    field: 'likes' | 'saves',
  ) {
    const result = await this.dataSource.transaction(async (manager) => {
      const post = await manager.findOne(CommunityPost, {
        where: { id, status: 'published' as CommunityPostStatus },
        lock: { mode: 'pessimistic_write' },
      });
      if (!post) throw new NotFoundException('Post not found');

      const repo =
        field === 'likes'
          ? manager.getRepository(CommunityPostLike)
          : manager.getRepository(CommunityPostSave);
      const existing = await repo.findOne({
        where: {
          user: { id: userId },
          post: { id },
        },
      });

      if (existing) {
        await repo.remove(existing);
        await manager
          .createQueryBuilder()
          .update(CommunityPost)
          .set(
            field === 'likes'
              ? { likes: () => 'GREATEST("likes" - 1, 0)' }
              : { saves: () => 'GREATEST("saves" - 1, 0)' },
          )
          .where('id = :id', { id })
          .execute();
        return { active: false };
      }

      await repo.save(
        repo.create({
          user: { id: userId },
          post: { id },
        }),
      );
      await manager
        .createQueryBuilder()
        .update(CommunityPost)
        .set(
          field === 'likes'
            ? { likes: () => '"likes" + 1' }
            : { saves: () => '"saves" + 1' },
        )
        .where('id = :id', { id })
        .execute();
      return { active: true };
    });

    const post = await this.postRepo.findOne({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');

    return field === 'likes'
      ? { liked: result.active, likes: post.likes }
      : { saved: result.active, saves: post.saves };
  }

  // ── Field Briefs ──

  /** 公开端点：列出当前可见的 brief，按 sortOrder 升序。 */
  async listPublicBriefs() {
    return this.briefRepo.find({
      where: { active: true },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  /** 管理端：列出所有 brief（包含已下线）。 */
  async listAdminBriefs() {
    return this.briefRepo.find({
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async getAdminBriefById(id: string) {
    const brief = await this.briefRepo.findOne({ where: { id } });
    if (!brief) throw new NotFoundException('Brief not found');
    return brief;
  }

  async createBrief(dto: UpsertCommunityBriefDto) {
    const existing = await this.briefRepo.findOne({
      where: { slug: dto.slug },
    });
    if (existing) {
      // 同 slug 视为更新（这是 upsert，不是「同名报错」）
      Object.assign(existing, {
        title: dto.title,
        prompt: dto.prompt,
        channel: dto.channel ?? existing.channel,
        location: dto.location ?? existing.location,
        route: dto.route ?? existing.route,
        mood: dto.mood ?? existing.mood,
        sortOrder: dto.sortOrder ?? existing.sortOrder,
        active: dto.active ?? existing.active,
      });
      return this.briefRepo.save(existing);
    }

    const brief = this.briefRepo.create({
      slug: dto.slug,
      title: dto.title,
      prompt: dto.prompt,
      channel: dto.channel ?? 'Field Notes',
      location: dto.location ?? '',
      route: dto.route ?? '',
      mood: dto.mood ?? '',
      sortOrder: dto.sortOrder ?? 0,
      active: dto.active ?? true,
    });
    return this.briefRepo.save(brief);
  }

  async updateBrief(id: string, dto: UpsertCommunityBriefDto) {
    const brief = await this.getAdminBriefById(id);
    Object.assign(brief, dto);
    return this.briefRepo.save(brief);
  }

  async removeBrief(id: string) {
    const brief = await this.getAdminBriefById(id);
    await this.briefRepo.remove(brief);
    return { deleted: true };
  }

}
