<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, RefreshRight, View } from '@element-plus/icons-vue'
import {
  getEmailLog,
  getEmailLogStats,
  listEmailLogs,
  listEmailTemplateEvents,
  resendEmailLog,
} from '@/api/email'
import type { EmailEventView, EmailLogDetail, EmailLogView } from '@/types/email'
import { useIsMobile } from '@/composables/useIsMobile'

const isMobile = useIsMobile()

type LogStatus = 'sent' | 'failed' | 'skipped'

const STATUS_META: Record<
  LogStatus,
  { label: string; type: 'success' | 'danger' | 'info' }
> = {
  sent: { label: '已送达', type: 'success' },
  failed: { label: '发送失败', type: 'danger' },
  skipped: { label: '未投递', type: 'info' },
}

const loading = ref(true)
const rows = ref<EmailLogView[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const stats = reactive({ sent: 0, failed: 0, skipped: 0 })
const events = ref<EmailEventView[]>([])

const filters = reactive<{
  status: LogStatus | ''
  eventKey: string
  recipient: string
}>({
  status: '',
  eventKey: '',
  recipient: '',
})

const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<EmailLogDetail | null>(null)
const resendingId = ref('')

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

async function load() {
  loading.value = true
  try {
    const [result, totals] = await Promise.all([
      listEmailLogs({
        page: page.value,
        limit: pageSize.value,
        status: filters.status || undefined,
        eventKey: filters.eventKey || undefined,
        recipient: filters.recipient.trim() || undefined,
      }),
      getEmailLogStats(),
    ])
    rows.value = result.data
    total.value = result.total
    stats.sent = totals.sent
    stats.failed = totals.failed
    stats.skipped = totals.skipped
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载发送日志失败')
  } finally {
    loading.value = false
  }
}

async function applyFilters() {
  page.value = 1
  await load()
}

async function handlePageChange(next: number) {
  page.value = next
  await load()
}

async function loadEvents() {
  try {
    events.value = await listEmailTemplateEvents()
  } catch {
    // 事件下拉只是筛选辅助，取不到时不影响日志本身
    events.value = []
  }
}

async function openDetail(row: EmailLogView) {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await getEmailLog(row.id)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '读取该条日志失败')
    detailVisible.value = false
  } finally {
    detailLoading.value = false
  }
}

async function handleResend(row: { id: string }) {
  resendingId.value = row.id
  try {
    const res = (await resendEmailLog(row.id)) as unknown as {
      data?: { data?: { ok: boolean; message: string } }
    }
    const payload = res?.data?.data
    const message = payload?.message ?? '重发完成'
    if (payload?.ok === false) {
      ElMessage.warning(message)
    } else {
      ElMessage.success(message)
    }
    await load()
    if (detailVisible.value && detail.value?.id === row.id) {
      detail.value = await getEmailLog(row.id)
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '重发失败')
  } finally {
    resendingId.value = ''
  }
}

onMounted(async () => {
  await Promise.all([load(), loadEvents()])
})
</script>

