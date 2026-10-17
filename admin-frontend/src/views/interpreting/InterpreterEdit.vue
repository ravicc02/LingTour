<script setup lang="ts">
import { nextTick, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { interpretersApi } from '@/api/interpreters'
import type { InterpreterFormData } from '@/types/interpreting'
import { readContentValue } from '@/types/common'
import { extractErrorMessage } from '@/utils/errors'
import { useDirtyForm } from '@/composables/useDirtyForm'
import EditorPageHeader from '@/components/editor/EditorPageHeader.vue'
import EditorWorkspace from '@/components/editor/EditorWorkspace.vue'
import FrontendPagePreview from '@/components/FrontendPagePreview.vue'
import ImageUpload from '@/components/ImageUpload.vue'
import ContentInput from '@/components/ContentInput.vue'
import ContentMarkdownEditor from '@/components/ContentMarkdownEditor.vue'

const route = useRoute()
const router = useRouter()
const isEdit = ref(false)
const saving = ref(false)
const loading = ref(false)
const formRef = ref<FormInstance>()

const form = reactive<InterpreterFormData>({
  sortOrder: 1,
  name: '',
  language: '',
  focus: '',
  helps: [],
  avatar: '',
  bio: '',
  status: 'pending_review',
  city: '',
})

const newHelpEn = ref('')

const rules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  language: [{ required: true, message: '请输入服务语言', trigger: 'blur' }],
  city: [{ required: true, message: '请输入服务城市', trigger: 'blur' }],
}

const { isDirty, resetDirty, disableDirtyCheck } = useDirtyForm({ form })

function addHelp() {
  const content = newHelpEn.value.trim()
  if (!content) return
  if (!form.helps.includes(content)) {
    form.helps.push(content)
  }
  newHelpEn.value = ''
}

function removeHelp(index: number) {
  form.helps.splice(index, 1)
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
    const res = await interpretersApi.getInterpreter(id)
    const data = res.data.data
    Object.assign(form, {
      sortOrder: data.sortOrder ?? 1,
      name: readContentValue(data.name),
      language: readContentValue(data.language),
      focus: readContentValue(data.focus),
      helps: (data.helps || []).filter((item: unknown): item is string => typeof item === 'string'),
      avatar: data.avatar || '',
      bio: readContentValue(data.bio),
      status: data.status || 'pending_review',
      city: data.city || '',
    })
    await nextTick()
    resetDirty()
  } catch (error: any) {
    ElMessage.error(extractErrorMessage(error, '加载口译员数据失败'))
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
      await interpretersApi.updateInterpreter(route.params.id as string, form)
      ElMessage.success('口译员已更新')
    } else {
      await interpretersApi.createInterpreter(form)
      ElMessage.success('口译员已创建')
    }
    disableDirtyCheck()
    router.push('/admin/interpreting/profiles')
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
      :title="isEdit ? '编辑口译员' : '新增口译员'"
      back-to="/admin/interpreting/profiles"
      :saving="saving"
      :dirty="isDirty"
      @save="handleSave"
    />

    <div class="editor-shell">
      <el-form ref="formRef" :model="form" :rules="rules" class="editor-form" label-position="top">
        <el-card shadow="never" class="section-card">
          <template #header>基本信息</template>
          <el-row :gutter="16">
            <el-col :span="8">
              <el-form-item label="排序权重">
                <el-input-number v-model="form.sortOrder" :min="0" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="状态">
                <el-select v-model="form.status" style="width: 100%">
                  <el-option label="待审核" value="pending_review" />
                  <el-option label="已启用" value="active" />
                  <el-option label="已停用" value="inactive" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="封面 / 头像">
                <ImageUpload v-model="form.avatar" module="interpreting" />
                <div class="field-tip">
                  前台口译员卡片封面直接使用这里的图片，建议上传竖向人物照。
                </div>
              </el-form-item>
            </el-col>
          </el-row>

          <el-alert
            v-if="form.status === 'active' && !form.avatar"
            type="warning"
            :closable="false"
            show-icon
            title="当前口译员已设为 active，但还没有封面图。前台会退回占位图。"
            class="section-alert"
          />

          <el-form-item label="姓名" prop="name">
            <ContentInput v-model="form.name" />
          </el-form-item>
          <el-form-item label="服务语言" prop="language">
            <ContentInput v-model="form.language" />
          </el-form-item>
          <el-form-item label="服务城市" prop="city">
            <el-input v-model="form.city" />
          </el-form-item>
          <el-form-item label="专注领域">
            <ContentInput v-model="form.focus" />
          </el-form-item>
        </el-card>

        <el-card shadow="never" class="section-card">
          <template #header>能力标签</template>
          <div class="tag-list">
            <el-tag v-for="(item, index) in form.helps" :key="index" closable @close="removeHelp(index)">
              {{ item }}
            </el-tag>
          </div>
          <div class="tag-input-row">
            <el-input v-model="newHelpEn" placeholder="输入能力标签" @keyup.enter="addHelp" />
            <el-button type="primary" @click="addHelp">添加</el-button>
          </div>
        </el-card>

        <EditorWorkspace
          model-value="bio"
          title="个人简介"
          active-label="个人简介"
          :tabs="[{ key: 'bio', label: '个人简介' }]"
        >
          <div class="workspace-panel">
            <div class="panel-title">个人简介</div>
            <el-form-item label="简介正文">
              <ContentMarkdownEditor v-model="form.bio" :rows="8" />
            </el-form-item>
          </div>
        </EditorWorkspace>
      </el-form>

      <FrontendPagePreview type="interpreter" :model="form" />
    </div>
  </div>
</template>

<style scoped>
@import '@/assets/editor-common.css';

.workspace-panel {
  min-height: 220px;
}

.field-tip {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: #7a7f87;
}

.section-alert {
  margin-bottom: 16px;
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
