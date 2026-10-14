<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { citiesApi } from '@/api/cities'
import { eventsApi, type CalendarEventForm, type EventPublication, type PublicationAction } from '@/api/events'
import { useAuthStore } from '@/store/auth'
import type { MediaAsset } from '@/types/media'
import MediaAssetInput from '@/components/media/MediaAssetInput.vue'
import { routesApi } from '@/api/routes'
import { EventStatusMap } from '@/types/event'
import { readContentValue } from '@/types/common'
import { extractErrorMessage } from '@/utils/errors'
import { useDirtyForm } from '@/composables/useDirtyForm'
import EditorPageHeader from '@/components/editor/EditorPageHeader.vue'
import EditorWorkspace, { type EditorWorkspaceTab } from '@/components/editor/EditorWorkspace.vue'
import FrontendPagePreview from '@/components/FrontendPagePreview.vue'
import ContentInput from '@/components/ContentInput.vue'
import ContentMarkdownEditor from '@/components/ContentMarkdownEditor.vue'
import ImageUpload from '@/components/ImageUpload.vue'

const router = useRouter()
const route = useRoute()
const isEdit = computed(() => !!route.params.id)
const loading = ref(false)
const saving = ref(false)
const formRef = ref<FormInstance>()
const cityOptions = ref<Array<{ slug: string; name: string; adcode: number }>>([])
const routeOptions = ref<Array<{ slug: string; title: string }>>([])
const newTag = ref('')
const activeWorkspace = ref('summary')
const publications = ref<EventPublication[]>([])
const publicationActions = ref<PublicationAction[]>([])
const publicationBusy = ref(false)
const publicationError = ref('')
const todayShanghai = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const publicationRange = reactive({ startDate: todayShanghai(), endDate: todayShanghai() })
const canWithdraw = computed(() => (useAuthStore().currentUser?.role || '').split(',').includes('admin'))

async function loadPublications() {
  const res = await eventsApi.getPublications(route.params.id as string)
  publications.value = res.data.data.publications
  publicationActions.value = res.data.data.actions
}

async function handlePublish() {
  publicationError.value = ''
  if (isDirty.value) { publicationError.value = '请先保存当前编辑内容，再发布快照。'; return }
  if (!publicationRange.startDate || !publicationRange.endDate || publicationRange.startDate < todayShanghai() || publicationRange.endDate < publicationRange.startDate) {
    publicationError.value = '展示范围必须从今天或未来开始，结束日期不能早于开始日期。'; return
  }
  try {
    await ElMessageBox.confirm('发布已保存内容为不可变版本。新版本从指定开始日期接替旧版本；过去日期保留原快照。', '发布活动版本', { confirmButtonText: '确认发布', cancelButtonText: '取消' })
  } catch { return }
  publicationBusy.value = true
  try {
    await eventsApi.publish(route.params.id as string, publicationRange)
    await loadPublications()
    ElMessage.success('发布成功，历史快照已保留')
  } catch (error) { publicationError.value = extractErrorMessage(error, '发布失败') }
  finally { publicationBusy.value = false }
}

async function handlePublicationAction(publication: EventPublication, withdraw: boolean) {
  let reason: string
  try {
    const result = await ElMessageBox.prompt(withdraw ? '撤回后该版本的全部日期（包含历史）不再公开。快照和媒体仍保留。请输入原因。' : '从广东时间明天开始停止展示，今天和过去日期不受影响。请输入原因。', withdraw ? '撤回历史（管理员）' : '停止未来展示', {
      confirmButtonText: withdraw ? '确认撤回历史' : '确认停止未来', cancelButtonText: '取消', inputValidator: value => Boolean(value?.trim()) || '必须填写操作原因',
    })
    reason = result.value.trim()
  } catch { return }
  publicationBusy.value = true
  publicationError.value = ''
  try {
    if (withdraw) await eventsApi.withdrawHistory(route.params.id as string, publication.id, reason)
    else await eventsApi.stopFuture(route.params.id as string, publication.id, reason)
    await loadPublications()
    ElMessage.success(withdraw ? '历史版本已撤回，审计记录已保存' : '已停止未来展示，历史日期保留')
  } catch (error) { publicationError.value = extractErrorMessage(error, '操作失败') }
  finally { publicationBusy.value = false }
}

function updateMedia(index: number, value: MediaAsset | null) {
  if (value) form.media[index] = value
}
function moveMedia(index: number, offset: number) {
  const target = index + offset
  if (target < 0 || target >= form.media.length) return
  const [asset] = form.media.splice(index, 1)
  if (asset) form.media.splice(target, 0, asset)
}

