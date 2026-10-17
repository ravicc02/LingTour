<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { citiesApi } from '@/api/cities'
import { eventsApi } from '@/api/events'
import { routesApi } from '@/api/routes'
import type { EventFormData } from '@/types/event'
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

const rules = {
  slug: [
    { required: true, message: '请输入 Slug', trigger: 'blur' },
    { pattern: /^[a-z0-9]+(-[a-z0-9]+)*$/, message: 'Slug 必须是 kebab-case', trigger: 'blur' },
  ],
  title: [{ required: true, message: '请输入活动名称', trigger: 'blur' }],
  date: [{ required: true, message: '请选择开始日期', trigger: 'change' }],
}

const form = reactive<EventFormData>({
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
  status: 'draft',
})

const { isDirty, resetDirty, disableDirtyCheck } = useDirtyForm({ form })

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
      ElMessage.success('活动已更新')
    } else {
      await eventsApi.createEvent(form)
      ElMessage.success('活动已创建')
    }
    disableDirtyCheck()
    router.push('/admin/events')
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
              <el-form-item label="活动状态">
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

.route-count {
  color: #606266;
  font-size: 13px;
}

.done {
  color: #67c23a;
}

.pending {
  color: #e6a23c;
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
