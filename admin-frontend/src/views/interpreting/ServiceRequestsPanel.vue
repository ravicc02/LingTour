<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { serviceRequestsApi, serviceTypeLabels, processLabels, usdCents, type ServiceRequest, type ProcessStatus } from '@/api/service-requests'
import { interpretersApi } from '@/api/interpreters'
import { readContentValue } from '@/types/common'
import type { Interpreter } from '@/types/interpreting'
import { useAuthStore } from '@/store/auth'
import { useIsMobile } from '@/composables/useIsMobile'
import { formatDateTime } from '@/utils/format'
import RequestMessages from './RequestMessages.vue'
import RequestQuote from './RequestQuote.vue'
const auth = useAuthStore()
const mobile = useIsMobile()
const rows = ref<ServiceRequest[]>([])
const total = ref(0)
const page = ref(1)
const size = ref(20)
const loading = ref(false)
const error = ref('')
const filters = ref({ q: '', serviceType: '', processStatus: '', citySlug: '' })
const selected = ref<ServiceRequest | null>(null)
const visible = ref(false)
const staff = ref<Array<{ id: string; name: string; role: string }>>([])
const interpreters = ref<Interpreter[]>([])
const plannerId = ref('')
const interpreterId = ref('')
const reason = ref('')
const assigning = ref(false)
const allowed = computed(() => !!selected.value && selected.value.canReadConversation && selected.value.assignedPlannerId === auth.user?.id)
const closed = computed(() => selected.value?.processStatus === 'completed' || selected.value?.processStatus === 'cancelled')
const nextStatuses = computed<ProcessStatus[]>(() => {
  const status = selected.value?.processStatus
  if (status === 'assigned' || status === 'in_progress') return selected.value?.serviceType === 'custom_route' ? ['cancelled'] : ['confirmed', 'in_progress', 'cancelled'].filter(item => item !== status) as ProcessStatus[]
  if (status === 'confirmed') return ['in_progress', 'completed', 'cancelled']
  if (status === 'quoted') return ['cancelled']
  return []
})
let listGeneration = 0
let detailGeneration = 0
async function load() {
  const run = ++listGeneration
  loading.value = true; error.value = ''
  try {
    const response = await serviceRequestsApi.list({ page: page.value, size: size.value, ...filters.value })
    if (run !== listGeneration) return
    rows.value = response.data.data.data; total.value = response.data.data.total
  } catch { if (run === listGeneration) error.value = '服务请求加载失败，请重试。' }
  finally { if (run === listGeneration) loading.value = false }
}
async function search() { page.value = 1; await load() }
async function reset() { filters.value = { q: '', serviceType: '', processStatus: '', citySlug: '' }; await search() }
async function open(row: ServiceRequest) {
  const run = ++detailGeneration
  selected.value = null; visible.value = true
  try {
    const response = await serviceRequestsApi.detail(row.id)
    if (run !== detailGeneration) return
    selected.value = response.data.data; plannerId.value = selected.value.assignedPlannerId ?? ''; interpreterId.value = selected.value.assignedInterpreterId ?? ''; reason.value = ''
    const [staffResponse, interpreterResponse] = await Promise.all([serviceRequestsApi.staff(), interpretersApi.getInterpreters({ page: 1, pageSize: 100, status: 'active' } as any)])
    if (run !== detailGeneration) return
    staff.value = staffResponse.data.data.data; interpreters.value = interpreterResponse.data.data.data
  } catch { if (run === detailGeneration) ElMessage.error('请求详情加载失败') }
}
async function refresh() {
  if (!selected.value) return
  const id = selected.value.id
  const run = detailGeneration
  const response = await serviceRequestsApi.detail(id)
  if (run === detailGeneration) selected.value = response.data.data
  await load()
}
async function assign() {
  if (!selected.value || !plannerId.value) { ElMessage.warning('请选择真实运营人员账号'); return }
  assigning.value = true
  try { await serviceRequestsApi.assign(selected.value.id, { plannerId: plannerId.value, interpreterId: selected.value.serviceType === 'interpretation' ? interpreterId.value || undefined : undefined, reason: reason.value || undefined }); ElMessage.success('已分配，未自动确认服务'); await refresh() }
  catch (err: any) { ElMessage.error(err?.response?.data?.message || '分配失败') }
  finally { assigning.value = false }
}
async function process(status: ProcessStatus) {
  if (!selected.value) return
  try { await serviceRequestsApi.process(selected.value.id, status); ElMessage.success('处理状态已更新'); await refresh() }
  catch (err: any) { ElMessage.error(err?.response?.data?.message || '状态更新失败') }
}
onMounted(load)
</script>
<template>
  <section aria-label="服务请求管理">
    <el-alert title="免费固定路线、定制路线规划与口译服务独立处理。新请求付款政策未配置，不生成任何定金或支付订单。历史预约仍保留原币种。" type="info" :closable="false" />
    <el-form class="request-filters" inline @submit.prevent="search">
      <el-form-item label="搜索"><el-input v-model="filters.q" placeholder="姓名 / 联系方式" clearable /></el-form-item>
      <el-form-item label="服务类型"><el-select v-model="filters.serviceType" clearable placeholder="全部"><el-option v-for="(label, value) in serviceTypeLabels" :key="value" :label="label" :value="value" /></el-select></el-form-item>
      <el-form-item label="处理状态"><el-select v-model="filters.processStatus" clearable placeholder="全部"><el-option v-for="(label, value) in processLabels" :key="value" :label="label" :value="value" /></el-select></el-form-item>
      <el-form-item label="城市标识"><el-input v-model="filters.citySlug" placeholder="citySlug" clearable /></el-form-item>
      <el-form-item><el-button type="primary" native-type="submit">查询</el-button><el-button @click="reset">重置</el-button></el-form-item>
    </el-form>
    <p v-if="error" role="alert">{{ error }} <el-button @click="load">重试</el-button></p>
    <el-card shadow="never" class="request-table">
      <el-table v-if="!mobile" v-loading="loading" :data="rows" stripe>
        <el-table-column prop="name" label="请求人" min-width="120" />
        <el-table-column label="服务类型" min-width="140"><template #default="{ row }">{{ serviceTypeLabels[row.serviceType as keyof typeof serviceTypeLabels] }}</template></el-table-column>
        <el-table-column prop="citySlug" label="城市" min-width="110" />
        <el-table-column prop="date" label="日期" width="115" />
        <el-table-column label="服务金额" width="175"><template #default="{ row }">{{ usdCents(row.priceSnapshot.amountCents) }}</template></el-table-column>
        <el-table-column label="处理状态" width="120"><template #default="{ row }">{{ processLabels[row.processStatus as ProcessStatus] }}</template></el-table-column>
        <el-table-column label="运营分配" width="120"><template #default="{ row }">{{ row.assignedPlannerId ? '已分配' : '待分配' }}</template></el-table-column>
        <el-table-column label="操作" width="90"><template #default="{ row }"><el-button type="primary" link @click="open(row)">详情</el-button></template></el-table-column>
      </el-table>
      <div v-else v-loading="loading" class="request-cards">
        <el-empty v-if="!loading && !rows.length" description="暂无服务请求" />
        <article v-for="row in rows" :key="row.id" class="request-card">
          <h3>{{ row.name }} · {{ serviceTypeLabels[row.serviceType] }}</h3>
          <p>{{ row.citySlug }} · {{ row.date }} · {{ row.groupSize }} 人</p>
          <p>{{ usdCents(row.priceSnapshot.amountCents) }} · {{ processLabels[row.processStatus] }}</p>
          <el-button @click="open(row)">查看请求详情</el-button>
        </article>
      </div>
      <div class="pagination-wrap"><el-pagination v-model:current-page="page" v-model:page-size="size" :total="total" :page-sizes="[10,20,50]" :layout="mobile ? 'prev,pager,next' : 'total,sizes,prev,pager,next'" @current-change="load" @size-change="search" /></div>
    </el-card>
    <el-drawer v-model="visible" title="服务请求详情" :size="mobile ? '100%' : '680px'" @closed="detailGeneration++; selected = null">
      <template v-if="selected">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="服务类型">{{ serviceTypeLabels[selected.serviceType] }}</el-descriptions-item>
          <el-descriptions-item label="请求人">{{ selected.name }}</el-descriptions-item>
          <el-descriptions-item label="联系方式">{{ selected.contact }}</el-descriptions-item>
          <el-descriptions-item label="城市 / 路线">{{ selected.citySlug }} / {{ selected.routeId || '无固定路线' }}</el-descriptions-item>
          <el-descriptions-item label="关联请求">{{ selected.linkedRequestId || '无' }}</el-descriptions-item>
          <el-descriptions-item label="日期 / 人数">{{ selected.date }} / {{ selected.groupSize }}</el-descriptions-item>
          <el-descriptions-item label="处理状态">{{ processLabels[selected.processStatus] }}</el-descriptions-item>
          <el-descriptions-item label="支付状态">{{ selected.paymentStatus === 'not_required' ? '无需支付路线费用' : selected.paymentStatus === 'quote_required' ? '待规划报价' : '付款规则待确认（不代表已付款）' }}</el-descriptions-item>
          <el-descriptions-item label="独立服务金额">{{ usdCents(selected.priceSnapshot.amountCents) }}</el-descriptions-item>
          <el-descriptions-item v-if="selected.packageSnapshot" label="口译套餐快照">{{ selected.packageSnapshot.hours }} 小时 / {{ selected.packageSnapshot.routeType === 'fixed' ? '固定路线' : '定制路线' }} / {{ usdCents(selected.packageSnapshot.amountCents) }}</el-descriptions-item>
          <el-descriptions-item label="语言组合">{{ selected.requirements.languagePair || '未选择' }}</el-descriptions-item>
          <el-descriptions-item v-for="(value, key) in selected.requirements.preferences" :key="key" :label="({ days:'天数', interests:'意向内容', foodPreferences:'饮食偏好', accommodation:'住宿', budget:'预算说明', budgetAmount:'预算金额', budgetCurrency:'预算币种', serviceContext:'服务场景', notes:'补充说明' } as Record<string,string>)[key] || key"><div class="request-value">{{ Array.isArray(value) ? value.join(', ') : value }}</div></el-descriptions-item>
          <el-descriptions-item label="偏好译员">{{ selected.preferredInterpreterId || '无' }}（偏好不代表已分配）</el-descriptions-item>
          <el-descriptions-item label="已分配译员">{{ selected.assignedInterpreterName || '未分配' }}</el-descriptions-item>
        </el-descriptions>
        <el-form v-if="!closed" label-position="top" class="assignment-form" @submit.prevent="assign">
          <h3>运营人员分配</h3>
          <el-form-item label="真实后台账号（管理员 / 编辑均可）"><el-select v-model="plannerId" placeholder="选择运营人员"><el-option v-for="person in staff" :key="person.id" :value="person.id" :label="person.name" /></el-select></el-form-item>
          <el-button v-if="auth.user?.id" @click="plannerId = auth.user.id">选择当前账号</el-button>
          <el-form-item v-if="selected.serviceType === 'interpretation'" label="口译员"><el-select v-model="interpreterId" placeholder="可选口译员" clearable><el-option v-for="person in interpreters" :key="person.id" :value="person.id" :label="readContentValue(person.name)" /></el-select></el-form-item>
          <el-form-item label="分配说明"><el-input v-model="reason" maxlength="1000" /></el-form-item>
          <el-button type="primary" :loading="assigning" native-type="submit">保存分配</el-button>
        </el-form>
        <el-collapse class="assignment-history"><el-collapse-item title="分配记录"><p v-if="!selected.assignmentLog?.length">暂无分配记录</p><article v-for="entry in selected.assignmentLog" :key="entry.id"><p>{{ formatDateTime(entry.createdAt) }} · {{ staff.find(person => person.id === entry.plannerId)?.name || entry.plannerId }}</p><p class="request-value">{{ entry.reason || '无补充说明' }}</p></article></el-collapse-item></el-collapse>
        <div v-if="allowed && !closed" class="process-actions"><el-button v-for="status in nextStatuses" :key="status" @click="process(status)">{{ processLabels[status] }}</el-button></div>
        <RequestQuote v-if="selected.serviceType === 'custom_route'" :request="selected" :allowed="allowed" :closed="closed" @changed="refresh" />
        <RequestMessages :request-id="selected.id" :allowed="allowed" :closed="closed" />
      </template>
    </el-drawer>
  </section>
</template>
<style scoped>
.request-filters { margin-top: 20px; }
.request-filters :deep(.el-select) { width: 160px; }
.request-filters :deep(.el-input) { width: 180px; }
.request-table { margin-top: 16px; }
.request-value { white-space: pre-wrap; overflow-wrap: anywhere; }
.assignment-form, .assignment-history, .process-actions { margin-top: 24px; }
.assignment-form :deep(.el-select) { width: 100%; }
.process-actions { display: flex; gap: 12px; flex-wrap: wrap; }
.request-cards { display: grid; gap: 16px; }
.request-card { border-bottom: 1px solid var(--el-border-color); padding-bottom: 16px; }
.request-card h3 { margin: 0 0 8px; }
@media(max-width: 767px) { .request-filters :deep(.el-form-item) { display: block; margin-right: 0; } .request-filters :deep(.el-input), .request-filters :deep(.el-select) { width: 100%; } :deep(.el-input__inner), :deep(.el-textarea__inner) { font-size: 16px; } :deep(.el-button) { min-height: 44px; } }
</style>
