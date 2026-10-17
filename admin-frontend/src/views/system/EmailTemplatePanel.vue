<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { RefreshRight, MagicStick } from '@element-plus/icons-vue'
import { gsap } from 'gsap'
import {
  listEmailTemplateEvents,
  previewEmailTemplate,
  saveEmailTemplate,
  sendEventTemplateTestEmail,
} from '@/api/email'
import type { EmailEventView } from '@/types/email'
import { prefersReducedMotion } from '@/utils/motion'
import PageSkeleton from '@/components/PageSkeleton.vue'
import EmptyState from '@/components/EmptyState.vue'

const panelRoot = ref<HTMLElement | null>(null)
const loading = ref(false)
const isFirstLoad = ref(true)
const saving = ref(false)
const previewing = ref(false)
const events = ref<EmailEventView[]>([])
const selectedKey = ref('')
const locale = ref('en')
const subject = ref('')
const bodyHtml = ref('')
const previewSubject = ref('')
const previewHtml = ref('')
const previewStoredDisabled = ref(false)
const testTo = ref('')
const sendingTest = ref(false)
let motionContext: ReturnType<typeof gsap.context> | null = null

const selectedEvent = computed(
  () => events.value.find((e) => e.key === selectedKey.value) ?? null,
)

const storedTemplate = computed(() => selectedEvent.value?.templates?.[locale.value] ?? null)

/**
 * 编辑器实时状态：标签跟随「编辑器内容」而不是只看数据库里有没有已存模板，
 * 否则「恢复默认文案」后仍显示「使用后台自定义模板」，让人误以为恢复没生效。
 */
const editorState = computed(() => {
  const event = selectedEvent.value
  if (!event) return null
  const matchesDefault =
    subject.value === event.defaultSubject && bodyHtml.value === event.defaultBodyHtml
  const stored = storedTemplate.value
  if (stored) {
    const matchesStored =
      subject.value === stored.subject && bodyHtml.value === stored.bodyHtml
    if (matchesStored) return matchesDefault ? 'same-as-default' : 'stored'
    return matchesDefault ? 'reverting' : 'modified'
  }
  return matchesDefault ? 'default' : 'modified'
})

const editorStateLabel = computed(() => {
  switch (editorState.value) {
    case 'stored':
      return '使用后台自定义模板'
    case 'same-as-default':
      return '已与系统默认文案一致'
    case 'reverting':
      return '将恢复为系统默认，保存后生效'
    case 'modified':
      return '有未保存的修改'
    default:
      return '使用系统默认模板'
  }
})

const statusLabel = (event: EmailEventView) =>
  event.status === 'active' ? '使用中' : '待接入'

const statusHint = (event: EmailEventView) =>
  event.status === 'active'
    ? '系统已接入该事件：触发时会真实发送此邮件'
    : '对应业务尚未上线；模板已就绪，上线后自动启用'

async function loadEvents(initialKey?: string) {
  const list = await listEmailTemplateEvents()
  events.value = list
  const target =
    (initialKey && list.find((e) => e.key === initialKey)) ||
    selectedEvent.value && list.find((e) => e.key === selectedEvent.value?.key) ||
    list.find((e) => e.status === 'active') ||
    list[0]
  if (target) {
    await selectEvent(target.key)
  }
}

/** 选中事件后，用「已存模板或内置默认」填充编辑器 */
async function selectEvent(key: string) {
  selectedKey.value = key
  const event = events.value.find((e) => e.key === key)
  if (!event) return
  const stored = event.templates?.[locale.value]
  subject.value = stored?.subject ?? event.defaultSubject
  bodyHtml.value = stored?.bodyHtml ?? event.defaultBodyHtml
  await refreshPreview()
}

