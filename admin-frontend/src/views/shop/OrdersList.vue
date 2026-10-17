<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ordersApi } from '@/api/orders'
import { OrderStatusMap, OrderStatusColorMap, PaymentStatusMap, PaymentStatusColorMap } from '@/types/order'
import type { Order } from '@/types/order'
import { formatDateTime } from '@/utils/format'
import { readContentValue } from '@/types/common'
import { useListPage } from '@/composables/useListPage'
import { ListToolbar } from '@/components/list'
import { useIsMobile } from '@/composables/useIsMobile'

const isMobile = useIsMobile()

const router = useRouter()

const listPage = useListPage<Order>({
  fetchApi: (params) => ordersApi.getOrders(params as any),
  defaultFilters: {
    keyword: '',
    status: '',
    paymentStatus: '',
    startDate: '',
    endDate: '',
  },
})

const {
  loading, list, total, page, pageSize,
  filters,
  handleSearch,
  handlePageChange, handleSizeChange,
} = listPage

const dateRange = ref<[string, string]>(['', ''])

const statusOptions: { label: string; value: string }[] = Object.entries(OrderStatusMap).map(
  ([value, label]) => ({ label, value })
)

const paymentStatusOptions: { label: string; value: string }[] = Object.entries(PaymentStatusMap).map(
  ([value, label]) => ({ label, value })
)

function onDateRangeChange(val: [string, string] | null) {
  filters.startDate = val?.[0] ?? ''
  filters.endDate = val?.[1] ?? ''
  handleSearch()
}

function handleReset() {
  dateRange.value = ['', '']
  listPage.handleReset()
}

function handleViewDetail(id: string) {
  router.push(`/admin/orders/${id}`)
}

async function handleShip(row: Order) {
  try {
    await ElMessageBox.confirm(
      `确定将订单 ${row.orderNo} 标记为已发货?`,
      '确认发货',
      { type: 'info' }
    )
    await ordersApi.markShipped(row.id)
    row.status = 'shipped'
    ElMessage.success(`订单 ${row.orderNo} 已发货`)
  } catch (err: any) {
    if (err?.response) ElMessage.error(err.response.data?.message || '发货失败')
  }
}

async function handleRefund(row: Order) {
  try {
    const { value: reason } = await ElMessageBox.prompt(
      '请输入退款原因(可选)',
      '确认退款',
      {
        inputPlaceholder: '退款原因',
        inputType: 'textarea',
        confirmButtonText: '确定退款',
        cancelButtonText: '取消',
      }
    )
    await ordersApi.markRefunded(row.id, reason || undefined)
    row.paymentStatus = 'refunded'
    ElMessage.success(`订单 ${row.orderNo} 已退款`)
  } catch (err: any) {
    if (err?.response) ElMessage.error(err.response.data?.message || '退款失败')
  }
}

function itemsSummary(items: Order['items']) {
  if (!items || !items.length) return '-'
  return items.map((i: any) => `${readContentValue(i.productName) || i.productName} ×${i.quantity}`).join('、')
}
</script>

<template>
  <div>
    <div class="page-header">
      <h2>订单管理</h2>
    </div>

    <!-- 筛选栏 -->
    <ListToolbar
      v-model="filters.keyword"
      search-placeholder="搜索订单号/用户邮箱"
      @search="handleSearch"
      @reset="handleReset"
    >
      <el-select
        v-model="filters.status"
        placeholder="履约状态"
        clearable
        style="width: 140px"
        @change="handleSearch"
      >
        <el-option
          v-for="opt in statusOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>

      <el-select
        v-model="filters.paymentStatus"
        placeholder="支付状态"
        clearable
        style="width: 140px"
        @change="handleSearch"
      >
        <el-option
          v-for="opt in paymentStatusOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>

      <el-date-picker
        v-model="dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        format="YYYY-MM-DD"
        value-format="YYYY-MM-DD"
        style="width: 260px"
        @change="onDateRangeChange"
      />
    </ListToolbar>

    <el-card shadow="never" class="table-card">
    <el-table :data="list" v-loading="loading" stripe>
      <el-table-column prop="orderNo" label="订单号" width="180" />
      <el-table-column label="用户" min-width="140">
        <template #default="{ row }">
          <div>{{ row.userName }}</div>
          <div style="font-size: 12px; color: #909399">{{ row.userEmail }}</div>
        </template>
      </el-table-column>
      <el-table-column label="商品明细" min-width="220">
        <template #default="{ row }">
          <div class="items-summary">{{ itemsSummary(row.items) }}</div>
        </template>
      </el-table-column>
      <el-table-column label="金额" width="120" align="right">
        <template #default="{ row }">
          <div>
            <span style="font-weight: 600">{{ row.currency }} {{ row.total.toFixed(2) }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="履约状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag
            :type="(OrderStatusColorMap as Record<string, string>)[row.status]"
            size="small"
          >
            {{ (OrderStatusMap as Record<string, string>)[row.status] }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="支付状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag
            :type="(PaymentStatusColorMap as Record<string, string>)[row.paymentStatus]"
            size="small"
          >
            {{ (PaymentStatusMap as Record<string, string>)[row.paymentStatus] }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="下单时间" width="170">
        <template #default="{ row }">
          {{ formatDateTime(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" :fixed="isMobile ? false : 'right'">
        <template #default="{ row }">
          <div class="admin-table-actions">
            <el-button type="primary" link size="small" @click="handleViewDetail(row.id)">详情</el-button>
            <el-button
              v-if="row.status === 'confirmed' && row.paymentStatus === 'paid'"
              type="success"
              link
              size="small"
              @click="handleShip(row)"
            >
              发货
            </el-button>
            <el-button
              v-if="row.paymentStatus === 'paid' && row.status !== 'cancelled'"
              type="warning"
              link
              size="small"
              @click="handleRefund(row)"
            >
              退款
            </el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrap">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        background
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>
    </el-card>
  </div>
</template>

<style scoped>
.items-summary {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}
</style>
