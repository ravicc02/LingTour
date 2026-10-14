<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { communityApi } from '@/api/community'
import type { CommunityPost, PostChannel, PostStatus } from '@/types/community'
import { PostChannelMap, PostChannelColorMap, PostStatusMap, PostStatusColorMap } from '@/types/community'
import { useListPage } from '@/composables/useListPage'
import { ListToolbar } from '@/components/list'
import { resolveMediaUrl } from '@/utils/media'
import { useIsMobile } from '@/composables/useIsMobile'

const isMobile = useIsMobile()

const router = useRouter()

// ─── 列表数据 (useListPage) ─────────────
const {
  loading, list, total, page, pageSize,
  filters,
  handlePageChange, handleSizeChange,
  handleSearch, handleReset,
} = useListPage<CommunityPost>({
  fetchApi: (params) => communityApi.getPosts(params as any),
  defaultFilters: { keyword: '', channel: '', status: '' },
})

// ─── 操作 ──────────────────────────────
function handleViewDetail(post: CommunityPost) {
  router.push(`/admin/community/${post.id}`)
}

async function handleReview(post: CommunityPost, status: PostStatus, rejectionReason?: string) {
  const isPublish = status === 'published'
  const actionText = isPublish ? '审核通过' : '隐藏帖子'
  try {
    await ElMessageBox.confirm(
      `确定${actionText}「${post.title || '该帖子'}」?`,
      `${actionText}确认`,
      { type: isPublish ? 'success' : 'warning' }
    )
    await communityApi.reviewPost(post.id, status, rejectionReason)
    ElMessage.success(isPublish ? '审核通过' : '已隐藏')
    handleSearch()
  } catch (err: any) {
    if (err?.response) ElMessage.error(err.response.data?.message || '操作失败')
  }
}

/** 重发审核结果邮件：正文取自帖子当前状态，与审核时的通知一致 */
async function handleResendReviewEmail(post: CommunityPost) {
  try {
    const res = await communityApi.resendReviewEmail(post.id)
    const payload = res.data?.data
    if (payload?.ok === false) {
      ElMessage.warning(payload.message)
    } else {
      ElMessage.success(payload?.message ?? '已重发')
    }
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '重发失败')
  }
}

async function handleToggleFeatured(post: CommunityPost) {
  try {
    await communityApi.toggleFeatured(post.id, !post.featured)
    ElMessage.success(post.featured ? '已取消精选' : '已设为精选')
    handleSearch()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '操作失败')
  }
}

async function handleDelete(post: CommunityPost) {
  try {
    await ElMessageBox.confirm(
      `确定删除「${post.title || '该帖子'}」?为软删除,可在后台恢复。`,
      '删除确认',
      { type: 'warning' }
    )
    await communityApi.deletePost(post.id)
    ElMessage.success('帖子已删除(软删除)')
    handleSearch()
  } catch (err: any) {
    if (err?.response) ElMessage.error(err.response.data?.message || '删除失败')
  }
}

function getChannelLabel(channel: string): string {
  return PostChannelMap[channel as PostChannel] || channel
}
function getChannelType(channel: string): string {
  return PostChannelColorMap[channel as PostChannel] || ''
}
function getStatusLabel(status: string): string {
  return PostStatusMap[status as PostStatus] || status
}
function getStatusType(status: string): string {
  return PostStatusColorMap[status as PostStatus] || 'info'
}

function formatInteractions(post: CommunityPost): string {
  return `👍${post.likes} ⭐${post.saves}`
}

/** 列表缩略图：优先多图 / live 实况图媒体首项，回退旧单图字段。 */
function getCoverUrl(post: CommunityPost): string {
  return post.media[0]?.url || post.image || ''
}

function getCoverType(post: CommunityPost): 'image' | 'live' | null {
  if (post.media[0]) return post.media[0].type
  return post.image ? 'image' : null
}
</script>

