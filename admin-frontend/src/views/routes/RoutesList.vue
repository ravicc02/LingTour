<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus, Edit, Delete } from '@element-plus/icons-vue'
import { routesApi } from '@/api/routes'
import type { Route } from '@/types/route'
import { readContentValue } from '@/types/common'
import { formatRouteTagLabel, normalizeRouteTag } from '@/constants/guangdongRegions'
import { useListPage } from '@/composables/useListPage'
import { ListToolbar } from '@/components/list'
import { resolveMediaUrl } from '@/utils/media'
import { useIsMobile } from '@/composables/useIsMobile'

const isMobile = useIsMobile()

const router = useRouter()

// ─── 文化标签映射 ──────────────────────────
const cultureTagMap: Record<string, { label: string; color: string }> = {
  'Bay Area': { label: formatRouteTagLabel('Bay Area'), color: 'var(--lt-route-bay)' },
  Chaoshan: { label: formatRouteTagLabel('Chaoshan'), color: 'var(--lt-route-chaoshan)' },
  Hakka: { label: formatRouteTagLabel('Hakka'), color: 'var(--lt-route-hakka)' },
  Coastal: { label: formatRouteTagLabel('Coastal'), color: 'var(--lt-route-coastal)' },
  Mountain: { label: formatRouteTagLabel('Mountain'), color: 'var(--lt-route-mountain)' },
}

function getCultureTagInfo(tag: string) {
  const normalizedTag = normalizeRouteTag(tag)
  return cultureTagMap[normalizedTag] || { label: normalizedTag, color: 'var(--lt-info)' }
}

// ─── 列表数据 (useListPage) ─────────────
const {
  loading, list, total, page, pageSize,
  filters,
  handlePageChange, handleSizeChange,
  handleSearch, handleReset,
  handleDelete,
} = useListPage<Route>({
  fetchApi: (params) => routesApi.getRoutes(params as any),
  deleteApi: (id) => routesApi.deleteRoute(id),
  defaultFilters: { keyword: '', status: '', cityName: '' },
})

// ─── 城市选项（从列表中提取） ────────────
const cityOptions = computed(() => {
  const cities = new Set(list.value.map((r) => r.cityName).filter(Boolean))
  return Array.from(cities).sort()
})

// ─── 操作 ──────────────────────────────
function handleCreate() {
  router.push('/admin/routes/create')
}

function handleEdit(id: string) {
  router.push(`/admin/routes/${id}/edit`)
}

async function handleToggleStatus(routeItem: Route) {
  try {
    if (routeItem.published) {
      await routesApi.unpublishRoute(routeItem.id)
      routeItem.published = false
      ElMessage.success('已下架')
    } else {
      await routesApi.publishRoute(routeItem.id)
      routeItem.published = true
      ElMessage.success('已发布')
    }
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '状态更新失败')
  }
}
</script>

<template>
  <div class="routes-page">
    <div class="page-header">
      <h2>路线管理</h2>
      <el-button type="primary" :icon="Plus" @click="handleCreate">新增路线</el-button>
    </div>

    <ListToolbar
      v-model="filters.keyword"
      search-placeholder="搜索标题/Slug..."
      @search="handleSearch"
      @reset="handleReset"
    >
      <el-select
        v-model="filters.status"
        placeholder="状态筛选"
        clearable
        style="width: 120px"
        @change="handleSearch"
      >
        <el-option label="全部" value="" />
        <el-option label="草稿" value="draft" />
        <el-option label="已发布" value="published" />
        <el-option label="已下架" value="archived" />
      </el-select>
      <el-select
        v-model="filters.cityName"
        placeholder="城市筛选"
        clearable
        style="width: 140px"
        @change="handleSearch"
      >
        <el-option
          v-for="city in cityOptions"
          :key="city"
          :label="city"
          :value="city"
        />
      </el-select>
    </ListToolbar>

    <el-card shadow="never" class="table-card">
      <el-table
        v-loading="loading"
        :data="list"
        stripe
        style="width: 100%"
        row-key="id"
      >
        <el-table-column label="封面" width="80">
          <template #default="{ row }">
            <el-image
              :src="resolveMediaUrl(row.coverImage)"
              fit="cover"
              class="admin-list-thumb"
              :preview-src-list="resolveMediaUrl(row.coverImage) ? [resolveMediaUrl(row.coverImage)] : []"
              preview-teleported
            />
          </template>
        </el-table-column>

        <el-table-column label="标题" min-width="180">
          <template #default="{ row }">
            <div>
              <div class="route-title">{{ readContentValue(row.title) }}</div>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="slug" label="Slug" width="130" />

        <el-table-column label="文化标签" width="100">
          <template #default="{ row }">
            <el-tag
              :color="getCultureTagInfo(row.cultureTag).color"
              effect="dark"
              size="small"
            >
              {{ getCultureTagInfo(row.cultureTag).label }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="cityName" label="城市" width="100">
          <template #default="{ row }">
            {{ row.cityName }}
          </template>
        </el-table-column>

        <el-table-column prop="duration" label="时长" width="90">
          <template #default="{ row }">
            {{ row.duration }}
          </template>
        </el-table-column>

        <el-table-column label="站点数" width="80" align="center">
          <template #default="{ row }">
            <el-tag round size="small">{{ row.stops?.length || 0 }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column label="价格" width="90">
          <template #default="{ row }">
            ¥{{ row.price || 0 }}
          </template>
        </el-table-column>

        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.published ? 'success' : 'info'" size="small">
              {{ row.published ? '已发布' : '草稿' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="200" :fixed="isMobile ? false : 'right'">
          <template #default="{ row }">
            <div class="admin-table-actions">
              <el-button
                type="primary"
                link
                :icon="Edit"
                size="small"
                @click="handleEdit(row.id)"
              >
                编辑
              </el-button>
              <el-button
                link
                :type="row.published ? 'warning' : 'success'"
                size="small"
                @click="handleToggleStatus(row)"
              >
                {{ row.published ? '下架' : '发布' }}
              </el-button>
              <el-button
                type="danger"
                link
                :icon="Delete"
                size="small"
                @click="handleDelete(row.id, readContentValue(row.title as any))"
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

<style scoped>
.routes-page {
  padding: 0;
}

.route-title {
  font-weight: 600;
  color: var(--lt-text-primary, #303133);
}

.route-title-en {
  font-size: 12px;
  color: var(--lt-text-secondary);
}
</style>
