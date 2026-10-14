<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  getUsers,
  banUser,
  unbanUser,
  setUserStaffAccess,
} from '@/api/users'
import type { ManagedUser, UserStatus } from '@/types/user'
import { UserStatusMap, UserStatusColorMap, LocaleMap } from '@/types/user'
import { ElMessage, ElMessageBox } from 'element-plus'
import { formatDate } from '@/utils/format'
import { useListPage } from '@/composables/useListPage'
import { ListToolbar } from '@/components/list'
import { useAuthStore } from '@/store/auth'
import { useIsMobile } from '@/composables/useIsMobile'

const isMobile = useIsMobile()

const router = useRouter()
const authStore = useAuthStore()
const isAdmin = computed(() => authStore.currentUser?.role === 'admin')

/** 该账号是否同时拥有后台权限（管理员账号与用户账号共存）。 */
function staffRoleOf(user: ManagedUser): 'admin' | 'editor' | null {
  const roles = user.roles ?? (user.role ? [user.role] : [])
  if (roles.includes('admin')) return 'admin'
  if (roles.includes('editor')) return 'editor'
  return null
}

function staffRoleLabel(user: ManagedUser): string {
  const role = staffRoleOf(user)
  if (role === 'admin') return '管理员'
  if (role === 'editor') return '内容编辑'
  return ''
}

// ─── 列表数据 (useListPage) ─────────────
const {
  loading, list: users, total, page, pageSize,
  filters,
  handlePageChange, handleSizeChange,
  handleSearch, handleReset,
  fetchList,
} = useListPage<ManagedUser>({
  fetchApi: (params) => getUsers(params as any) as any,
  defaultFilters: { keyword: '', status: '' as UserStatus | '' },
})

// ─── 自定义操作 ──────────────────────────
function handleViewDetail(user: ManagedUser) {
  router.push(`/admin/users/${user.id}`)
}

async function handleBan(user: ManagedUser) {
  try {
    await ElMessageBox.confirm(
      `确定要封禁用户「${user.name}」吗?封禁后该用户将无法登录和使用服务。`,
      '封禁确认',
      { confirmButtonText: '确定封禁', cancelButtonText: '取消', type: 'warning' }
    )
    await banUser(user.id)
    ElMessage.success(`已封禁用户「${user.name}」`)
    fetchList()
  } catch (err: any) {
    if (err?.response) ElMessage.error(err.response.data?.message || '封禁失败')
  }
}

async function handleUnban(user: ManagedUser) {
  try {
    await ElMessageBox.confirm(`确定解封用户「${user.name}」?`, '解封确认', { type: 'success' })
    await unbanUser(user.id)
    ElMessage.success(`已解封用户「${user.name}」`)
    fetchList()
  } catch (err: any) {
    if (err?.response) ElMessage.error(err.response.data?.message || '解封失败')
  }
}

/**
 * 授予/移除后台权限。账号本身不会被删除：移除后它仍然是用户管理里的旅行者，
 * 订单、收藏与预约记录都保留。
 */
async function handleGrantStaffAccess(user: ManagedUser, role: 'admin' | 'editor') {
  const label = role === 'admin' ? '管理员' : '内容编辑'
  try {
    await ElMessageBox.confirm(
      `确定授予用户「${user.name}」${label}后台权限?该账号将同时是旅行者与${label}，登录后台时使用同一邮箱和密码。`,
      '授予后台权限',
      { confirmButtonText: '确定授予', cancelButtonText: '取消', type: 'warning' },
    )
    await setUserStaffAccess(user.id, role)
    ElMessage.success(`已授予「${user.name}」${label}权限`)
    fetchList()
  } catch (err: any) {
    if (err === 'cancel' || err?.toString?.().includes('cancel')) return
    if (err?.response) ElMessage.error(err.response.data?.message || '授予失败')
  }
}