const rules = {
  slug: [
    { required: true, message: '请输入 Slug', trigger: 'blur' },
    { pattern: /^[a-z0-9]+(-[a-z0-9]+)*$/, message: 'Slug 必须是 kebab-case', trigger: 'blur' },
  ],
  title: [{ required: true, message: '请输入活动名称', trigger: 'blur' }],
  date: [{ required: true, message: '请选择开始日期', trigger: 'change' }],
}

const form = reactive<CalendarEventForm>({
  slug: '',
  title: '',
  date: '',
  endDate: '',
  city: '',
  citySlug: '',
  adcode: 440100,
  tags: [],
  summary: '',
  description: '',
  relatedRouteSlugs: [],
  image: '',
  media: [],
  slogan: '',
  extraInfo: '',
  displayOrder: 0,
  status: 'draft',
})

const { isDirty, resetDirty } = useDirtyForm({ form, initializeOnMount: false })

const statusOptions = computed(() =>
  Object.entries(EventStatusMap).map(([value, label]) => ({ value, label })),
)

const selectedCity = computed(() =>
  cityOptions.value.find((item) => item.slug === form.citySlug),
)

const selectedRoutes = computed(() =>
  form.relatedRouteSlugs
    .map((slug) => routeOptions.value.find((item) => item.slug === slug))
    .filter(Boolean) as Array<{ slug: string; title: string }>,
)

const checklist = computed(() => [
  { label: '活动名称', done: Boolean(form.title.trim()) },
  { label: '开始日期', done: Boolean(form.date) },
  { label: '关联城市', done: Boolean(form.citySlug || form.city.trim()) },
  { label: '封面图片', done: Boolean(form.image) },
  { label: '摘要', done: Boolean(form.summary.trim()) },
  { label: '详情正文', done: Boolean(form.description.trim()) },
])

const workspaceTabs = computed<EditorWorkspaceTab[]>(() => [
  { key: 'summary', label: '摘要展示' },
  { key: 'description', label: '正文内容' },
])

function addTag() {
  const value = newTag.value.trim()
  if (!value || form.tags.includes(value)) return
  form.tags.push(value)
  newTag.value = ''
}

function removeTag(index: number) {
  form.tags.splice(index, 1)
}

function handleCityChange(slug: string) {
  const city = cityOptions.value.find((item) => item.slug === slug)
  if (!city) return
  form.citySlug = city.slug
  form.city = city.name
  form.adcode = city.adcode
}

function fillFromApi(data: any) {
  Object.assign(form, {
    slug: data.slug || '',
    title: readContentValue(data.title),
    date: data.date || '',
    endDate: data.endDate || '',
    city: data.city || '',
    citySlug: data.citySlug || '',
    adcode: Number(data.adcode || 0),
    tags: Array.isArray(data.tags) ? [...data.tags] : [],
    summary: readContentValue(data.summary),
    description: readContentValue(data.description),
    relatedRouteSlugs: Array.isArray(data.relatedRouteSlugs) ? [...data.relatedRouteSlugs] : [],
    image: data.image || '',
    media: Array.isArray(data.media) ? data.media.map((asset: MediaAsset) => ({ ...asset })) : [],
    slogan: data.slogan || '',
    extraInfo: data.extraInfo || '',
    displayOrder: data.displayOrder || 0,
    status: data.status || 'draft',
  })
}

onMounted(async () => {
  loading.value = true
  try {
    const [citiesRes, routesRes] = await Promise.all([
      citiesApi.getCities({ page: 1, pageSize: 200 }),
      routesApi.getRoutes({ page: 1, pageSize: 200 }),
    ])

    cityOptions.value = (citiesRes.data.data.data || []).map((item: any) => ({
      slug: item.slug,
      name: readContentValue(item.name) || item.slug,
      adcode: Number(item.adcode || 0),
    }))

    routeOptions.value = (routesRes.data.data.data || []).map((item: any) => ({
      slug: item.slug,
      title: readContentValue(item.title) || item.slug,
    }))

    if (isEdit.value) {
      const res = await eventsApi.getEvent(route.params.id as string)
      fillFromApi(res.data.data)
      try { await loadPublications() } catch (error) { publicationError.value = extractErrorMessage(error, '发布版本加载失败，请确认数据库迁移已完成') }
      publicationRange.startDate = form.date > todayShanghai() ? form.date : todayShanghai()
      publicationRange.endDate = (form.endDate || form.date) >= publicationRange.startDate ? (form.endDate || form.date) : publicationRange.startDate
    }

    resetDirty()
  } catch (err: any) {
    ElMessage.error(extractErrorMessage(err, '加载活动数据失败'))
    router.push('/admin/events')
  } finally {
    loading.value = false
  }
})