async function refreshPreview() {
  if (!selectedKey.value) return
  previewing.value = true
  try {
    const res = await previewEmailTemplate(selectedKey.value, {
      locale: locale.value,
      subject: subject.value,
      bodyHtml: bodyHtml.value,
    })
    previewSubject.value = res.data.data.subject
    previewHtml.value = res.data.data.bodyHtml
    previewStoredDisabled.value = res.data.data.storedDisabled === true
  } catch (error) {
    const message =
      (error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message || '预览渲染失败，请检查模板内容'
    ElMessage.error(message)
  } finally {
    previewing.value = false
  }
}

async function handleSave() {
  if (!selectedKey.value) return
  if (!subject.value.trim()) {
    ElMessage.warning('请填写邮件主题')
    return
  }
  if (!bodyHtml.value.trim()) {
    ElMessage.warning('请填写 HTML 正文')
    return
  }
  saving.value = true
  try {
    const res = await saveEmailTemplate(selectedKey.value, {
      locale: locale.value,
      subject: subject.value.trim(),
      bodyHtml: bodyHtml.value,
      isActive: true,
    })
    const updated = res.data.data
    const index = events.value.findIndex((e) => e.key === updated.key)
    if (index >= 0) events.value[index] = updated
    ElMessage.success('模板已保存')
    await refreshPreview()
  } catch (error) {
    const message =
      (error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message || '保存失败，请稍后重试'
    ElMessage.error(message)
  } finally {
    saving.value = false
  }
}

/**
 * 按当前事件模板真实发送一封测试邮件。
 * 与「SMTP 测试邮件」不同：这里走的是事件模板渲染链，收到的就是用户侧效果。
 */
async function handleTestSend() {
  if (!selectedKey.value) return
  const to = testTo.value.trim()
  if (!to) {
    ElMessage.warning('请填写收件人邮箱')
    return
  }
  sendingTest.value = true
  try {
    const res = await sendEventTemplateTestEmail(selectedKey.value, {
      to,
      subject: subject.value,
      bodyHtml: bodyHtml.value,
    })
    const result = res.data.data
    if (result.ok) {
      ElMessage.success(result.message)
    } else {
      ElMessage.error(result.message)
    }
  } catch (error) {
    const message =
      (error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message || '测试邮件发送失败，请稍后重试'
    ElMessage.error(message)
  } finally {
    sendingTest.value = false
  }
}

/** 把内置默认文案填回编辑器（需再点保存才真正生效） */
function resetToDefault() {
  if (!selectedEvent.value) return
  subject.value = selectedEvent.value.defaultSubject
  bodyHtml.value = selectedEvent.value.defaultBodyHtml
  ElMessage.info('已填入默认模板，点击「保存模板」后生效')
}

function insertVariable(key: string) {
  bodyHtml.value = `${bodyHtml.value}{{${key}}}`
}

onMounted(async () => {
  loading.value = true
  try {
    await loadEvents()
  } catch (error) {
    const message =
      (error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message || '获取邮件模板失败'
    ElMessage.error(message)
  } finally {
    loading.value = false
    isFirstLoad.value = false
  }
  if (prefersReducedMotion() || !panelRoot.value) return
  await nextTick()
  motionContext = gsap.context(() => {
    gsap.fromTo(
      '[data-reveal]',
      { autoAlpha: 0, y: 12 },
      { autoAlpha: 1, y: 0, duration: 0.34, stagger: 0.06, ease: 'power2.out', clearProps: 'all' },
    )
  }, panelRoot.value)
})
onBeforeUnmount(() => motionContext?.revert())
</script>

<template>
  <section ref="panelRoot" class="template-panel">
    <div class="panel-head" data-reveal>
      <div class="panel-copy">
        <h2>邮件模板</h2>
        <p>
          按「事件 + 语言」自定义通知邮件的主题与 HTML 正文。
          选择上方事件后即可编辑；未自定义的事件发送时使用系统内置默认模板。
          「使用中」表示系统已接入、会真实发送；「待接入」表示对应业务尚未上线、模板已就绪。
        </p>
      </div>
    </div>

    <PageSkeleton v-if="isFirstLoad && loading" type="form" :rows="6" />

    <EmptyState
      v-else-if="!events.length"
      title="暂无邮件事件"
      description="系统未注册任何邮件事件。"
    />

    <div v-else class="editor-pane" data-reveal aria-label="邮件模板编辑">
      <div class="event-picker-row">
        <span class="event-picker-label">邮件事件</span>
        <el-select
          v-model="selectedKey"
          class="event-picker"
          aria-label="选择邮件事件"
          @change="selectEvent"
        >
          <el-option
            v-for="event in events"
            :key="event.key"
            :value="event.key"
            :label="event.label"
          >
            <span class="option-copy">
              <strong>{{ event.label }}</strong>
              <em>{{ event.key }}</em>
            </span>
            <span class="option-tags">
              <span class="status-tag" :class="event.status" :title="statusHint(event)">
                {{ statusLabel(event) }}
              </span>
              <span v-if="event.templates?.[locale]" class="customized-tag">已自定义</span>
            </span>
          </el-option>
        </el-select>
        <small class="event-count">{{ events.length }} 个事件</small>
      </div>

      <div v-if="selectedEvent" class="editor-body">
        <div class="editor-head">
          <div>
            <h3>{{ selectedEvent.label }}</h3>
            <p>{{ selectedEvent.description }}</p>
          </div>
          <div class="head-meta">
            <el-tooltip :content="statusHint(selectedEvent)" placement="top">
              <span class="status-tag" :class="selectedEvent.status">{{ statusLabel(selectedEvent) }}</span>
            </el-tooltip>
            <span
              class="customized-note"
              :class="{ default: editorState === 'default' || editorState === 'same-as-default', warn: editorState === 'reverting' || editorState === 'modified' }"
            >{{ editorStateLabel }}</span>
          </div>
        </div>

        <div class="locale-row">
          <span class="locale-label">语言</span>
          <el-radio-group v-model="locale" disabled size="small">
            <el-radio-button value="en">English</el-radio-button>
            <el-radio-button value="zh" disabled>中文（待开放）</el-radio-button>
          </el-radio-group>
        </div>

        <el-form label-position="top" class="template-form" @submit.prevent>
          <el-form-item label="邮件主题">
            <el-input v-model="subject" placeholder="Your Culvoy verification code" />
          </el-form-item>

          <div class="variables-row">
            <span class="variables-label">可用变量（点击插入正文）</span>
            <div class="variable-chips">
              <button
                v-for="variable in selectedEvent.variables"
                :key="variable.key"
                type="button"
                class="variable-chip"
                :title="`${variable.label}，示例：${variable.example}`"
                @click="insertVariable(variable.key)"
              >
                <span v-text="'{{' + variable.key + '}}'" />
              </button>
            </div>
          </div>

          <div class="editor-grid">
            <div class="editor-source">
              <div class="pane-head">
                <span>HTML 源码</span>
                <div class="pane-tools">
                  <el-button
                    link
                    type="primary"
                    size="small"
                    :icon="RefreshRight"
                    :loading="previewing"
                    @click="refreshPreview"
                  >
                    预览 / 刷新
                  </el-button>
                  <el-button
                    link
                    type="primary"
                    size="small"
                    :loading="saving"
                    @click="handleSave"
                  >
                    保存模板
                  </el-button>
                  <el-button link size="small" :icon="MagicStick" @click="resetToDefault">
                    恢复默认文案
                  </el-button>
                </div>
              </div>
              <el-input
                v-model="bodyHtml"
                type="textarea"
                class="source-textarea"
                :autosize="{ minRows: 18, maxRows: 28 }"
                placeholder="<p>邮件正文 HTML…</p>"
                spellcheck="false"
              />
            </div>
            <div class="editor-preview">
              <div class="pane-head">
                <span>实际发件效果</span>
              </div>
              <div class="preview-body">
                <div class="preview-meta">
                  <strong class="preview-subject">{{ previewSubject || subject || '（无主题）' }}</strong>
                  <span v-if="previewStoredDisabled" class="preview-note">
                    已保存的模板处于停用状态，真实发送会改用系统默认模板
                  </span>
                </div>
                <iframe
                  v-if="previewHtml"
                  class="preview-frame"
                  sandbox=""
                  title="邮件正文预览"
                  :srcdoc="previewHtml"
                />
                <div v-else class="preview-empty">编辑正文后点击「预览 / 刷新」渲染</div>
              </div>
            </div>
          </div>
        </el-form>

        <div class="test-send-row">
          <div class="test-send-copy">
            <span class="test-send-label">发送测试邮件</span>
            <small class="test-send-hint">
              按本事件模板渲染后真实发送，收到的就是用户侧效果（含未保存的修改）。只想验证 SMTP 通道本身时，请用「SMTP 设置」页的测试邮件。
            </small>
          </div>
          <div class="test-send-controls">
            <el-input
              v-model="testTo"
              class="test-send-input"
              size="small"
              placeholder="收件人邮箱"
              aria-label="测试邮件收件人"
            />
            <el-button
              size="small"
              type="primary"
              plain
              :loading="sendingTest"
              :disabled="!testTo.trim()"
              @click="handleTestSend"
            >
              发送测试
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.template-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-head .panel-copy h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.panel-head .panel-copy p {
  margin: 6px 0 0;
  max-width: 720px;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
}

.editor-pane {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 14px;
  padding: 20px;
}

.event-picker-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.event-picker-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.event-picker {
  width: 320px;
}

.event-count {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.option-copy {
  display: inline-flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.option-copy strong {
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.option-copy em {
  font-style: normal;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.option-tags {
  float: right;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 16px;
}

.status-tag {
  font-size: 11px;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  cursor: help;
}

.status-tag.active {
  background: var(--el-color-success-light-8);
  color: var(--el-color-success);
}

.customized-tag {
  font-size: 11px;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--el-color-primary-light-8);
  color: var(--el-color-primary);
  white-space: nowrap;
}

.editor-body {
  padding-top: 16px;
}

.editor-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.editor-head h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.editor-head p {
  margin: 6px 0 0;
  max-width: 560px;
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--el-text-color-secondary);
}

.head-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex-shrink: 0;
}

.customized-note {
  font-size: 12px;
  color: var(--el-color-primary);
}

.customized-note.default {
  color: var(--el-text-color-secondary);
}

.customized-note.warn {
  color: var(--el-color-warning);
}

.locale-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 14px 0 4px;
}

.locale-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.variables-row {
  margin: 4px 0 12px;
}

.variables-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.variable-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.variable-chip {
  border: 1px solid var(--el-border-color);
  background: var(--el-fill-color-lighter);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.variable-chip:hover {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.editor-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: start;
  gap: 16px;
}

.editor-source,
.editor-preview {
  display: grid;
  grid-row: span 2;
  grid-template-rows: subgrid;
  min-width: 0;
  row-gap: 8px;
}

.pane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  min-height: 36px;
  margin-bottom: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.pane-tools {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.pane-tools .el-button + .el-button {
  margin-left: 0;
}

.source-textarea :deep(.el-textarea__inner) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12.5px;
  line-height: 1.6;
}

.preview-meta {
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-bottom: 0;
  border-radius: 10px 10px 0 0;
  background: var(--el-fill-color-lighter);
}

.preview-subject {
  font-size: 13px;
  color: var(--el-text-color-primary);
  word-break: break-word;
}

.preview-frame {
  width: 100%;
  min-height: 420px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 0 0 10px 10px;
  background: #fff;
  display: block;
}

.preview-empty {
  border: 1px dashed var(--el-border-color);
  border-radius: 0 0 10px 10px;
  min-height: 420px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.preview-note {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  font-weight: 400;
  color: var(--el-color-warning);
}

.test-send-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 16px;
  padding: 14px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
}

.test-send-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1 1 320px;
}

.test-send-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.test-send-hint {
  font-size: 12px;
  line-height: 1.65;
  color: var(--el-text-color-secondary);
}

.test-send-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.test-send-input {
  width: 220px;
}

@media (max-width: 1100px) {
  .editor-grid {
    grid-template-columns: 1fr;
  }

  .editor-source,
  .editor-preview {
    grid-row: auto;
    grid-template-rows: auto auto;
  }
}

@media (max-width: 768px) {
  .event-picker-row {
    flex-wrap: wrap;
  }

  .event-picker {
    width: 100%;
    flex: 1;
  }

  .editor-head {
    flex-direction: column;
  }

  .head-meta {
    flex-direction: row;
    align-items: center;
  }
}
</style>
