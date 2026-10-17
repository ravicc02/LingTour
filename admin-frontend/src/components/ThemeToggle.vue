<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'
import type { ThemeMode } from '@/composables/useTheme'
import { Moon, Sunny, Monitor } from '@element-plus/icons-vue'

const { themeMode, isDark, setTheme } = useTheme()

const themeOptions: { value: ThemeMode; label: string; icon: any }[] = [
  { value: 'light', label: '浅色', icon: Sunny },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
]

function handleCommand(mode: ThemeMode) {
  setTheme(mode)
}
</script>

<template>
  <el-dropdown trigger="click" @command="handleCommand">
    <button
      type="button"
      class="theme-toggle-btn"
      aria-label="切换后台主题"
      :title="isDark ? '切换主题（当前：深色）' : '切换主题（当前：浅色）'"
    >
      <el-icon>
        <Moon v-if="isDark" />
        <Sunny v-else />
      </el-icon>
    </button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item
          v-for="opt in themeOptions"
          :key="opt.value"
          :command="opt.value"
          :class="{ 'is-active': themeMode === opt.value }"
        >
          <el-icon><component :is="opt.icon" /></el-icon>
          <span>{{ opt.label }}</span>
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<style scoped>
.theme-toggle-btn {
  display: inline-flex;
  width: var(--admin-header-control-size);
  height: var(--admin-header-control-size);
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: var(--lt-radius-md);
  background: transparent;
  font-size: 18px;
  cursor: pointer;
  color: var(--lt-text-regular);
  transition: color 0.2s, background-color 0.2s;
}

.theme-toggle-btn:hover {
  color: var(--lt-primary);
  background: var(--lt-bg-hover);
}

:deep(.is-active) {
  color: var(--lt-primary);
  font-weight: 600;
}
</style>