async function handleSave() {
  try {
    await formRef.value?.validate()
  } catch {
    ElMessage.warning('请先补全必填项')
    return
  }

  if (form.endDate && form.date) {
    const start = new Date(form.date)
    const end = new Date(form.endDate)
    if (!Number.isNaN(end.getTime()) && end < start) {
      ElMessage.error('结束日期不能早于开始日期')
      return
    }
  }

  saving.value = true
  try {
    if (isEdit.value) {
      await eventsApi.updateEvent(route.params.id as string, form)
      const saved = await eventsApi.getEvent(route.params.id as string)
      fillFromApi(saved.data.data)
      resetDirty()
      ElMessage.success('编辑内容已保存；公开快照不会改变，请按需发布新版本')
    } else {
      const created = await eventsApi.createEvent(form)
      resetDirty()
      ElMessage.success('活动已创建，请在编辑页发布日历版本')
      await router.replace(`/admin/events/${created.data.data.id}/edit`)
      fillFromApi(created.data.data)
      resetDirty()
      await loadPublications()
    }
  } catch (error: any) {
    ElMessage.error(extractErrorMessage(error, '保存失败'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="edit-page" v-loading="loading">
    <EditorPageHeader
      :title="isEdit ? '编辑活动' : '新增活动'"
      back-to="/admin/events"
      :saving="saving"
      :dirty="isDirty"
      @save="handleSave"
    />

    <div class="editor-shell">
      <el-form ref="formRef" :model="form" :rules="rules" class="editor-form" label-position="top">
        <el-card shadow="never" class="section-card">
          <template #header>基础信息</template>
          <el-form-item label="Slug" prop="slug">
            <el-input v-model="form.slug" placeholder="dragon-boat-2026" />
          </el-form-item>
          <el-form-item label="活动名称" prop="title">
            <ContentInput v-model="form.title" />
          </el-form-item>
          <el-form-item label="Slogan（英文，可选）"><el-input v-model="form.slogan" maxlength="240" show-word-limit /></el-form-item>
          <el-form-item label="展示排序（越小越靠前）"><el-input-number v-model="form.displayOrder" :min="-10000" :max="10000" /></el-form-item>
          <el-row :gutter="16">
            <el-col :xs="24" :sm="12" :md="8">
              <el-form-item label="开始日期" prop="date">
                <el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12" :md="8">
              <el-form-item label="结束日期">
                <el-date-picker v-model="form.endDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12" :md="8">
              <el-form-item label="活动进度（不等于日历发布状态）">
                <el-select v-model="form.status" style="width: 100%">
                  <el-option v-for="opt in statusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
        </el-card>

        <el-card shadow="never" class="section-card">
          <template #header>关联城市与路线</template>
          <el-row :gutter="16">
            <el-col :xs="24" :sm="12" :md="8">
              <el-form-item label="关联城市">
                <el-select
                  v-model="form.citySlug"
                  clearable
                  filterable
                  style="width: 100%"
                  @change="handleCityChange"
                >
                  <el-option
                    v-for="city in cityOptions"
                    :key="city.slug"
                    :label="`${city.name} (${city.slug})`"
                    :value="city.slug"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12" :md="8">
              <el-form-item label="前台显示城市">
                <el-input v-model="form.city" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12" :md="8">
              <el-form-item label="地图区划代码">
                <el-input-number v-model="form.adcode" :min="0" :max="999999" style="width: 100%" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item label="关联路线">
            <el-select
              v-model="form.relatedRouteSlugs"
              multiple
              filterable
              collapse-tags
              collapse-tags-tooltip
              style="width: 100%"
            >
              <el-option
                v-for="routeItem in routeOptions"
                :key="routeItem.slug"
                :label="`${routeItem.title} (${routeItem.slug})`"
                :value="routeItem.slug"
              />
            </el-select>
          </el-form-item>

          <div v-if="selectedRoutes.length" class="selected-grid">
            <div v-for="routeItem in selectedRoutes" :key="routeItem.slug" class="selected-card">
              <strong>{{ routeItem.title }}</strong>
              <span>{{ routeItem.slug }}</span>
            </div>
          </div>
        </el-card>

        <el-card shadow="never" class="section-card">
          <template #header>封面与标签</template>
          <el-form-item label="活动封面">
            <ImageUpload v-model="form.image" module="events" />
          </el-form-item>
          <el-form-item label="活动媒体（图片 / 视频，最多 12 条）">
            <div class="media-list">
              <div v-for="(asset, index) in form.media" :key="index" class="media-item">
                <MediaAssetInput :model-value="asset" :legacy-image="form.image" module="events" @update:model-value="updateMedia(index, $event)" />
                <el-input v-model="asset.alt" placeholder="英文替代文字" aria-label="媒体英文替代文字" />
                <div class="publication-controls">
                  <el-button :disabled="index === 0" @click="moveMedia(index, -1)">上移</el-button>
                  <el-button :disabled="index === form.media.length - 1" @click="moveMedia(index, 1)">下移</el-button>
                  <el-button type="danger" plain @click="form.media.splice(index, 1)">移出当前编辑</el-button>
                </div>
              </div>
              <el-button :disabled="form.media.length >= 12" @click="form.media.push({ type: 'image', url: '' })">添加媒体</el-button>
              <p class="publication-help">保留旧单图作为兼容封面。移出当前编辑不会删除历史资源。视频必须有图片封面；文件类型由服务端验证。</p>
            </div>
          </el-form-item>
          <el-form-item label="活动标签">
            <div class="tag-list">
              <el-tag v-for="(tag, index) in form.tags" :key="tag" closable @close="removeTag(index)">
                {{ tag }}
              </el-tag>
            </div>
            <div class="tag-input-row">
              <el-input v-model="newTag" placeholder="如：节庆 / 市集 / 非遗" @keyup.enter="addTag" />
              <el-button :icon="Plus" @click="addTag">添加</el-button>
            </div>
          </el-form-item>
        </el-card>

        <EditorWorkspace
          v-model="activeWorkspace"
          eyebrow="活动内容"
          title="活动内容工作台"
          description="日期、关联城市、标签和封面放在固定区，前台真正展示的摘要与正文集中在这里编辑。"
          :active-label="workspaceTabs.find((item) => item.key === activeWorkspace)?.label || '摘要展示'"
          :tabs="workspaceTabs"
        >
          <div v-if="activeWorkspace === 'summary'" class="workspace-panel">
            <div class="panel-title">活动摘要</div>
            <el-form-item label="摘要文案">
              <ContentMarkdownEditor v-model="form.summary" :rows="6" />
            </el-form-item>
          </div>

          <div v-else class="workspace-panel">
            <div class="panel-title">活动正文</div>
            <el-form-item label="详情内容">
              <ContentMarkdownEditor v-model="form.description" :rows="10" />
            </el-form-item>
            <el-form-item label="补充信息（英文，可选）"><ContentMarkdownEditor v-model="form.extraInfo" :rows="6" /></el-form-item>
          </div>
        </EditorWorkspace>
      </el-form>

      <aside class="editor-aside">
        <FrontendPagePreview type="event" :model="form" />

        <el-card shadow="never" class="aside-card">
          <template #header>发布摘要</template>
          <div class="info-list">
            <div class="info-row">
              <span>状态</span>
              <strong>{{ EventStatusMap[form.status] }}</strong>
            </div>
            <div class="info-row">
              <span>开始</span>
              <strong>{{ form.date || '未设置' }}</strong>
            </div>
            <div class="info-row">
              <span>结束</span>
              <strong>{{ form.endDate || '未设置' }}</strong>
            </div>
            <div class="info-row">
              <span>标签数</span>
              <strong>{{ form.tags.length }}</strong>
            </div>
          </div>
        </el-card>

        <el-card shadow="never" class="aside-card">
          <template #header>日历发布版本</template>
          <p class="publication-help">保存只更新编辑内容，不覆盖已发布快照。首次发布前，旧活动仅在今天和未来按原状态展示，不补造历史。</p>
          <div v-if="isEdit" class="publication-stack">
            <el-form label-position="top">
              <el-form-item label="展示开始（广东时间）"><el-date-picker v-model="publicationRange.startDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
              <el-form-item label="展示结束"><el-date-picker v-model="publicationRange.endDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
            </el-form>
            <p v-if="isDirty" class="publication-help">有未保存修改，请先保存。</p>
            <el-button type="primary" :loading="publicationBusy" :disabled="isDirty || loading" @click="handlePublish">发布新版本</el-button>
            <el-alert v-if="publicationError" :title="publicationError" type="error" :closable="false" role="alert" />
            <div v-for="publication in publications" :key="publication.id" class="publication-record">
              <strong>版本 {{ publication.version }} {{ publication.withdrawnAt ? '（已撤回历史）' : publication.stopFrom ? '（已停止 / 接替）' : '（已发布）' }}</strong>
              <p>{{ publication.startDate }} 至 {{ publication.endDate }}</p>
              <p v-if="publication.stopFrom">停止自 {{ publication.stopFrom }}（该日起不展示）</p>
              <p>发布于 {{ new Date(publication.publishedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) }}</p>
              <div class="publication-controls">
                <el-button :disabled="publicationBusy || !!publication.withdrawnAt" @click="handlePublicationAction(publication, false)">停止未来展示</el-button>
                <el-button v-if="canWithdraw" type="danger" plain :disabled="publicationBusy || !!publication.withdrawnAt" @click="handlePublicationAction(publication, true)">撤回历史</el-button>
              </div>
              <details><summary>查看不可变快照</summary><pre class="snapshot-content">{{ JSON.stringify(publication.snapshot, null, 2) }}</pre></details>
            </div>
            <p v-if="!publications.length">尚未发布版本，不存在可回看的历史快照。</p>
            <details v-if="publicationActions.length"><summary>操作留痕（{{ publicationActions.length }} 条）</summary>
              <ul class="publication-stack"><li v-for="action in publicationActions" :key="action.id">{{ action.action === 'publish' ? '发布' : action.action === 'supersede' ? '新版本接替' : action.action === 'stop_future' ? '停止未来' : '撤回历史' }}：{{ action.reason }}<br>{{ new Date(action.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) }} / 操作人 {{ action.actorId }}</li></ul>
            </details>
          </div>
          <p v-else>先保存活动，再发布日历版本。</p>
        </el-card>

        <el-card shadow="never" class="aside-card">
          <template #header>关联内容</template>
          <div class="aside-stack">
            <div class="selected-card">
              <strong>{{ selectedCity?.name || form.city || '未选择城市' }}</strong>
              <span>{{ form.citySlug || '暂无 slug' }}</span>
            </div>
            <div class="route-count">已关联路线 {{ selectedRoutes.length }} 条</div>
          </div>
        </el-card>

        <el-card shadow="never" class="aside-card">
          <template #header>完整性检查</template>
          <div class="check-list">
            <div v-for="item in checklist" :key="item.label" class="check-row">
              <span>{{ item.label }}</span>
              <strong :class="item.done ? 'done' : 'pending'">{{ item.done ? '已完成' : '待补充' }}</strong>
            </div>
          </div>
        </el-card>
      </aside>
    </div>
  </div>
</template>

<style scoped>
@import '@/assets/editor-common.css';

.editor-shell {
  grid-template-columns: minmax(0, 1fr) clamp(340px, 32vw, 480px);
}

.section-card,
.aside-card {
  margin-bottom: 16px;
}

.editor-aside {
  position: sticky;
  top: 20px;
  align-self: start;
  max-height: calc(100dvh - 40px);
  overflow: auto;
  padding-right: 3px;
}

.editor-aside :deep(.frontend-preview) {
  position: static;
  max-height: none;
  overflow: visible;
  margin-bottom: 16px;
  padding-right: 0;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 28px;
  margin-bottom: 10px;
}

.tag-input-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.aside-stack,
.check-list,
.info-list {
  display: grid;
  gap: 12px;
}

.info-row,
.check-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.publication-stack, .media-list { display: grid; gap: 16px; width: 100%; }
.publication-help { color: var(--lt-text-secondary); font-size: 14px; line-height: 1.7; }
.publication-controls { display: flex; flex-wrap: wrap; gap: 8px; }
.publication-controls :deep(.el-button) { margin-left: 0; min-height: 44px; }
.publication-record, .media-item { display: grid; gap: 10px; padding: 14px; border: 1px solid var(--lt-border-light); }
.snapshot-content { max-height: 320px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; }
summary { cursor: pointer; min-height: 44px; padding: 12px 0; }

.route-count {
  color: var(--lt-text-secondary);
  font-size: 13px;
}

.done {
  color: var(--el-color-success);
}

.pending {
  color: var(--el-color-warning);
}

@media (max-width: 1023px) {
  .editor-shell {
    grid-template-columns: 1fr;
  }

  .editor-aside {
    position: static;
  }
}
</style>