<template>
  <div>
    <div class="page-header">
      <h2>社区帖子管理</h2>
    </div>

    <ListToolbar
      v-model="filters.keyword"
      search-placeholder="搜索标题/作者"
      @search="handleSearch"
      @reset="handleReset"
    >
      <el-select
        v-model="filters.channel"
        placeholder="频道筛选"
        clearable
        style="width: 150px"
        @change="handleSearch"
      >
        <el-option label="全部频道" value="" />
        <el-option label="田野笔记" value="Field Notes" />
        <el-option label="美食地图" value="Food Map" />
        <el-option label="秘境停靠" value="Hidden Stop" />
        <el-option label="文化台" value="Culture Desk" />
      </el-select>
      <el-select
        v-model="filters.status"
        placeholder="状态筛选"
        clearable
        style="width: 140px"
        @change="handleSearch"
      >
        <el-option label="全部状态" value="" />
        <el-option label="已发布" value="published" />
        <el-option label="待审核" value="pending_review" />
        <el-option label="已隐藏" value="hidden" />
      </el-select>
    </ListToolbar>

    <el-card shadow="never" class="table-card">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column label="图片" width="90">
          <template #default="{ row }">
            <el-image
              v-if="getCoverType(row) === 'image'"
              :src="resolveMediaUrl(getCoverUrl(row))"
              class="admin-list-thumb"
              fit="cover"
              preview-teleported
            >
              <template #error>
                <span class="admin-list-empty">无图</span>
              </template>
            </el-image>
            <video
              v-else-if="getCoverType(row) === 'live'"
              :src="resolveMediaUrl(getCoverUrl(row))"
              muted
              loop
              playsinline
              preload="metadata"
              class="admin-list-thumb admin-list-thumb-live"
            ></video>
            <span v-else class="admin-list-empty">无图</span>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
        <el-table-column label="用户" width="150">
          <template #default="{ row }">
            <div class="admin-list-inline">
              <el-avatar v-if="row.userAvatar" :src="row.userAvatar" :size="28" />
              <div>
                <div style="font-size: 13px">{{ row.userName }}</div>
                <div class="admin-list-meta-compact">@{{ row.userHandle }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="频道" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getChannelType(row.channel)" size="small">
              {{ getChannelLabel(row.channel) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="date" label="日期" width="110" align="center" />
        <el-table-column label="互动" width="130" align="center">
          <template #default="{ row }">
            <span class="admin-list-note">{{ formatInteractions(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="精选" width="70" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.featured" type="warning" size="small">★</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="310" :fixed="isMobile ? false : 'right'">
          <template #default="{ row }">
            <div class="admin-table-actions">
              <el-button type="primary" link size="small" @click="handleViewDetail(row)">详情</el-button>
              <template v-if="row.status === 'pending_review'">
                <el-button type="success" link size="small" @click="handleReview(row, 'published')">
                  通过
                </el-button>
                <el-button type="warning" link size="small" @click="handleReview(row, 'hidden')">
                  隐藏
                </el-button>
              </template>
              <template v-if="row.status === 'published'">
                <el-button type="warning" link size="small" @click="handleReview(row, 'hidden')">
                  隐藏
                </el-button>
              </template>
              <template v-if="row.status === 'hidden'">
                <el-button type="success" link size="small" @click="handleReview(row, 'published')">
                  恢复
                </el-button>
              </template>
              <el-button
                :type="row.featured ? 'info' : 'warning'"
                link
                size="small"
                @click="handleToggleFeatured(row)"
              >
                {{ row.featured ? '取消精选' : '精选' }}
              </el-button>
              <el-button
                v-if="row.status !== 'pending_review'"
                type="primary"
                link
                size="small"
                @click="handleResendReviewEmail(row)"
              >
                重发邮件
              </el-button>
              <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>
  </div>
</template>

<style scoped>
/* live 实况图和图片一样，以片段首帧作为缩略图，沿用同一 50×50 尺寸。 */
.admin-list-thumb-live {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>