async function handleRevokeStaffAccess(user: ManagedUser) {
  try {
    await ElMessageBox.confirm(
      `确定移除用户「${user.name}」的后台权限?该账号仍是旅行者，订单、收藏与预约记录都会保留。`,
      '移除后台权限',
      { confirmButtonText: '确定移除', cancelButtonText: '取消', type: 'warning' },
    )
    await setUserStaffAccess(user.id, 'none')
    ElMessage.success(`已移除「${user.name}」的后台权限`)
    fetchList()
  } catch (err: any) {
    if (err === 'cancel' || err?.toString?.().includes('cancel')) return
    if (err?.response) ElMessage.error(err.response.data?.message || '移除失败')
  }
}
</script>

<template>
  <div class="users-page">
    <div class="page-header">
      <div class="page-heading-copy">
        <h2>用户管理</h2>
        <span class="page-desc">管理系统注册用户，查看用户详情，进行封禁/解封操作；也可为某个用户授予或移除后台权限，该账号将同时保留旅行者身份</span>
      </div>
    </div>

    <!-- 筛选栏 -->
    <ListToolbar
      v-model="filters.keyword"
      search-placeholder="搜索用户名 / 邮箱"
      @search="handleSearch"
      @reset="handleReset"
    >
      <el-select
        v-model="filters.status"
        placeholder="用户状态"
        clearable
        style="width: 140px"
        @change="handleSearch"
      >
        <el-option label="全部" value="" />
        <el-option label="正常" value="active" />
        <el-option label="已封禁" value="banned" />
      </el-select>
    </ListToolbar>

    <!-- 用户表格 -->
    <el-card shadow="never" class="table-card">
      <el-table :data="users" v-loading="loading" stripe style="width: 100%">
        <el-table-column label="用户" min-width="200">
          <template #default="{ row }">
            <div class="user-cell">
              <el-avatar :src="row.avatar" :size="40" />
              <div class="user-info">
                <span class="user-name">{{ row.name }}</span>
                <span class="user-email">{{ row.email }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="locale" label="语言" width="90" align="center">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ LocaleMap[row.locale] || row.locale }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="注册时间" width="130" align="center">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column prop="bookingsCount" label="预约次数" width="90" align="center" />
        <el-table-column prop="ordersCount" label="订单次数" width="90" align="center" />
        <el-table-column prop="status" label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="(UserStatusColorMap as Record<string, string>)[row.status]" size="small">
              {{ (UserStatusMap as Record<string, string>)[row.status] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="后台权限" width="120" align="center">
          <template #default="{ row }">
            <el-tag v-if="staffRoleOf(row)" type="warning" size="small" effect="plain">
              {{ staffRoleLabel(row) }}
            </el-tag>
            <span v-else class="staff-none">无</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" align="center" :fixed="isMobile ? false : 'right'">
          <template #default="{ row }">
            <div class="admin-table-actions">
              <el-button size="small" type="primary" link @click="handleViewDetail(row)">
                详情
              </el-button>
              <template v-if="isAdmin">
                <el-dropdown
                  v-if="staffRoleOf(row)"
                  trigger="click"
                  @command="() => handleRevokeStaffAccess(row)"
                >
                  <el-button size="small" type="warning" link>后台权限</el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item>移除后台权限</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
                <el-dropdown v-else trigger="click" @command="(cmd: 'admin' | 'editor') => handleGrantStaffAccess(row, cmd)">
                  <el-button size="small" type="warning" link>授予后台权限</el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="admin">授予管理员</el-dropdown-item>
                      <el-dropdown-item command="editor">授予内容编辑</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </template>
              <template v-if="row.status === 'active'">
                <el-button size="small" type="danger" link @click="handleBan(row)">封禁</el-button>
              </template>
              <template v-else>
                <el-button size="small" type="success" link @click="handleUnban(row)">
                  解封
                </el-button>
              </template>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
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
.users-page {
  padding: 0;
}

.users-page :deep(.admin-table-actions) {
  justify-content: center;
}

.page-desc {
  font-size: 13px;
  color: var(--lt-text-secondary, #909399);
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-info {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--lt-text-primary, #303133);
}

.user-email {
  font-size: 12px;
  color: var(--lt-text-secondary, #909399);
  margin-top: 2px;
}

.staff-none {
  font-size: 12px;
  color: var(--lt-text-secondary, #909399);
}
</style>
