<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { useTheme } from '@/composables/useTheme'
import ErrorBoundary from '@/components/ErrorBoundary.vue'
import AppBreadcrumb from '@/components/AppBreadcrumb.vue'
import CommandPalette from '@/components/CommandPalette.vue'
import OnboardingTour from '@/components/OnboardingTour.vue'
import NotificationBell from '@/components/NotificationBell.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { getAdminOnboardingStorageKey } from '@/constants/onboarding'
import { ADMIN_BREAKPOINTS } from '@/composables/useIsMobile'
import { animateRouteEnter, animateRouteLeave } from '@/utils/motion'
import {
  DataAnalysis,
  MapLocation,
  Guide,
  Collection,
  Goods,
  Document,
  SetUp,
  UserFilled,
  Calendar,
  ChatLineSquare,
  Present,
  ChatDotSquare,
  HomeFilled,
  Avatar,
  Setting,
  WarningFilled,
  SwitchButton,
  Expand,
  Fold,
  Picture,
  Search,
  Bell,
  List,
  User,
  QuestionFilled,
  Message,
} from '@element-plus/icons-vue'
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
useTheme()

const isCollapse = ref(false)
const isMobile = ref(false)
const mobileMenuOpen = ref(false)
const onboardingOpen = ref(false)
let onboardingTimer: number | undefined
const onboardingStorageKey = computed(() =>
  getAdminOnboardingStorageKey(authStore.currentUser?.id),
)
const currentPageTitle = computed(
  () => (route.meta.title as string) || '工作台',
)

function hasCompletedOnboarding(storageKey: string) {
  if (!storageKey) return true
  try {
    return localStorage.getItem(storageKey) === 'done'
  } catch {
    return false
  }
}

function openOnboarding() {
  window.clearTimeout(onboardingTimer)
  onboardingOpen.value = true
}

watch(
  () => authStore.currentUser?.id,
  (staffId) => {
    window.clearTimeout(onboardingTimer)
    onboardingOpen.value = false
    const storageKey = getAdminOnboardingStorageKey(staffId)
    if (!storageKey || hasCompletedOnboarding(storageKey)) return
    onboardingTimer = window.setTimeout(() => {
      if (
        authStore.currentUser?.id === staffId &&
        !hasCompletedOnboarding(storageKey)
      ) {
        onboardingOpen.value = true
      }
    }, 450)
  },
  { immediate: true },
)

// Responsive detection
function checkMobile() {
  isMobile.value = window.innerWidth <= ADMIN_BREAKPOINTS.md
  if (!isMobile.value) {
    mobileMenuOpen.value = false
  }
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.clearTimeout(onboardingTimer)
  window.removeEventListener('resize', checkMobile)
})

function toggleSidebar() {
  if (isMobile.value) {
    mobileMenuOpen.value = !mobileMenuOpen.value
  } else {
    isCollapse.value = !isCollapse.value
  }
}

function closeMobileMenu() {
  mobileMenuOpen.value = false
}

function handleLogout() {
  authStore.logout()
}

// 菜单分组配置
interface MenuItem {
  path: string
  title: string
  icon: any
  roles?: string[] // 为空表示所有角色可见
}

interface MenuGroup {
  title: string
  items: MenuItem[]
}

