<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { communityApi } from '@/api/community'
import type { CommunityPost, PostStatus, PostChannel } from '@/types/community'
import { PostChannelMap, PostChannelColorMap, PostStatusMap, PostStatusColorMap } from '@/types/community'
import { resolveMediaUrl } from '@/utils/media'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const post = ref<CommunityPost | null>(null)
const associations = ref({ citySlug: null as string | null, routeId: null as string | null, interpreterId: null as string | null })
const associationOptions = ref<{ cities: { slug: string; name: string }[]; routes: { id: string; title: string }[]; interpreters: { id: string; name: string }[] }>({ cities: [], routes: [], interpreters: [] })
const savingAssociations = ref(false)
const bookingId = ref('')
const verifying = ref(false)
const associationError = ref('')

async function saveAssociations() {
  if (!post.value || savingAssociations.value) return
  savingAssociations.value = true
  associationError.value = ''
  try {
    await communityApi.updateAssociations(post.value.id, { citySlug: associations.value.citySlug || null, routeId: associations.value.routeId || null, interpreterId: associations.value.interpreterId || null })
    await fetchPost()
    ElMessage.success('关联已保存；真实体验标记需重新核验')
  } catch (error: any) {
    associationError.value = error?.response?.data?.message || '关联保存失败'
  } finally { savingAssociations.value = false }
}

async function verifyExperience(clear = false) {
  if (!post.value || verifying.value) return
  verifying.value = true
  associationError.value = ''
  try {
    await communityApi.verifyExperience(post.value.id, clear ? null : bookingId.value.trim())
    await fetchPost()
    ElMessage.success(clear ? '已取消真实体验标记' : '有效服务记录核验通过')
  } catch (error: any) {
    associationError.value = error?.response?.data?.message || '核验失败'
  } finally { verifying.value = false }
}

async function fetchPost() {
  loading.value = true
  try {
    const res = await communityApi.getPost(route.params.id as string)
    const loaded = res.data.data
    post.value = loaded
    associations.value = { citySlug: loaded.citySlug, routeId: loaded.routeId, interpreterId: loaded.interpreterId }
    bookingId.value = loaded.verifiedBookingId || ''
  } catch {
    ElMessage.error('帖子不存在')
    router.push('/admin/community')
  } finally {
    loading.value = false
  }
}

/** 详情媒体列表：优先多图/Live 数组，回退旧单图字段。 */
const mediaItems = computed(() => {
  if (!post.value) return []
  if (post.value.media.length) return post.value.media
  return post.value.image ? [{ type: 'image' as const, url: post.value.image }] : []
})

