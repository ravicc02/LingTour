<script setup lang="ts">
import { useRouter } from 'vue-router'
import { collectionsApi } from '@/api/collections'
import type { StoreCollection } from '@/types/collection'
import { readContentValue } from '@/types/common'
import { useListPage } from '@/composables/useListPage'
import { ListToolbar } from '@/components/list'
import { resolveMediaUrl } from '@/utils/media'
import { useIsMobile } from '@/composables/useIsMobile'

const isMobile = useIsMobile()

const router = useRouter()

// ─── 列表数据 (useListPage) ─────────────
const {
  loading, list, total, page, pageSize,
  filters,
  handlePageChange, handleSizeChange,
  handleSearch, handleReset,
  handleDelete,
} = useListPage<StoreCollection>({
  fetchApi: (params) => collectionsApi.getCollections(params as any),
  deleteApi: (id) => collectionsApi.deleteCollection(id),
  defaultFilters: { keyword: '' },
})

// ─── 自定义删除（带英文名称） ──────────
function handleDeleteCollection(row: StoreCollection) {
  const title = readContentValue(row.title as any) || '该系列'
  handleDelete(row.id, title)
}

// ─── 操作 ──────────────────────────────
function handleCreate() {
  router.push('/admin/shop/collections/create')
}

function handleEdit(id: string) {
  router.push(`/admin/shop/collections/${id}/edit`)
}
</script>

<template>
  <div>
    <div class="page-header">
      <h2>系列管理</h2>
      <el-button type="primary" @click="handleCreate">新增系列</el-button>
    </div>

    <ListToolbar
      v-model="filters.keyword"
      search-placeholder="搜索系列名称 / slug"
      @search="handleSearch"
      @reset="handleReset"
    />

    <el-card shadow="never" class="table-card">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column label="封面" width="80">
          <template #default="{ row }">
            <el-image
              v-if="row.image"
              :src="resolveMediaUrl(row.image)"
              class="admin-list-thumb"
              fit="cover"
            />
          </template>
        </el-table-column>
        <el-table-column label="系列名称" min-width="180">
          <template #default="{ row }">
            <div>{{ readContentValue(row.title) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="关联路线" width="160">
          <template #default="{ row }">
            {{ readContentValue(row.routeName) || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="productCount" label="商品数" width="80" align="center">
          <template #default="{ row }">
            <el-badge :value="row.productCount" type="primary" />
          </template>
        </el-table-column>
        <el-table-column prop="published" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.published ? 'success' : 'info'" size="small">
              {{ row.published ? '已发布' : '草稿' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" :fixed="isMobile ? false : 'right'">
          <template #default="{ row }">
            <div class="admin-table-actions">
              <el-button type="primary" link size="small" @click="handleEdit(row.id)">编辑</el-button>
              <el-button type="danger" link size="small" @click="handleDeleteCollection(row)">删除</el-button>
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
</style>
