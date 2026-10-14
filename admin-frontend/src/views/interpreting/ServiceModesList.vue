<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { modesApi } from '@/api/modes'
import type { ServiceMode } from '@/types/interpreting'
import { readContentValue } from '@/types/common'
import { useListPage } from '@/composables/useListPage'
import { useIsMobile } from '@/composables/useIsMobile'

const isMobile = useIsMobile()

const router = useRouter()

// ─── 列表数据 (useListPage) ─────────────
const {
  loading, list, total,
  fetchList,
} = useListPage<ServiceMode>({
  fetchApi: (params) => modesApi.getModes(params as any),
  deleteApi: (id) => modesApi.deleteMode(id),
  defaultFilters: {},
  defaultPageSize: 200,
  transform: (items: ServiceMode[]) => [...items].sort((a, b) => a.sortOrder - b.sortOrder),
})

function handleCreate() {
  router.push('/admin/interpreting/modes/create')
}

function handleEdit(id: string) {
  router.push(`/admin/interpreting/modes/${id}/edit`)
}

async function handleDelete(row: ServiceMode) {
  const title = readContentValue(row.title as any) || '该模式'
  try {
    await ElMessageBox.confirm(
      `确定删除模式「${title}」?该操作不可恢复。`,
      '删除确认',
      { type: 'warning' },
    )
    await modesApi.deleteMode(row.id)
    ElMessage.success(`模式「${title}」已删除`)
    fetchList()
  } catch (err: any) {
    if (err?.response) ElMessage.error(err.response.data?.message || '删除失败')
  }
}

async function handleMoveUp(index: number) {
  if (index === 0) return
  const a = list.value[index]
  const b = list.value[index - 1]
  const tmp = a.sortOrder
  try {
    await modesApi.updateSort(a.id, b.sortOrder)
    await modesApi.updateSort(b.id, tmp)
    ElMessage.success('排序已更新')
    fetchList()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '排序更新失败')
  }
}

async function handleMoveDown(index: number) {
  if (index === list.value.length - 1) return
  const a = list.value[index]
  const b = list.value[index + 1]
  const tmp = a.sortOrder
  try {
    await modesApi.updateSort(a.id, b.sortOrder)
    await modesApi.updateSort(b.id, tmp)
    ElMessage.success('排序已更新')
    fetchList()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '排序更新失败')
  }
}

function getAccentLabel(accent: string) {
  return accent === 'light' ? '浅色' : '深色'
}
</script>

<template>
  <div>
    <div class="page-header">
      <h2>服务模式管理</h2>
      <el-button type="primary" @click="handleCreate">新增模式</el-button>
    </div>

    <el-card shadow="never" class="table-card">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column label="排序" width="80" align="center">
          <template #default="{ row, $index }">
            <div class="sort-actions">
              <el-button size="small" text :disabled="$index === 0" @click="handleMoveUp($index)">↑</el-button>
              <span class="sort-num">{{ row.sortOrder }}</span>
              <el-button size="small" text :disabled="$index === list.length - 1" @click="handleMoveDown($index)">↓</el-button>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="模式名称" min-width="180">
          <template #default="{ row }">
            <div>{{ readContentValue(row.title) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="价格" width="180">
          <template #default="{ row }">
            <div>{{ readContentValue(row.price) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="推荐" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.featured" type="danger" size="small">推荐</el-tag>
            <span v-else style="color: #c0c4cc">—</span>
          </template>
        </el-table-column>
        <el-table-column label="色调" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.accent === 'dark' ? '' : 'info'" size="small" effect="plain">
              {{ getAccentLabel(row.accent) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="适用场景" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ readContentValue(row.bestFor) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="240" :fixed="isMobile ? false : 'right'">
          <template #default="{ row, $index }">
            <div class="admin-table-actions">
              <el-button type="primary" link size="small" @click="handleEdit(row.id)">编辑</el-button>
              <el-button type="primary" link size="small" @click="handleMoveUp($index)" :disabled="$index === 0">上移</el-button>
              <el-button type="primary" link size="small" @click="handleMoveDown($index)" :disabled="$index === list.length - 1">下移</el-button>
              <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap" v-if="total > 0">
        <span class="footer-info">共 {{ total }} 条服务模式</span>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.sort-actions { display: flex; align-items: center; gap: 4px; justify-content: center; }
.sort-num { min-width: 20px; text-align: center; font-weight: 500; }
.footer-info { font-size: 12px; color: var(--lt-text-secondary, #909399); }
</style>