<template>
  <section class="log-panel" aria-label="发送日志">
    <div class="panel-head">
      <div class="head-copy">
        <h2>发送日志</h2>
        <p>
          每次真实投递都会留一条记录，记录里保存的就是当时交给 SMTP 的渲染结果——
          也就是用户收到的那封信。发送失败或未投递的记录可以在这里直接重发。
        </p>
      </div>
      <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
    </div>

    <div class="stat-row">
      <div class="stat-card">
        <span class="stat-value">{{ stats.sent }}</span>
        <span class="stat-label">已送达</span>
      </div>
      <div class="stat-card" :class="{ 'stat-card--alert': stats.failed > 0 }">
        <span class="stat-value">{{ stats.failed }}</span>
        <span class="stat-label">发送失败</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats.skipped }}</span>
        <span class="stat-label">未投递（SMTP 未配置）</span>
      </div>
    </div>

    <div class="filter-row">
      <el-select v-model="filters.status" placeholder="全部状态" clearable class="filter-status" @change="applyFilters">
        <el-option label="已送达" value="sent" />
        <el-option label="发送失败" value="failed" />
        <el-option label="未投递" value="skipped" />
      </el-select>
      <el-select
        v-model="filters.eventKey"
        placeholder="全部事件"
        clearable
        filterable
        class="filter-event"
        @change="applyFilters"
      >
        <el-option v-for="event in events" :key="event.key" :label="event.label" :value="event.key" />
      </el-select>
      <el-input
        v-model="filters.recipient"
        placeholder="按收件人搜索"
        clearable
        autocomplete="off"
        class="filter-recipient"
        @keyup.enter="applyFilters"
        @clear="applyFilters"
      />
      <el-button type="primary" @click="applyFilters">筛选</el-button>
    </div>

    <el-table v-loading="loading" :data="rows" class="log-table table-card" empty-text="暂无发送记录">
      <el-table-column label="时间" width="180">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="事件" min-width="160">
        <template #default="{ row }">
          <div class="event-cell">
            <span>{{ row.eventLabel }}</span>
            <code>{{ row.eventKey }}</code>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="recipient" label="收件人" min-width="200" show-overflow-tooltip />
      <el-table-column prop="subject" label="主题" min-width="220" show-overflow-tooltip />
      <el-table-column label="状态" width="120">
        <template #default="{ row }">
          <el-tag :type="STATUS_META[row.status as LogStatus].type" effect="light" size="small">
            {{ STATUS_META[row.status as LogStatus].label }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="170" :fixed="isMobile ? false : 'right'">
        <template #default="{ row }">
          <div class="admin-table-actions">
            <el-button link type="primary" :icon="View" @click="openDetail(row)">详情</el-button>
            <el-button
              v-if="row.status !== 'sent'"
              link
              type="primary"
              :icon="RefreshRight"
              :loading="resendingId === row.id"
              @click="handleResend(row)"
            >
              重发
            </el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <div class="pager-row">
      <el-pagination
        background
        layout="total, prev, pager, next"
        :total="total"
        :current-page="page"
        :page-size="pageSize"
        @current-change="handlePageChange"
      />
    </div>

    <el-drawer v-model="detailVisible" title="发送详情" size="640px" direction="rtl">
      <div v-loading="detailLoading" class="detail-body">
        <template v-if="detail">
          <dl class="detail-meta">
            <div>
              <dt>事件</dt>
              <dd>{{ detail.eventLabel }}（{{ detail.eventKey }}）</dd>
            </div>
            <div>
              <dt>收件人</dt>
              <dd>{{ detail.recipient }}</dd>
            </div>
            <div>
              <dt>主题</dt>
              <dd>{{ detail.subject }}</dd>
            </div>
            <div>
              <dt>状态</dt>
              <dd>
                {{ STATUS_META[detail.status].label }} · 尝试 {{ detail.attempts }} 次
              </dd>
            </div>
            <div>
              <dt>最近一次</dt>
              <dd>{{ formatTime(detail.lastAttemptAt) }}</dd>
            </div>
          </dl>

          <el-alert
            v-if="detail.error"
            type="error"
            :closable="false"
            show-icon
            :title="detail.error"
            class="detail-error"
          />

          <div class="preview-head">
            <h3>用户收到的内容（渲染后）</h3>
            <el-button
              v-if="detail.status !== 'sent'"
              type="primary"
              :icon="RefreshRight"
              :loading="resendingId === detail.id"
              @click="handleResend(detail)"
            >
              重发这封邮件
            </el-button>
          </div>
          <iframe
            class="preview-frame"
            sandbox=""
            title="发送内容预览"
            :srcdoc="detail.bodyHtml"
          />
        </template>
      </div>
    </el-drawer>
  </section>
</template>

<style scoped>
.log-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.head-copy h2 {
  margin: 0 0 4px;
  font-size: 18px;
}

.head-copy p {
  margin: 0;
  max-width: 68ch;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.stat-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
}

.stat-card--alert {
  border-color: var(--el-color-danger-light-5);
  background: var(--el-color-danger-light-9);
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.1;
}

.stat-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-status {
  width: 150px;
}

.filter-event {
  width: 220px;
}

.filter-recipient {
  width: 260px;
}

/* Narrow screens: a 150/220/260px filter row wraps into a ragged column, so
   every control takes the full width instead. */
@media (max-width: 768px) {
  .filter-status,
  .filter-event,
  .filter-recipient,
  .filter-row > .el-button {
    width: 100%;
  }
}

.event-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.event-cell code {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.pager-row {
  display: flex;
  justify-content: flex-end;
}

.detail-body {
  min-height: 200px;
}

.detail-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin: 0 0 16px;
}

.detail-meta dt {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.detail-meta dd {
  margin: 2px 0 0;
  font-size: 14px;
  word-break: break-word;
}

.detail-error {
  margin-bottom: 16px;
}

.preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.preview-head h3 {
  margin: 0;
  font-size: 15px;
}

.preview-frame {
  width: 100%;
  height: 460px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: #fff;
}
</style>