const menuGroups: MenuGroup[] = [
  {
    title: '概览',
    items: [{ path: '/admin/dashboard', title: '运营概览', icon: DataAnalysis }],
  },
  {
    title: '内容管理',
    items: [
      { path: '/admin/cities', title: '城市', icon: MapLocation },
      { path: '/admin/routes', title: '路线', icon: Guide },
    ],
  },
  {
    title: '商城管理',
    items: [
      { path: '/admin/shop/collections', title: '系列', icon: Collection },
      { path: '/admin/shop/products', title: '商品', icon: Goods },
      { path: '/admin/orders', title: '订单', icon: Document },
    ],
  },
  {
    title: '口译服务',
    items: [
      { path: '/admin/interpreting/modes', title: '服务模式', icon: SetUp },
      {
        path: '/admin/interpreting/profiles',
        title: '口译员',
        icon: UserFilled,
      },
      { path: '/admin/interpreting/bookings', title: '预约', icon: Calendar },
      { path: '/admin/interpreting/faqs', title: 'FAQ', icon: ChatLineSquare },
    ],
  },
  {
    title: '运营管理',
    items: [
      { path: '/admin/events', title: '活动', icon: Present },
      { path: '/admin/community', title: '社区帖子', icon: ChatDotSquare },
      { path: '/admin/community-briefs', title: '发帖引导', icon: ChatLineSquare },
      { path: '/admin/home', title: '首页配置', icon: HomeFilled },
      {
        path: '/admin/operations/audit',
        title: '数据体检',
        icon: WarningFilled,
      },
      { path: '/admin/media', title: '媒体库', icon: Picture },
    ],
  },
  {
    title: '系统管理',
    items: [
      { path: '/admin/users', title: '用户', icon: Avatar, roles: ['admin'] },
      {
        path: '/admin/system/staff',
        title: '管理员账号',
        icon: User,
        roles: ['admin'],
      },
      {
        path: '/admin/system/audit-logs',
        title: '操作日志',
        icon: List,
        roles: ['admin'],
      },
      { path: '/admin/system/notifications', title: '通知中心', icon: Bell },
      {
        path: '/admin/email-settings',
        title: '邮箱设置',
        icon: Message,
        roles: ['admin'],
      },
      {
        path: '/admin/settings',
        title: '系统设置',
        icon: Setting,
        roles: ['admin'],
      },
    ],
  },
]

// 根据当前用户角色过滤菜单
const filteredMenuGroups = computed(() => {
  const role = authStore.currentUser?.role
  return menuGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.roles || (role && item.roles.includes(role)),
      ),
    }))
    .filter((group) => group.items.length > 0)
})

// 计算当前激活的菜单项 — 匹配最长前缀的菜单路径
const allMenuPaths = menuGroups.flatMap((g) => g.items.map((i) => i.path))
const activeMenu = computed(() => {
  const path = route.path
  if (allMenuPaths.includes(path)) return path
  let best = ''
  for (const mp of allMenuPaths) {
    if (path.startsWith(mp) && mp.length > best.length) {
      best = mp
    }
  }
  return best || path
})

const currentSectionTitle = computed(() => {
  const match = menuGroups.find((group) =>
    group.items.some((item) => item.path === activeMenu.value),
  )
  return match?.title || 'Culvoy 工作台'
})

function handleMenuSelect(path: string) {
  router.push(path)
  if (isMobile.value) {
    mobileMenuOpen.value = false
  }
}

// Command Palette
const showCommandPalette = ref(false)

useKeyboardShortcuts([
  {
    key: 'ctrl+k',
    handler: () => {
      showCommandPalette.value = !showCommandPalette.value
    },
  },
])

watch(() => route.fullPath, closeMobileMenu)
</script>