function formatDateTime(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN')
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

async function handleReview(status: PostStatus) {
  if (!post.value) return
  try {
    let reason: string | undefined
    if (status === 'hidden') {
      const { value } = await ElMessageBox.prompt(
        '隐藏后该帖子将不再对用户展示，可填写原因（仅运营内部留痕）。',
        '隐藏帖子',
        { type: 'warning', inputPlaceholder: '隐藏原因（可选）' },
      )
      reason = value?.trim() || undefined
    } else {
      await ElMessageBox.confirm(
        `确定审核通过「${post.value.title || '该帖子'}」?通过后将对外展示。`,
        '审核通过确认',
        { type: 'success' },
      )
    }
    await communityApi.reviewPost(post.value.id, status, reason)
    ElMessage.success(status === 'published' ? '审核通过' : '已隐藏')
    await fetchPost()
  } catch (err: any) {
    if (err === 'cancel' || err === 'close') return
    if (err?.response) {
      ElMessage.error(err.response.data?.message || '操作失败')
      return
    }
    ElMessage.error('操作失败')
  }
}

async function handleDelete() {
  if (!post.value) return
  try {
    await communityApi.deletePost(post.value.id)
    ElMessage.success('帖子已删除')
    router.push('/admin/community')
  } catch {
    ElMessage.error('删除失败')
  }
}

function handleBack() {
  router.push('/admin/community')
}

onMounted(async () => {
  fetchPost()
  try { associationOptions.value = (await communityApi.associationOptions()).data.data }
  catch { associationError.value = '可关联内容加载失败，请刷新重试' }
})
</script>

<template>
  <div class="detail-page" v-loading="loading">
    <div class="page-header">
      <div class="detail-heading">
        <el-button :icon="ArrowLeft" @click="handleBack">返回列表</el-button>
        <h2>帖子详情</h2>
      </div>
    </div>

    <template v-if="post">
      <!-- 帖子主体 -->
      <el-card shadow="never" class="post-card">
        <!-- 媒体（多图 / live 实况图，回退旧单图） -->
        <div v-if="mediaItems.length" class="post-image-wrap">
          <div
            v-for="(item, index) in mediaItems"
            :key="item.url + index"
            class="post-media-item"
          >
            <video
              v-if="item.type === 'live'"
              :src="resolveMediaUrl(item.url)"
              muted
              loop
              playsinline
              preload="metadata"
              class="post-media-video"
            ></video>
            <el-image
              v-else
              :src="resolveMediaUrl(item.url)"
              :preview-src-list="[resolveMediaUrl(item.url)]"
              :initial-index="index"
              fit="cover"
              class="post-media-image"
              preview-teleported
            >
              <template #error>
                <div class="post-media-error">图片加载失败</div>
              </template>
            </el-image>
            </div>
        </div>

        <!-- 标题 -->
        <h1 class="post-title">{{ post.title }}</h1>

        <!-- 元数据行 -->
        <div class="post-meta">
          <div class="post-user">
            <el-avatar v-if="post.userAvatar" :src="post.userAvatar" :size="36" />
            <div>
              <div class="post-user-name">{{ post.userName }}</div>
              <div class="post-user-handle">@{{ post.userHandle }}</div>
            </div>
          </div>
          <div class="post-info">
            <el-tag :type="getChannelType(post.channel)" size="small" effect="plain">
              {{ getChannelLabel(post.channel) }}
            </el-tag>
            <span class="post-meta-item">{{ post.date }}</span>
            <span class="post-meta-item">{{ post.location }}</span>
            <span v-if="post.route" class="post-meta-item">路线: {{ post.route }}</span>
            <span v-if="post.mood" class="post-meta-item">心情: {{ post.mood }}</span>
          </div>
        </div>

        <!-- 标签 -->
        <div v-if="post.tags.length" class="post-tags">
          <el-tag
            v-for="tag in post.tags"
            :key="tag"
            size="small"
            style="margin-right: 6px"
          >
            #{{ tag }}
          </el-tag>
        </div>

        <!-- 摘要 -->
        <div class="post-excerpt">
          <em>「{{ post.excerpt }}」</em>
        </div>

        <!-- 正文 -->
        <div class="post-content">
          {{ post.content }}
        </div>

        <!-- 互动数据 -->
        <el-divider />
        <div class="post-interactions">
          <div class="interaction-item">👍 点赞 {{ post.likes }}</div>
          <div class="interaction-item">⭐ 收藏 {{ post.saves }}</div>
        </div>
      </el-card>

      <el-card shadow="never" class="action-card">
        <template #header><span class="card-title">内容关联与真实体验</span></template>
        <el-form label-position="top">
          <el-form-item label="关联城市">
            <el-select v-model="associations.citySlug" clearable filterable placeholder="选择已发布城市" style="width: 100%">
              <el-option v-if="associations.citySlug && !associationOptions.cities.some(item => item.slug === associations.citySlug)" :value="associations.citySlug" :label="associations.citySlug + '（当前不可公开选择）'" />
              <el-option v-for="item in associationOptions.cities" :key="item.slug" :value="item.slug" :label="item.name" />
            </el-select>
          </el-form-item>
          <el-form-item label="关联路线">
            <el-select v-model="associations.routeId" clearable filterable placeholder="选择已发布路线" style="width: 100%">
              <el-option v-if="associations.routeId && !associationOptions.routes.some(item => item.id === associations.routeId)" :value="associations.routeId" label="当前关联路线（不可公开选择）" />
              <el-option v-for="item in associationOptions.routes" :key="item.id" :value="item.id" :label="item.title" />
            </el-select>
          </el-form-item>
          <el-form-item label="关联译员">
            <el-select v-model="associations.interpreterId" clearable filterable placeholder="选择在职译员" style="width: 100%">
              <el-option v-if="associations.interpreterId && !associationOptions.interpreters.some(item => item.id === associations.interpreterId)" :value="associations.interpreterId" label="当前关联译员（不可公开选择）" />
              <el-option v-for="item in associationOptions.interpreters" :key="item.id" :value="item.id" :label="item.name" />
            </el-select>
          </el-form-item>
          <p class="association-help">旧地点说明仍保留，系统不会根据自由文本猜测关联。修改关联后需重新核验真实体验。</p>
          <el-button type="primary" :loading="savingAssociations" @click="saveAssociations">保存关联</el-button>
          <el-divider />
          <el-tag :type="post.verifiedExperience ? 'success' : 'info'">{{ post.verifiedExperience ? '已核验真实体验' : '尚未核验' }}</el-tag>
          <el-form-item label="有效服务记录 ID" style="margin-top: 16px">
            <el-input v-model="bookingId" placeholder="填写该作者已完成的预约 ID" />
          </el-form-item>
          <p class="association-help">后端核对预约已完成、作者账户一致，以及每项已选关联一致。私人服务记录 ID 不对公众展示。</p>
          <div class="action-buttons">
            <el-button type="primary" :disabled="!bookingId.trim()" :loading="verifying" @click="verifyExperience()">核验服务记录</el-button>
            <el-button v-if="post.verifiedExperience" :loading="verifying" @click="verifyExperience(true)">取消标记</el-button>
          </div>
          <p v-if="associationError" role="alert" class="association-error">{{ associationError }}</p>
        </el-form>
      </el-card>

      <!-- 审核操作区 -->
      <el-card shadow="never" class="action-card">
        <template #header>
          <span class="card-title">审核操作</span>
        </template>
        <div style="margin-bottom: 12px">
          <span>当前状态：</span>
          <el-tag :type="getStatusType(post.status)" size="default">
            {{ getStatusLabel(post.status) }}
          </el-tag>
        </div>
        <div class="action-buttons">
          <template v-if="post.status === 'pending_review'">
            <el-button type="success" @click="handleReview('published')">审核通过</el-button>
            <el-button type="warning" @click="handleReview('hidden')">隐藏帖子</el-button>
          </template>
          <template v-if="post.status === 'published'">
            <el-button type="warning" @click="handleReview('hidden')">隐藏帖子</el-button>
          </template>
          <template v-if="post.status === 'hidden'">
            <el-button type="success" @click="handleReview('published')">恢复发布</el-button>
          </template>
          <el-popconfirm title="确定删除该帖子？此操作不可恢复" @confirm="handleDelete">
            <template #reference>
              <el-button type="danger">删除帖子</el-button>
            </template>
          </el-popconfirm>
        </div>
        <div v-if="post.reviewedAt" class="review-trail">
          <span>最近审核：{{ formatDateTime(post.reviewedAt) }}</span>
          <span v-if="post.rejectionReason">原因：{{ post.rejectionReason }}</span>
        </div>
      </el-card>
    </template>
  </div>
</template>

<style scoped>
.detail-page {
  max-width: 900px;
  margin: 0 auto;
  padding-bottom: 40px;
}
.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}
.detail-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  min-width: 0;
}
.page-header h2 { margin: 0; font-size: 20px; color: var(--lt-text-primary); }

