// ============================================
// 社区帖子管理 TypeScript 类型定义
// ============================================

/**
 * 频道值必须与后端/site 实际存储的字符串一致（带空格），
 * 筛选时才能命中数据。
 */
export type PostChannel = 'Field Notes' | 'Food Map' | 'Hidden Stop' | 'Culture Desk'
export type PostStatus = 'published' | 'pending_review' | 'hidden'

export interface CommunityPostMedia {
  type: 'image' | 'live'
  url: string
}

export interface CommunityPost {
  id: string
  userName: string
  userHandle: string
  userAvatar: string
  image: string
  media: CommunityPostMedia[]
  title: string
  excerpt: string
  content: string
  location: string
  route: string
  date: string
  channel: PostChannel
  mood: string
  tags: string[]
  likes: number
  saves: number
  status: PostStatus
  featured: boolean
  reviewedBy: string | null
  reviewedAt: string | null
  rejectionReason: string | null
  deletedAt: string | null
}

// ─── 状态/频道显示映射 ──────────────────────────────
export const PostChannelMap: Record<PostChannel, string> = {
  'Field Notes': '田野笔记',
  'Food Map': '美食地图',
  'Hidden Stop': '秘境停靠',
  'Culture Desk': '文化台',
}

export const PostChannelColorMap: Record<PostChannel, string> = {
  'Field Notes': '',
  'Food Map': 'warning',
  'Hidden Stop': 'success',
  'Culture Desk': 'primary',
}

export const PostStatusMap: Record<PostStatus, string> = {
  published: '已发布',
  pending_review: '待审核',
  hidden: '已隐藏',
}

export const PostStatusColorMap: Record<PostStatus, string> = {
  published: 'success',
  pending_review: 'warning',
  hidden: 'info',
}