<template>
  <el-container class="admin-container">
    <!-- Mobile sidebar mask -->
    <div
      class="mobile-sidebar-mask"
      :class="{ visible: mobileMenuOpen }"
      @click="closeMobileMenu"
    />

    <!-- 左侧 Sidebar -->
    <el-aside
      :width="isMobile ? '288px' : isCollapse ? '84px' : '256px'"
      class="admin-aside"
      :class="{ 'mobile-open': mobileMenuOpen }"
    >
      <button
        type="button"
        class="logo-area"
        aria-label="返回管理后台首页"
        @click="router.push('/admin/dashboard')"
      >
        <span class="brand-mark" aria-hidden="true">LT</span>
        <span v-if="!isCollapse || isMobile" class="brand-copy">
          <strong>Culvoy</strong>
          <small>管理后台</small>
        </span>
      </button>

      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapse && !isMobile"
        background-color="var(--lt-bg-sidebar)"
        text-color="var(--lt-sidebar-text)"
        active-text-color="var(--lt-sidebar-active)"
        @select="handleMenuSelect"
      >
        <template v-for="group in filteredMenuGroups" :key="group.title">
          <el-menu-item-group
            :title="group.title"
            :data-tour="group.title === '内容管理' ? 'content-nav' : undefined"
          >
            <el-menu-item
              v-for="item in group.items"
              :key="item.path"
              :index="item.path"
              :aria-label="item.title"
            >
              <el-icon><component :is="item.icon" /></el-icon>
              <template #title>{{ item.title }}</template>
            </el-menu-item>
          </el-menu-item-group>
        </template>
      </el-menu>

      <div v-if="!isCollapse || isMobile" class="sidebar-footer">
        <span>线上内容与运营</span>
        <small>内容 · 商城 · 服务</small>
      </div>
    </el-aside>

    <!-- 右侧内容区 -->
    <el-container>
      <!-- 顶部 Header -->
      <el-header class="admin-header">
        <div class="header-left">
          <button
            type="button"
            class="header-icon-button collapse-btn"
            :aria-label="
              isMobile
                ? '打开导航菜单'
                : isCollapse
                  ? '展开导航菜单'
                  : '收起导航菜单'
            "
            :aria-expanded="isMobile ? mobileMenuOpen : !isCollapse"
            data-tour="nav-toggle"
            @click="toggleSidebar"
          >
            <el-icon>
              <Fold v-if="!isCollapse && !isMobile" />
              <Expand v-else />
            </el-icon>
          </button>
          <div class="header-context">
            <span>{{ currentSectionTitle }}</span>
            <strong>{{ currentPageTitle }}</strong>
          </div>
        </div>
        <div class="header-right">
          <el-tooltip content="搜索 (Ctrl+K)" placement="bottom">
            <button
              type="button"
              class="header-search-button"
              aria-label="打开搜索"
              @click="showCommandPalette = true"
            >
              <el-icon><Search /></el-icon>
              <span>搜索</span>
              <kbd>Ctrl K</kbd>
            </button>
          </el-tooltip>
          <el-tooltip content="重新查看新手引导" placement="bottom">
            <button
              type="button"
              class="header-icon-button"
              aria-label="重新查看新手引导"
              data-tour="help-menu"
              @click="openOnboarding"
            >
              <el-icon><QuestionFilled /></el-icon>
            </button>
          </el-tooltip>
          <div class="header-utility header-theme"><ThemeToggle /></div>
          <div class="header-utility"><NotificationBell /></div>
          <el-dropdown>
            <span class="user-info">
              <span class="user-avatar"
                ><el-icon><Avatar /></el-icon
              ></span>
              <span class="hide-on-mobile">{{
                authStore.currentUser?.name || '管理员'
              }}</span>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="handleLogout">
                  <el-icon><SwitchButton /></el-icon>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <!-- 主内容区 -->
      <el-main class="admin-main">
        <div class="admin-content-shell">
          <AppBreadcrumb />
          <ErrorBoundary>
            <router-view v-slot="{ Component }">
              <Transition
                :css="false"
                mode="out-in"
                @enter="animateRouteEnter"
                @leave="animateRouteLeave"
              >
                <component
                  :is="Component"
                  :key="route.fullPath"
                  class="admin-page-stage"
                />
              </Transition>
            </router-view>
          </ErrorBoundary>
        </div>
      </el-main>
    </el-container>

    <!-- Command Palette -->
    <CommandPalette v-model:visible="showCommandPalette" />
    <OnboardingTour
      v-model="onboardingOpen"
      :storage-key="onboardingStorageKey"
    />
  </el-container>
</template>

<style scoped>
.admin-container {
  height: 100dvh;
  min-width: 0;
}

