<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { productsApi } from '@/api/products'
import { collectionsApi } from '@/api/collections'
import type { Product } from '@/types/product'
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
} = useListPage<Product>({
  fetchApi: (params) => productsApi.getProducts(params as any),
  deleteApi: (id) => productsApi.deleteProduct(id),
  defaultFilters: { keyword: '', status: '', collectionId: '' },
})

// ─── 系列选项 ──────────────────────────
const collectionOptions = ref<{ id: string; title: string }[]>([])

async function fetchCollections() {
  try {
    const res = await collectionsApi.getCollections({ page: 1, pageSize: 100 } as any)
    collectionOptions.value = (res.data.data.data || []).map((c: any) => ({
      id: c.id,
      title: readContentValue(c.title) || c.slug || c.id,
    }))
  } catch {
    /* keep silent */
  }
}

onMounted(fetchCollections)

// ─── 操作 ──────────────────────────────
function handleCreate() {
  router.push('/admin/shop/products/create')
}

function handleEdit(id: string) {
  router.push(`/admin/shop/products/${id}/edit`)
}

async function handleToggleStatus(row: Product) {
  const newStatus = !row.published
  const label = newStatus ? '上架' : '下架'
  const productName = readContentValue(row.name as any) || '该商品'
  try {
    await ElMessageBox.confirm(`确定${label}「${productName}」?`, `${label}确认`, {
      type: newStatus ? 'success' : 'warning',
    })
    await productsApi.updateProduct(row.id, { published: newStatus })
    row.published = newStatus
    ElMessage.success(`${productName} 已${label}`)
  } catch (err: any) {
    if (err?.response) ElMessage.error(err.response.data?.message || '操作失败')
  }
}
</script>

<template>
  <div>
    <div class="page-header">
      <h2>商品管理</h2>
      <el-button type="primary" @click="handleCreate">新增商品</el-button>
    </div>

    <ListToolbar
      v-model="filters.keyword"
      search-placeholder="搜索商品名称 / slug"
      @search="handleSearch"
      @reset="handleReset"
    >
      <el-select
        v-model="filters.collectionId"
        placeholder="所属系列"
        clearable
        style="width: 160px"
        @change="handleSearch"
      >
        <el-option
          v-for="col in collectionOptions"
          :key="col.id"
          :label="col.title"
          :value="col.id"
        />
      </el-select>
      <el-select
        v-model="filters.status"
        placeholder="状态"
        clearable
        style="width: 120px"
        @change="handleSearch"
      >
        <el-option label="在售" value="on_sale" />
        <el-option label="下架" value="off_shelf" />
      </el-select>
    </ListToolbar>

    <el-card shadow="never" class="table-card">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column label="主图" width="80">
          <template #default="{ row }">
            <el-image
              v-if="row.image"
              :src="resolveMediaUrl(row.image)"
              class="admin-list-thumb"
              fit="cover"
            />
          </template>
        </el-table-column>
        <el-table-column label="商品名称" min-width="180">
          <template #default="{ row }">
            <div>{{ readContentValue(row.name) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="所属系列" width="160">
          <template #default="{ row }">
            {{ readContentValue(row.collectionName) || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="价格" width="120" align="right">
          <template #default="{ row }">
            <span style="font-weight: 600">{{ row.currency }} {{ row.price }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="stock" label="库存" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.stock <= 5 ? 'danger' : row.stock <= 20 ? 'warning' : ''" size="small">
              {{ row.stock }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.published ? 'success' : 'info'" size="small">
              {{ row.published ? '在售' : '下架' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" :fixed="isMobile ? false : 'right'">
          <template #default="{ row }">
            <div class="admin-table-actions">
              <el-button type="primary" link size="small" @click="handleEdit(row.id)">编辑</el-button>
              <el-button
                :type="row.published ? 'warning' : 'success'"
                link
                size="small"
                @click="handleToggleStatus(row)"
              >
                {{ row.published ? '下架' : '上架' }}
              </el-button>
              <el-button
                type="danger"
                link
                size="small"
                @click="handleDelete(row.id, readContentValue(row.name as any))"
              >
                删除
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
