import api from './index'
import type { ApiResponse, PaginatedResponse, PageParams } from '@/types/common'
import { readContentValue } from '@/types/common'
import type { CommunityPost, CommunityPostMedia, PostStatus } from '@/types/community'

function normalizePost(raw: any): CommunityPost {
  const user = raw.user || {}
  const media = (Array.isArray(raw.media) ? raw.media : []).filter(
    (item: any): item is CommunityPostMedia =>
      Boolean(item?.url) && (item.type === 'image' || item.type === 'live'),
  )
  return {
    id: raw.id,
    userName: user.name || raw.userName || 'Culvoy User',
    userHandle: user.handle || raw.userHandle || 'guest',
    userAvatar: user.avatar || raw.userAvatar || '',
    image: raw.image || '',
    media,
    title: readContentValue(raw.title),
    excerpt: readContentValue(raw.excerpt),
    content: readContentValue(raw.content ?? raw.excerpt),
    location: raw.location || '',
    route: raw.route || '',
    date: (raw.createdAt && typeof raw.createdAt === 'string') ? new Date(raw.createdAt).toLocaleDateString('zh-CN') : '',
    channel: raw.channel,
    mood: raw.mood || '',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    likes: raw.likes ?? 0,
    saves: raw.saves ?? 0,
    status: raw.status,
    featured: raw.featured ?? false,
    reviewedBy: raw.reviewedBy ?? null,
    reviewedAt: raw.reviewedAt ?? null,
    rejectionReason: raw.rejectionReason ?? null,
    deletedAt: raw.deletedAt ?? null,
  }
}

function normalizeListResponse(res: any) {
  res.data.data.data = (res.data.data.data || []).map(normalizePost)
  return res
}

function normalizeDetailResponse(res: any) {
  res.data.data = normalizePost(res.data.data)
  return res
}

export const communityApi = {
  async getPosts(params: PageParams & { channel?: string; status?: string }) {
    const res = await api.get<ApiResponse<PaginatedResponse<CommunityPost>>>('/community/posts', {
      params: { ...params, limit: params.pageSize },
    })
    return normalizeListResponse(res)
  },

  async getPost(id: string) {
    const res = await api.get<ApiResponse<CommunityPost>>(`/community/posts/${id}`)
    return normalizeDetailResponse(res)
  },

  /** 审核帖子状态（通过/隐藏），可附带拒绝原因 */
  reviewPost(id: string, status: PostStatus, rejectionReason?: string) {
    return api.patch<ApiResponse<CommunityPost>>(`/community/posts/${id}/review`, {
      status,
      reason: rejectionReason,
    })
  },

  /** 切换精选状态 */
  toggleFeatured(id: string, featured: boolean) {
    return api.patch<ApiResponse<CommunityPost>>(`/community/posts/${id}/featured`, { featured })
  },

  /** 重发帖子审核结果邮件（通过 / 驳回都会如实告知作者） */
  resendReviewEmail(id: string) {
    return api.post<ApiResponse<{ ok: boolean; message: string }>>(
      `/community/posts/${id}/resend-email`,
    )
  },

  /** 软删除帖子 */
  deletePost(id: string) {
    return api.delete<ApiResponse<null>>(`/community/posts/${id}`)
  },

  /** 恢复软删除的帖子 */
  restorePost(id: string) {
    return api.post<ApiResponse<CommunityPost>>(`/community/posts/${id}/restore`)
  },
}
