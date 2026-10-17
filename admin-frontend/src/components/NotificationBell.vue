<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { Bell } from '@element-plus/icons-vue'
import { useNotificationStore } from '@/store/notification'
import { formatDateTime } from '@/utils/format'
import { NOTIFICATION_TYPE_LABELS } from '@/types/notification'

const router = useRouter()
const notifStore = useNotificationStore()

onMounted(() => {
  notifStore.startPolling(30000)
  notifStore.fetchNotifications({ page: 1, pageSize: 5 })
})

onBeforeUnmount(() => {
  notifStore.stopPolling()
})

function handleClick(notif: any) {
  notifStore.markAsRead(notif.id)
  if (notif.link) {
    router.push(notif.link)
  } else if (notif.resourceType && notif.resourceId) {
    const routeMap: Record<string, string> = {
      order: '/admin/orders/',
      booking: '/admin/interpreting/bookings',
      community_post: '/admin/community/',
      user: '/admin/users/',
    }
    const base = routeMap[notif.resourceType]
    if (base) {
      router.push(base + (notif.resourceId || ''))
    }
  }
}

function handleViewAll() {
  router.push('/admin/system/notifications')
}

function handleMarkAllRead() {
  notifStore.markAllAsRead()
}
</script>

<template>
  <el-popover placement="bottom-end" :width="360" trigger="click">
    <template #reference>
      <el-badge :value="notifStore.unreadCount" :hidden="!notifStore.hasUnread" :max="99">
        <button
          type="button"
          class="notification-bell"
          :aria-label="notifStore.hasUnread ? `打开通知，${notifStore.unreadCount} 条未读` : '打开通知'"
        >
          <el-icon :size="20"><Bell /></el-icon>
        </button>
      </el-badge>
    </template>

    <div class="notif-panel">
      <div class="notif-header">
        <span class="notif-title">通知</span>
        <el-button
          v-if="notifStore.hasUnread"
          type="primary"
          link
          size="small"
          @click="handleMarkAllRead"
        >
          全部已读
        </el-button>
      </div>

      <div class="notif-list" v-if="notifStore.notifications.length > 0">
        <button
          v-for="notif in notifStore.notifications"
          :key="notif.id"
          type="button"
          :class="['notif-item', { unread: !notif.read }]"
          @click="handleClick(notif)"
        >
          <div class="notif-item-header">
            <el-tag size="small" :type="notif.type === 'order' ? 'primary' : notif.type === 'booking' ? 'success' : notif.type === 'review' ? 'warning' : 'info'">
              {{ NOTIFICATION_TYPE_LABELS[notif.type] || notif.type }}
            </el-tag>
            <span class="notif-time">{{ formatDateTime(notif.createdAt) }}</span>
          </div>
          <p class="notif-body">{{ notif.title || notif.body }}</p>
        </button>
      </div>
      <div v-else class="notif-empty">暂无通知</div>

      <div class="notif-footer">
        <el-button type="primary" link @click="handleViewAll">查看全部</el-button>
      </div>
    </div>
  </el-popover>
</template>

<style scoped>
.notification-bell {
  display: inline-flex;
  width: var(--admin-header-control-size);
  height: var(--admin-header-control-size);
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: var(--lt-radius-md);
  background: transparent;
  cursor: pointer;
  color: var(--lt-text-regular);
  transition: color 0.2s, background-color 0.2s;
}

.notification-bell:hover {
  color: var(--lt-primary);
  background: var(--lt-bg-hover);
}

.notif-panel {
  margin: -12px;
}

.notif-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--lt-border-light);
}

.notif-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--lt-text-primary);
}

.notif-list {
  max-height: 320px;
  overflow-y: auto;
}

.notif-item {
  display: block;
  width: 100%;
  padding: 10px 16px;
  cursor: pointer;
  border: 0;
  border-bottom: 1px solid var(--lt-border-lighter);
  background: var(--lt-bg-card);
  text-align: left;
  transition: background-color 0.15s;
}

.notif-item:hover {
  background: var(--lt-bg-hover);
}

.notif-item.unread {
  background: var(--lt-primary-soft);
}

.notif-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.notif-time {
  font-size: 11px;
  color: var(--lt-text-placeholder);
}

.notif-body {
  font-size: 13px;
  color: var(--lt-text-regular);
  margin: 0;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notif-empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--lt-text-placeholder);
  font-size: 13px;
}

.notif-footer {
  padding: 8px 16px;
  text-align: center;
  border-top: 1px solid var(--lt-border-light);
}
</style>