.post-card { margin-bottom: 20px; }
.post-image-wrap { margin-bottom: 20px; display: grid; gap: 12px; }
.post-media-item { position: relative; }
.post-media-image { width: 100%; max-height: 400px; border-radius: 8px; }
.post-media-image :deep(img) { width: 100%; max-height: 400px; object-fit: cover; border-radius: 8px; }
.post-media-video { width: 100%; max-height: 400px; border-radius: 8px; background: var(--lt-text-primary); }
.post-media-badge { position: absolute; left: 8px; top: 8px; }
.post-media-error {
  display: flex; align-items: center; justify-content: center;
  height: 200px; color: var(--lt-text-secondary); font-size: 13px;
  background: var(--lt-bg-page); border-radius: 8px;
}
.post-title { font-size: 22px; margin: 0 0 16px; color: var(--lt-text-primary); line-height: 1.4; }

.post-meta {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}
.post-user { display: flex; align-items: center; gap: 10px; }
.post-user-name { font-size: 14px; font-weight: 500; color: var(--lt-text-primary); }
.post-user-handle { font-size: 12px; color: var(--lt-text-secondary); }
.post-info { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.post-meta-item { font-size: 13px; color: var(--lt-text-secondary); }

.post-tags { margin-bottom: 16px; }
.post-excerpt {
  padding: 12px 16px;
  background: var(--lt-bg-page);
  border: 1px solid var(--lt-border);
  margin-bottom: 20px;
  border-radius: 0 4px 4px 0;
  color: var(--lt-text-secondary);
  font-size: 14px;
}
.post-content {
  white-space: pre-wrap;
  line-height: 1.8;
  font-size: 14px;
  color: var(--lt-text-primary);
}
.post-interactions {
  display: flex;
  gap: 32px;
  font-size: 14px;
  color: var(--lt-text-secondary);
}
.interaction-item { display: flex; align-items: center; gap: 4px; }

.action-card { margin-bottom: 20px; }
.card-title { font-weight: 600; font-size: 15px; }
.action-buttons { display: flex; flex-wrap: wrap; gap: 10px; }
.association-help { margin: 12px 0; color: var(--lt-text-secondary); line-height: 1.7; }
.association-error { margin-top: 12px; color: var(--el-color-danger); }
.review-trail {
  margin-top: 14px; display: flex; flex-wrap: wrap; gap: 16px;
  font-size: 12px; color: var(--lt-text-secondary);
}
</style>
