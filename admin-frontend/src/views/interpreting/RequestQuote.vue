<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { serviceRequestsApi, usdCents, type ServiceRequest } from '@/api/service-requests'
const props = defineProps<{ request: ServiceRequest; allowed: boolean; closed: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const amount = ref('')
const scope = ref('')
const saving = ref(false)
watch(() => props.request.id, () => { amount.value = ''; scope.value = '' }, { immediate: true })
async function offer() {
  if (!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(amount.value)) { ElMessage.warning('请输入最多两位小数的 USD 金额'); return }
  const [units, fraction = ''] = amount.value.split('.')
  const cents = Number(units) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > 2147483647 || !scope.value.trim()) { ElMessage.warning('请输入有效金额与英文服务范围'); return }
  saving.value = true
  try {
    await serviceRequestsApi.quote(props.request.id, { amountCents: cents, scope: scope.value.trim(), expectedRevision: props.request.quote?.revision ?? 0 })
    ElMessage.success('规划报价已发送，等待用户确认'); amount.value = ''; scope.value = ''; emit('changed')
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '报价失败，请刷新后重试') }
  finally { saving.value = false }
}
</script>
<template>
  <section class="quote-panel" aria-label="定制路线规划报价">
    <h3>独立规划报价</h3>
    <el-alert title="报价只涵盖定制路线规划，不含口译套餐。付款规则未配置，不创建定金或支付链接。" type="info" :closable="false" />
    <el-descriptions v-if="request.quote" :column="1" border class="quote-summary">
      <el-descriptions-item label="报价版本">{{ request.quote.revision }}</el-descriptions-item>
      <el-descriptions-item label="规划费用">{{ usdCents(request.quote.amountCents) }}</el-descriptions-item>
      <el-descriptions-item label="状态">{{ request.quote.status === 'accepted' ? '用户已接受（不代表已付款）' : '等待用户确认' }}</el-descriptions-item>
      <el-descriptions-item label="英文服务范围"><div class="scope">{{ request.quote.scope }}</div></el-descriptions-item>
    </el-descriptions>
    <el-form v-if="allowed && !closed && request.quote?.status !== 'accepted'" label-position="top" @submit.prevent="offer" class="quote-form">
      <el-form-item label="规划金额（USD，最多两位小数）"><el-input v-model="amount" inputmode="decimal" aria-label="规划金额 USD" /></el-form-item>
      <el-form-item label="服务范围（英文）"><el-input v-model="scope" type="textarea" :rows="4" maxlength="4000" show-word-limit aria-label="英文服务范围" /></el-form-item>
      <el-button type="primary" :loading="saving" native-type="submit">{{ request.quote ? '发送新版报价' : '发送报价' }}</el-button>
    </el-form>
    <p v-else-if="!allowed">只有已分配运营人员可以发送报价。</p>
  </section>
</template>
<style scoped>
.quote-panel { margin-top: 24px; }
.quote-form, .quote-summary { margin-top: 16px; }
.scope { white-space: pre-wrap; overflow-wrap: anywhere; }
@media(max-width: 767px) { :deep(.el-input__inner), :deep(.el-textarea__inner) { font-size: 16px; } :deep(.el-button) { min-height: 44px; } }
</style>
