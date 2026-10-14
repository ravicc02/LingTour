<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { serviceRequestsApi, type RequestMessage } from '@/api/service-requests'
import { formatDateTime } from '@/utils/format'
const props = defineProps<{ requestId: string; allowed: boolean; closed: boolean }>()
const messages = ref<RequestMessage[]>([])
const body = ref('')
const loading = ref(false)
const sending = ref(false)
const error = ref('')
const cursor = ref<string | null>(null)
const hasMore = ref(false)
const retry = ref<{ body: string; key: string } | null>(null)
let generation = 0
async function load(more = false) {
  if (!props.allowed) return
  const run = generation
  const id = props.requestId
  loading.value = true
  error.value = ''
  try {
    const response = await serviceRequestsApi.messages(id, more ? cursor.value ?? undefined : undefined)
    if (run !== generation) return
    const result = response.data.data
    messages.value = more ? [...messages.value, ...result.data.filter(item => !messages.value.some(old => old.id === item.id))] : result.data
    cursor.value = result.nextCursor
    hasMore.value = result.hasMore
    const last = messages.value.at(-1)
    if (last) await serviceRequestsApi.read(id, last.id)
  } catch {
    if (run === generation) error.value = '对话加载失败，请重试。'
  } finally { if (run === generation) loading.value = false }
}
async function send() {
  const text = body.value.trim()
  if (!text || text.length > 4000 || sending.value || props.closed || !props.allowed || hasMore.value) return
  const id = props.requestId
  const run = generation
  const submission = retry.value?.body === text ? retry.value : { body: text, key: crypto.randomUUID() }
  retry.value = submission
  sending.value = true
  try {
    const response = await serviceRequestsApi.send(id, submission.body, submission.key)
    if (run !== generation) return
    const result = response.data.data
    if (!messages.value.some(item => item.id === result.id)) messages.value.push(result)
    body.value = ''
    retry.value = null
    ElMessage.success('消息已发送')
  } catch { if (run === generation) error.value = '发送失败，可使用相同内容重试，不会重复发送。' }
  finally { if (run === generation) sending.value = false }
}
watch(() => [props.requestId, props.allowed], () => {
  generation++
  messages.value = []; body.value = ''; cursor.value = null; hasMore.value = false; retry.value = null; error.value = ''; sending.value = false
  void load()
}, { immediate: true })
</script>
<template>
  <section aria-label="私人请求对话" class="messages-panel">
    <h3>私人对话</h3>
    <el-alert v-if="!allowed" title="仅请求本人和已分配运营人员可访问对话。请先分配给自己的真实后台账号。" type="info" :closable="false" />
    <template v-else>
      <p v-if="error" role="alert">{{ error }} <el-button @click="load()">重试加载</el-button></p>
      <div v-loading="loading" class="message-list" aria-live="polite">
        <el-empty v-if="!loading && !messages.length" description="暂无消息" :image-size="64" />
        <article v-for="message in messages" :key="message.id" :class="['message', message.senderType]">
          <div class="message-meta">{{ message.senderType === 'owner' ? '旅行者' : '运营人员' }} · {{ formatDateTime(message.createdAt) }}</div>
          <p>{{ message.body }}</p>
        </article>
      </div>
      <el-button v-if="hasMore" :loading="loading" @click="load(true)">加载后续消息</el-button>
      <el-button v-else :loading="loading" @click="load()">刷新对话</el-button>
      <p v-if="hasMore">请先加载后续消息，再回复，以保持对话和未读标记顺序。</p>
      <el-form v-if="!closed" @submit.prevent="send" class="message-form">
        <el-form-item label="英文消息">
          <el-input v-model="body" type="textarea" :rows="4" maxlength="4000" show-word-limit placeholder="输入发送给旅行者的英文消息" aria-label="英文消息" />
        </el-form-item>
        <el-button type="primary" :disabled="!body.trim() || hasMore" :loading="sending" native-type="submit">发送消息</el-button>
      </el-form>
      <p v-else>请求已关闭，对话仅供查阅。</p>
    </template>
  </section>
</template>
<style scoped>
.messages-panel { margin-top: 24px; }
.message-list { max-height: 420px; overflow-y: auto; margin: 16px 0; }
.message { padding: 12px; border: 1px solid var(--el-border-color); border-radius: var(--el-border-radius-base); margin-bottom: 12px; }
.message.staff { background: var(--el-fill-color-light); }
.message-meta { font-size: 12px; color: var(--el-text-color-secondary); }
.message p { white-space: pre-wrap; overflow-wrap: anywhere; margin: 8px 0 0; }
.message-form { margin-top: 16px; }
@media(max-width: 767px) { :deep(.el-textarea__inner) { font-size: 16px; } :deep(.el-button) { min-height: 44px; } }
</style>