.admin-aside {
  position: relative;
  display: flex;
  flex-direction: column;
  background-color: var(--lt-bg-sidebar);
  background-image:
    radial-gradient(
      circle at 12% 0%,
      rgba(111, 175, 157, 0.16),
      transparent 18rem
    ),
    linear-gradient(180deg, rgba(255, 255, 255, 0.025), transparent 32%);
  overflow-x: hidden;
  overflow-y: auto;
  border-right: 1px solid rgba(255, 255, 255, 0.055);
  transition:
    width 0.36s var(--lt-ease-out),
    transform 0.36s var(--lt-ease-out),
    background-color 0.3s;
}

.logo-area {
  width: 100%;
  min-height: 84px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  padding: 0 18px;
  cursor: pointer;
  border: 0;
  background: transparent;
  text-align: left;
}

.brand-mark {
  display: inline-flex;
  width: 46px;
  height: 46px;
  align-items: center;
  justify-content: center;
  flex: 0 0 46px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.08);
  color: #f3f7f4;
  font-size: 13px;
  font-weight: 750;
  letter-spacing: 0.08em;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.brand-copy {
  display: grid;
  min-width: 0;
  color: #f3f7f4;
  white-space: nowrap;
}

.brand-copy strong {
  font-size: 17px;
  font-weight: 680;
  letter-spacing: -0.02em;
}

