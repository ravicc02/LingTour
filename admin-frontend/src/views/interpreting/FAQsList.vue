<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { faqsApi } from '@/api/faqs'
import { FAQCategoryMap } from '@/types/interpreting'
import type { FAQ } from '@/types/interpreting'
import { readContentValue } from '@/types/common'
import { useListPage } from '@/composables/useListPage'
import { ListToolbar } from '@/components/list'
import { useIsMobile } from '@/composables/useIsMobile'

const isMobile = useIsMobile()

const router = useRouter()

// ─── 列表数据 (useListPage) ─────────────
const {
  loading, list, total, page,
  filters,
  fetchList,
  handleSearch: _handleSearch,
  handleReset,
} = useListPage<FAQ>({
  fetchApi: (params) => faqsApi.getFAQs(params as any),
  deleteApi: (id) => faqsApi.deleteFAQ(id),
  defaultFilters: { keyword: '', category: '' },
  defaultPageSize: 200,
  transform: (items: FAQ[]): FAQ[] => {
    const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder)
    const k = ((filters as any).keyword as string)?.trim().toLowerCase()
    if (!k) return sorted
    return sorted.filter(
      (it) =>
        readContentValue(it.question as any).toLowerCase().includes(k) ||
        readContentValue(it.answer as any).toLowerCase().includes(k),
    )
  },
})

// Client-side keyword filter: re-filter without API call
function handleSearch() {
  page.value = 1
  fetchList()
}

function handleCreate() {
  router.push('/admin/interpreting/faqs/create')
}

function handleEdit(id: string) {
  router.push(`/admin/interpreting/faqs/${id}/edit`)
}

async function handleDelete(row: FAQ) {
  const question = readContentValue(row.question as any) || '该FAQ'
  try {
    await ElMessageBox.confirm(
      `确定删除FAQ「${question}」?`,
      '删除确认',
      { type: 'warning' },
    )
    await faqsApi.deleteFAQ(row.id)
    ElMessage.success(`FAQ「${question}」已删除`)
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
    await faqsApi.updateSort(a.id, b.sortOrder)
    await faqsApi.updateSort(b.id, tmp)
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
    await faqsApi.updateSort(a.id, b.sortOrder)
    await faqsApi.updateSort(b.id, tmp)
    ElMessage.success('排序已更新')
    fetchList()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '排序更新失败')
  }
}
</script>

<template>
  <div>
    <div class="page-header">
      <h2>常见问题管理</h2>
      <el-button type="primary" @click="handleCreate">新增FAQ</el-button>
    </div>

    <ListToolbar
      v-model="filters.keyword"
      search-placeholder="搜索问题/答案"
      @search="handleSearch"
      @reset="handleReset"
    >
      <el-select
        v-model="filters.category"
        placeholder="分类筛选"
        clearable
        style="width: 160px"
        @change="handleSearch"
      >
        <el-option label="全部" value="" />
        <el-option label="口译服务" value="interpreting" />
        <el-option label="通用问题" value="general" />
        <el-option label="路线相关" value="routes" />
      </el-select>
    </ListToolbar>

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
        <el-table-column label="问题" min-width="280">
          <template #default="{ row }">
            <div class="qa-text">{{ readContentValue(row.question) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="答案" min-width="320" show-overflow-tooltip>
          <template #default="{ row }">
                <div class="qa-text">{{ readContentValue(row.answer) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="分类" width="120" align="center">
          <template #default="{ row }">
            <el-tag size="small">{{ (FAQCategoryMap as Record<string, string>)[row.category] }}</el-tag>
          </template>
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
        <span class="footer-info">共 {{ total }} 条 FAQ</span>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.sort-actions { display: flex; align-items: center; gap: 4px; justify-content: center; }
.sort-num { min-width: 20px; text-align: center; font-weight: 500; }
.qa-text { font-size: 14px; }
.qa-sub { font-size: 12px; color: var(--lt-text-secondary, #909399); margin-top: 2px; }
.footer-info { font-size: 12px; color: var(--lt-text-secondary, #909399); }
</style>
