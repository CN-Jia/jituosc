<template>
  <div class="bell-wrap" ref="wrapRef">
    <button class="bell-btn" @click="togglePanel" :class="{ active: panelOpen }">
      <el-icon size="18"><Bell /></el-icon>
      <span v-if="unreadCount > 0" class="badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
    </button>

    <Transition name="panel-fade">
      <div v-if="panelOpen" class="bell-panel">
        <div class="panel-head">
          <span class="panel-title">通知</span>
          <button v-if="notifications.length > 0" class="read-all-btn" @click="readAll">全部已读</button>
        </div>

        <div v-if="loading" class="panel-loading">加载中...</div>
        <div v-else-if="notifications.length === 0" class="panel-empty">暂无通知</div>
        <div v-else class="notif-list">
          <div
            v-for="n in notifications"
            :key="n.id"
            class="notif-item"
            :class="{ unread: !n.isRead }"
            @click="goToOrder(n)"
          >
            <div class="notif-icon" :class="n.type">
              <el-icon><component :is="n.type === 'ORDER_PAID' ? 'CreditCard' : 'CircleClose'" /></el-icon>
            </div>
            <div class="notif-body">
              <div class="notif-summary">{{ n.summary }}</div>
              <div class="notif-time">{{ fmtTime(n.createdAt) }}</div>
            </div>
            <span v-if="!n.isRead" class="unread-dot" />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'

const router = useRouter()
const wrapRef = ref<HTMLElement>()
const panelOpen = ref(false)
const loading = ref(false)
const notifications = ref<any[]>([])
const unreadCount = ref(0)

let pollTimer: ReturnType<typeof setInterval> | null = null

async function fetchUnreadCount() {
  try {
    const res: any = await api.getNotifications({ unread: true, limit: 1 })
    unreadCount.value = res.data.unreadCount ?? 0
  } catch {}
}

async function fetchNotifications() {
  loading.value = true
  try {
    const res: any = await api.getNotifications({ limit: 20 })
    notifications.value = res.data.notifications ?? []
    unreadCount.value = res.data.unreadCount ?? 0
  } finally {
    loading.value = false
  }
}

async function togglePanel() {
  panelOpen.value = !panelOpen.value
  if (panelOpen.value) await fetchNotifications()
}

async function readAll() {
  try {
    await api.markAllNotificationsRead()
    notifications.value = notifications.value.map(n => ({ ...n, isRead: true }))
    unreadCount.value = 0
  } catch {}
}

async function goToOrder(n: any) {
  if (!n.isRead) {
    await api.markNotificationRead(n.id).catch(() => {})
    n.isRead = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  }
  panelOpen.value = false
  if (n.orderId) router.push(`/product-orders/${n.orderId}`)
}

function fmtTime(d: string) {
  const now = Date.now()
  const diff = now - new Date(d).getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function handleClickOutside(e: MouseEvent) {
  if (wrapRef.value && !wrapRef.value.contains(e.target as Node)) {
    panelOpen.value = false
  }
}

onMounted(() => {
  fetchUnreadCount()
  pollTimer = setInterval(fetchUnreadCount, 30_000)
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.bell-wrap { position: relative; }

.bell-btn {
  position: relative; width: 36px; height: 36px; border-radius: 8px;
  border: 1px solid var(--border, #e2e8f0); background: transparent; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-2, #64748b); transition: all 0.15s;
}
.bell-btn:hover, .bell-btn.active { border-color: var(--primary, #00d4ff); color: var(--primary, #00d4ff); background: rgba(0,212,255,0.06); }

.badge {
  position: absolute; top: -4px; right: -4px;
  min-width: 16px; height: 16px; border-radius: 8px;
  background: #ef4444; color: #fff; font-size: 10px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; padding: 0 3px;
  border: 1.5px solid var(--bg-card, #fff);
}

.bell-panel {
  position: absolute; top: calc(100% + 8px); right: 0;
  width: 340px; max-height: 420px; overflow-y: auto;
  background: var(--bg-card, #fff); border: 1px solid var(--border, #e2e8f0);
  border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  z-index: 9000;
}

.panel-head { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px 10px; border-bottom: 1px solid var(--border, #e2e8f0); }
.panel-title { font-size: 14px; font-weight: 700; color: var(--text-1, #1e293b); }
.read-all-btn { font-size: 12px; color: var(--primary, #00d4ff); border: none; background: none; cursor: pointer; }

.panel-loading, .panel-empty { padding: 32px; text-align: center; font-size: 13px; color: var(--text-3, #94a3b8); }

.notif-list { padding: 6px 0; }
.notif-item {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 16px; cursor: pointer; transition: background 0.12s;
  position: relative;
}
.notif-item:hover { background: var(--bg-hover, #f8fafc); }
.notif-item.unread { background: rgba(0,212,255,0.04); }

.notif-icon {
  width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 14px;
}
.notif-icon.ORDER_PAID { background: #eff6ff; color: #0369a1; }
.notif-icon.ORDER_CANCELLED { background: #fef2f2; color: #991b1b; }

.notif-body { flex: 1; min-width: 0; }
.notif-summary { font-size: 13px; color: var(--text-1, #1e293b); line-height: 1.5; word-break: break-all; }
.notif-time { font-size: 11px; color: var(--text-3, #94a3b8); margin-top: 3px; }

.unread-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--primary, #00d4ff); flex-shrink: 0; margin-top: 5px; }

.panel-fade-enter-active, .panel-fade-leave-active { transition: opacity 0.15s, transform 0.15s; }
.panel-fade-enter-from, .panel-fade-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
