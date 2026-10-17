<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { modesApi } from '@/api/modes'
import type { ServiceModeFormData } from '@/types/interpreting'
import { readContentValue } from '@/types/common'
import { extractErrorMessage } from '@/utils/errors'
import { useDirtyForm } from '@/composables/useDirtyForm'
import EditorPageHeader from '@/components/editor/EditorPageHeader.vue'
import EditorWorkspace from '@/components/editor/EditorWorkspace.vue'
import FrontendPagePreview from '@/components/FrontendPagePreview.vue'
import ContentInput from '@/components/ContentInput.vue'
import ContentMarkdownEditor from '@/components/ContentMarkdownEditor.vue'

const route = useRoute()
const router = useRouter()
const isEdit = ref(false)
const saving = ref(false)
const loading = ref(false)
const activePanel = ref<'body' | 'includes'>('body')
const formRef = ref<FormInstance>()

const form = reactive<ServiceModeFormData>({
  sortOrder: 1,
  title: '',
  price: '',
  bestFor: '',
  body: '',
  includes: [],
  accent: 'light',
  featured: false,
})

const newIncludeEn = ref('')

const rules = {
  title: [{ required: true, message: '请输入模式名称', trigger: 'blur' }],
  price: [{ required: true, message: '请输入价格说明', trigger: 'blur' }],
}

const { isDirty, resetDirty, disableDirtyCheck } = useDirtyForm({ form })

function addInclude() {
  const content = newIncludeEn.value.trim()
  if (!content) return

  form.includes.push(content)
  newIncludeEn.value = ''
}

function removeInclude(index: number) {
  form.includes.splice(index, 1)
}

onMounted(async () => {
  const id = route.params.id as string
  if (!id) {
    resetDirty()
    return
  }

  isEdit.value = true
  loading.value = true
  try {
    const res = await modesApi.getMode(id)
    const data = res.data.data
    Object.assign(form, {
      sortOrder: data.sortOrder ?? 1,
      title: readContentValue(data.title),
      price: readContentValue(data.price),
      bestFor: readContentValue(data.bestFor),
      body: readContentValue(data.body),
      includes: Array.isArray(data.includes) ? data.includes.filter((item: unknown): item is string => typeof item === 'string') : [],
      accent: data.accent || 'light',
      featured: data.featured ?? false,
    })
    resetDirty()
  } catch (error: any) {
    ElMessage.error(extractErrorMessage(error, '加载服务模式失败'))
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

  saving.value = true
  try {
    if (isEdit.value) {
      await modesApi.updateMode(route.params.id as string, form)
      ElMessage.success('服务模式已更新')
    } else {
      await modesApi.createMode(form)
      ElMessage.success('服务模式已创建')
    }
    disableDirtyCheck()
    router.push('/admin/interpreting/modes')
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
      :title="isEdit ? '编辑服务模式' : '新增服务模式'"
      back-to="/admin/interpreting/modes"
      :saving="saving"
      :dirty="isDirty"
      @save="handleSave"
    />

    <div class="editor-shell">
      <el-form ref="formRef" :model="form" :rules="rules" class="editor-form" label-position="top">
        <el-card shadow="never" class="section-card">
          <template #header>基础信息</template>
          <el-form-item label="模式名称" prop="title">
            <ContentInput v-model="form.title" />
          </el-form-item>
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="价格" prop="price">
                <ContentInput v-model="form.price" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="排序权重">
                <el-input-number v-model="form.sortOrder" :min="1" style="width: 100%" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item label="适用场景">
            <ContentInput v-model="form.bestFor" type="textarea" :rows="2" />
          </el-form-item>
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="卡片色调">
                <el-select v-model="form.accent" style="width: 100%">
                  <el-option label="浅色" value="light" />
                  <el-option label="深色" value="dark" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="推荐标记">
                <el-switch v-model="form.featured" active-text="推荐" inactive-text="普通" />
              </el-form-item>
            </el-col>
          </el-row>
        </el-card>

        <EditorWorkspace
          v-model="activePanel"
          title="服务内容工作台"
          eyebrow="服务模式内容"
          description="价格、排序和推荐状态放在固定区，面向前台的正文与服务清单集中在这里编辑。"
          :active-label="activePanel === 'body' ? '服务正文' : '服务清单'"
          :tabs="[{ key: 'body', label: '服务正文' }, { key: 'includes', label: '服务清单' }]"
        >
          <template #default>
            <div v-if="activePanel === 'body'" class="workspace-panel">
              <div class="panel-title">服务正文</div>
              <el-form-item label="详细描述">
                <ContentMarkdownEditor v-model="form.body" :rows="8" />
              </el-form-item>
            </div>

            <div v-else class="workspace-panel">
              <div class="panel-title">服务清单</div>
              <el-form-item label="服务项目">
                <div class="tag-list">
                  <el-tag v-for="(item, index) in form.includes" :key="index" closable @close="removeInclude(index)">
                    {{ item }}
                  </el-tag>
                </div>
                <div class="tag-input-row">
                  <el-input v-model="newIncludeEn" placeholder="输入服务项目" @keyup.enter="addInclude" />
                  <el-button type="primary" @click="addInclude">添加</el-button>
                </div>
              </el-form-item>
            </div>
          </template>
        </EditorWorkspace>
      </el-form>

      <FrontendPagePreview type="service" :model="form" />
    </div>
  </div>
</template>

<style scoped>
@import '@/assets/editor-common.css';

.workspace-panel {
  min-height: 260px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
  min-height: 32px;
}

.tag-input-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}
</style>