.brand-copy small {
  margin-top: 3px;
  color: rgba(222, 233, 227, 0.55);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.admin-header {
  position: sticky;
  top: 0;
  z-index: 120;
  background-color: var(--lt-bg-header);
  backdrop-filter: blur(18px) saturate(140%);
  border-bottom: 1px solid var(--lt-border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--admin-shell-gutter);
  height: 72px;
  transition:
    background-color 0.3s,
    border-color 0.3s;
}

.header-left {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 14px;
}

.collapse-btn {
  font-size: 20px;
  color: var(--lt-text-secondary);
  transition: color 0.2s;
}

.collapse-btn:hover {
  color: var(--lt-primary);
}

.header-context {
  display: grid;
  min-width: 0;
}

.header-context span {
  margin-bottom: 2px;
  color: var(--lt-text-placeholder);
  font-size: 9px;
  font-weight: 750;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.header-context strong {
  overflow: hidden;
  color: var(--lt-text-primary);
  font-size: 15px;
  font-weight: 680;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-right {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 8px;
}

.editor-locale-switch {
  display: flex;
  align-items: center;
  gap: 8px;
}

.editor-locale-label {
  color: var(--lt-text-secondary);
  font-size: 12px;
  white-space: nowrap;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: var(--lt-text-regular);
  font-size: 14px;
}

.user-avatar {
  display: inline-flex;
  width: var(--admin-header-control-size);
  height: var(--admin-header-control-size);
  align-items: center;
  justify-content: center;
  border: 1px solid var(--lt-border-light);
  border-radius: 12px;
  background: var(--lt-bg-hover);
  color: var(--lt-primary);
}

.admin-main {
  background-color: var(--lt-bg-page);
  min-width: 0;
  min-height: calc(100dvh - 72px);
  overflow-y: auto;
  padding: var(--admin-shell-gutter);
  transition: background-color 0.3s;
}

.admin-content-shell {
  width: min(100%, var(--lt-content-max));
  min-width: 0;
  margin-inline: auto;
}

.header-search-button {
  display: inline-flex;
  min-height: var(--admin-header-control-size);
  align-items: center;
  gap: 8px;
  padding: 0 10px 0 12px;
  border: 1px solid var(--lt-border-light);
  border-radius: 12px;
  background: color-mix(in srgb, var(--lt-bg-hover) 70%, transparent);
  color: var(--lt-text-secondary);
  cursor: pointer;
  transition:
    border-color 180ms ease,
    background 180ms ease,
    color 180ms ease;
}

.header-search-button:hover {
  border-color: color-mix(
    in srgb,
    var(--lt-primary) 35%,
    var(--lt-border-color)
  );
  background: var(--lt-bg-hover);
  color: var(--lt-primary);
}

.header-search-button span {
  font-size: 12px;
}

.header-search-button kbd {
  padding: 3px 6px;
  border: 1px solid var(--lt-border-light);
  border-radius: 6px;
  background: var(--lt-bg-card);
  color: var(--lt-text-placeholder);
  font: 9px/1 var(--lt-font-sans);
}

.header-icon-button {
  display: inline-flex;
  width: var(--admin-header-control-size);
  height: var(--admin-header-control-size);
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  border-radius: var(--lt-radius-md);
  background: transparent;
  cursor: pointer;
}

.header-utility {
  display: inline-flex;
}

.header-icon-button:hover {
  background: var(--lt-bg-hover);
}

/* 覆盖 Element Plus 菜单样式 */
:deep(.el-menu) {
  flex: 1;
  border-right: none;
  background: transparent;
}

:deep(.el-menu-item-group__title) {
  height: auto;
  padding: 17px 20px 7px;
  color: rgba(219, 230, 224, 0.4);
  font-size: 9px;
  font-weight: 750;
  letter-spacing: 0.14em;
  line-height: 1.2;
}

:deep(.el-menu-item) {
  height: 48px;
  margin: 3px 10px;
  padding-inline: 13px !important;
  border-radius: 12px;
  color: var(--lt-sidebar-text);
  font-size: 13px;
  font-weight: 560;
  line-height: 48px;
}

:deep(.el-menu-item:hover) {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}

:deep(.el-menu-item.is-active) {
  background: rgba(111, 175, 157, 0.17);
  color: #fff;
  box-shadow: inset 0 0 0 1px rgba(137, 205, 185, 0.13);
}

:deep(.el-menu--collapse .el-menu-item) {
  justify-content: center;
  width: calc(100% - 24px);
  margin-inline: 12px;
  padding: 0 !important;
}

:deep(.el-menu--collapse) {
  width: 100%;
}

:deep(.el-menu--collapse .el-menu-item .el-icon) {
  margin: 0;
}

:deep(.el-menu--collapse .el-menu-item .el-menu-tooltip__trigger) {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  padding: 0 !important;
}

:deep(.el-menu--collapse .el-menu-item-group__title) {
  height: 10px;
  overflow: hidden;
  padding: 0;
  color: transparent;
}

.sidebar-footer {
  display: grid;
  gap: 3px;
  margin: 18px 18px 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  color: rgba(219, 230, 224, 0.58);
  font-size: 10px;
}

.sidebar-footer small {
  color: rgba(219, 230, 224, 0.32);
  font-size: 9px;
}

/* Mobile sidebar */
@media (max-width: 768px) {
  .admin-aside {
    position: fixed !important;
    z-index: 2000;
    height: 100vh;
    width: min(288px, 86vw) !important;
    transform: translateX(-100%);
    box-shadow: 24px 0 80px rgba(0, 0, 0, 0.24);
  }

  .admin-aside.mobile-open {
    transform: translateX(0);
  }
}

/* Mobile sidebar mask */
.mobile-sidebar-mask {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: color-mix(in srgb, var(--lt-bg-mask) 88%, transparent);
  backdrop-filter: blur(5px);
  z-index: 1999;
}

.mobile-sidebar-mask.visible {
  display: block;
}

/* Responsive utilities */
@media (max-width: 768px) {
  .hide-on-mobile {
    display: none !important;
  }

  .admin-header {
    height: 64px;
  }

  .admin-main {
    min-height: calc(100dvh - 64px);
  }

  .header-context {
    display: none;
  }

  .header-left,
  .header-right {
    gap: 5px;
  }

  .header-search-button {
    width: var(--admin-header-control-size);
    min-height: var(--admin-header-control-size);
    justify-content: center;
    padding: 0;
  }

  .header-search-button span,
  .header-search-button kbd,
  .editor-locale-label {
    display: none;
  }

  .editor-locale-switch :deep(.el-segmented) {
    --el-segmented-item-selected-bg-color: var(--lt-bg-card);
    padding: 2px;
  }

  .brand-copy {
    display: grid;
  }
}

@media (max-width: 480px) {
  .header-theme {
    display: none;
  }
}
</style>
