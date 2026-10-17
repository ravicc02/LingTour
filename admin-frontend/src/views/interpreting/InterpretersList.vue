<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useListPage } from '@/composables/useListPage'
import { interpretersApi } from '@/api/interpreters'
import { InterpreterStatusMap, InterpreterStatusColorMap } from '@/types/interpreting'
import { readContentValue } from '@/types/common'
import type { Interpreter } from '@/types/interpreting'
import { resolveMediaUrl } from '@/utils/media'
import { useIsMobile } from '@/composables/useIsMobile'

const isMobile = useIsMobile()

const router = useRouter()

const {
  loading, list, total, page, pageSize,
  filters,
  fetchList,
  handlePageChange, handleSizeChange,
  handleSearch,
} = useListPage<Interpreter>({
  fetchApi: (params) => interpretersApi.getInterpreters(params as any),
  defaultFilters: { keyword: '', status: '' },
})

/** Resolve the English name for messages and avatar initials. */
function nameZh(row: Interpreter): string {
  return readContentValue(row.name) || '该口译员'
}

function handleCreate() {
  router.push('/admin/interpreting/profiles/create')
}

function handleEdit(id: string) {
  router.push(`/admin/interpreting/profiles/${id}/edit`)
}

async function handleDelete(row: Interpreter) {
  try {
    await ElMessageBox.confirm(
      `确定删除口译员「${nameZh(row)}」?该操作不可恢复。`,
      '删除确认',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    )
    await interpretersApi.deleteInterpreter(row.id)
    ElMessage.success(`口译员「${nameZh(row)}」已删除`)
    fetchList()
  } catch (err: any) {
    if (err?.response) ElMessage.error(err.response.data?.message || '删除失败')
  }
}

async function handleApprove(row: Interpreter) {
  try {
    await ElMessageBox.confirm(
      `确定审核通过「${nameZh(row)}」?通过后将变为已激活状态。`,
      '审核确认',
      { confirmButtonText: '通过', cancelButtonText: '取消', type: 'success' }
    )
    await interpretersApi.updateStatus(row.id, 'active')
    ElMessage.success(`${nameZh(row)} 审核通过,已激活`)
    fetchList()
  } catch { /* cancelled */ }
}

async function handleReject(row: Interpreter) {
  try {
    await ElMessageBox.confirm(
      `确定拒绝「${nameZh(row)}」的申请?拒绝后将变为已禁用状态。`,
      '拒绝确认',
      { confirmButtonText: '拒绝', cancelButtonText: '取消', type: 'warning' }
    )
    await interpretersApi.updateStatus(row.id, 'inactive')
    ElMessage.info(`${nameZh(row)} 已拒绝,状态变为已禁用`)
    fetchList()
  } catch { /* cancelled */ }
}

async function handleDisable(row: Interpreter) {
  try {
    await ElMessageBox.confirm(
      `确定禁用「${nameZh(row)}」?`,
      '禁用确认',
      { confirmButtonText: '禁用', cancelButtonText: '取消', type: 'warning' }
    )
    await interpretersApi.updateStatus(row.id, 'inactive')
    ElMessage.info(`${nameZh(row)} 已禁用`)
    fetchList()
  } catch { /* cancelled */ }
}

async function handleEnable(row: Interpreter) {
  try {
    await ElMessageBox.confirm(
      `确定启用「${nameZh(row)}」?`,
      '启用确认',
      { confirmButtonText: '启用', cancelButtonText: '取消', type: 'success' }
    )
    await interpretersApi.updateStatus(row.id, 'active')
    ElMessage.success(`${nameZh(row)} 已启用`)
    fetchList()
  } catch { /* cancelled */ }
}
</script>

<template>
  <div>
    <div class="page-header">
      <h2>口译员管理</h2>
      <el-button type="primary" @click="handleCreate">新增口译员</el-button>
    </div>

    <div class="search-bar">
      <el-input
        v-model="filters.keyword"
        placeholder="搜索姓名/语种"
        clearable
        style="width: 240px"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />
      <el-select v-model="filters.status" placeholder="状态筛选" clearable style="width: 160px" @change="handleSearch">
        <el-option label="全部" value="" />
        <el-option label="待审核" value="pending_review" />
        <el-option label="已激活" value="active" />
        <el-option label="已禁用" value="inactive" />
      </el-select>
      <el-button type="primary" @click="handleSearch">搜索</el-button>
    </div>

    <el-card shadow="never" class="table-card">
    <el-table :data="list" v-loading="loading" stripe empty-text="暂无口译员数据">
      <el-table-column label="头像" width="70">
        <template #default="{ row }">
          <el-avatar v-if="row.avatar" :src="resolveMediaUrl(row.avatar)" :size="40" />
          <el-avatar v-else :size="40">{{ nameZh(row).charAt(0) }}</el-avatar>
        </template>
      </el-table-column>
      <el-table-column label="姓名" width="140">
        <template #default="{ row }">
          <div>{{ readContentValue(row.name) }}</div>
        </template>
      </el-table-column>
      <el-table-column label="服务语种" width="200" show-overflow-tooltip>
        <template #default="{ row }">{{ readContentValue(row.language) }}</template>
      </el-table-column>
      <el-table-column label="专注领域" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          <div>{{ readContentValue(row.focus) }}</div>
        </template>
      </el-table-column>
      <el-table-column label="能力标签" min-width="200">
        <template #default="{ row }">
          <el-tag v-for="(h, i) in row.helps" :key="i" size="small" style="margin: 2px 2px">{{ readContentValue(h) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="服务城市" width="120" align="center">
        <template #default="{ row }">{{ readContentValue(row.city) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="(InterpreterStatusColorMap as Record<string, string>)[row.status]" size="small">
            {{ (InterpreterStatusMap as Record<string, string>)[row.status] }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="240" :fixed="isMobile ? false : 'right'">
        <template #default="{ row }">
          <div class="admin-table-actions">
            <el-button type="primary" link size="small" @click="handleEdit(row.id)">编辑</el-button>
            <template v-if="row.status === 'pending_review'">
              <el-button type="success" link size="small" @click="handleApprove(row)">通过</el-button>
              <el-button type="warning" link size="small" @click="handleReject(row)">拒绝</el-button>
            </template>
            <template v-if="row.status === 'active'">
              <el-button type="warning" link size="small" @click="handleDisable(row)">禁用</el-button>
            </template>
            <template v-if="row.status === 'inactive'">
              <el-button type="success" link size="small" @click="handleEnable(row)">启用</el-button>
            </template>
            <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrap">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
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
.search-bar { margin-bottom: 16px; }
</style>
