<template>
  <div class="al" :class="{ collapsed, 'mobile-open': mobileOpen }">

    <!-- 移动端遮罩 -->
    <Transition name="fade">
      <div v-if="mobileOpen" class="sidebar-backdrop" @click="mobileOpen = false" />
    </Transition>

    <!-- ═══ 侧边栏 ═══ -->
    <aside class="sidebar">
      <!-- Logo -->
      <div class="sl-logo">
        <JtLogo :size="collapsed ? 30 : 34" />
        <Transition name="fade-slide">
          <div v-if="!collapsed" class="sl-brand">
            <span class="brand-name">极拓空间</span>
            <span class="brand-sub">ADMIN</span>
          </div>
        </Transition>
        <!-- 移动端关闭按钮 -->
        <button class="mobile-close" @click="mobileOpen = false">
          <el-icon><Close /></el-icon>
        </button>
      </div>

      <!-- 导航 -->
      <nav class="sl-nav">
        <template v-for="group in navGroups" :key="group.label">
          <div v-if="!collapsed" class="sl-group-label">
            <span class="gl-line" />
            <span class="gl-text">{{ group.label }}</span>
            <span class="gl-line" />
          </div>
          <div v-else class="sl-group-sep" />

          <router-link
            v-for="item in group.items"
            :key="item.path"
            :to="item.path"
            class="sl-item"
            :class="{ active: isActive(item.path) }"
            @click="mobileOpen = false"
          >
            <span class="si-icon">
              <el-icon><component :is="item.icon" /></el-icon>
            </span>
            <Transition name="fade-slide">
              <span v-if="!collapsed" class="si-label">{{ item.label }}</span>
            </Transition>
          </router-link>
        </template>
      </nav>

      <!-- 底部折叠按钮（桌面端） -->
      <div class="sl-footer desktop-only">
        <button class="collapse-btn" @click="collapsed = !collapsed">
          <el-icon><component :is="collapsed ? 'DArrowRight' : 'DArrowLeft'" /></el-icon>
        </button>
      </div>
    </aside>

    <!-- ═══ 主区域 ═══ -->
    <div class="main-wrap">
      <!-- Topbar -->
      <header class="topbar">
        <div class="tb-left">
          <!-- 汉堡按钮（移动端） -->
          <button class="hamburger mobile-only" @click="mobileOpen = true">
            <span /><span /><span />
          </button>
          <span class="tb-cursor desktop-only">▶</span>
          <span class="tb-title">{{ pageTitle }}</span>
        </div>
        <div class="tb-right">
          <!-- 通知铃铛 -->
          <NotificationBell />
          <!-- 主题切换按钮 -->
          <button class="theme-btn" @click="toggle" :title="isDark ? '切换到亮色' : '切换到暗色'">
            <el-icon v-if="isDark"><Sunny /></el-icon>
            <el-icon v-else><Moon /></el-icon>
          </button>
          <div class="tb-divider" />
          <span class="tb-dot online" />
          <span class="tb-dot-label desktop-only">在线</span>
          <div class="tb-divider desktop-only" />
          <span class="tb-admin desktop-only">Admin</span>
          <button class="tb-logout" @click="handleLogout">
            <el-icon><SwitchButton /></el-icon>
            <span class="desktop-only">退出</span>
          </button>
        </div>
      </header>

      <!-- 内容 -->
      <main class="page-body">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAdminStore } from './store/admin'
import { useTheme } from './composables/useTheme'
import JtLogo from './components/JtLogo.vue'
import NotificationBell from './components/NotificationBell.vue'

const router = useRouter()
const route = useRoute()
const store = useAdminStore()
const { isDark, toggle } = useTheme()

const collapsed = ref(false)
const mobileOpen = ref(false)

const navGroups = [
  {
    label: '概览',
    items: [
      { path: '/', label: '监控大屏', icon: 'Monitor' },
    ],
  },
  {
    label: '需求管理',
    items: [
      { path: '/orders',      label: '订单管理', icon: 'List' },
      { path: '/order-types', label: '需求类型', icon: 'Document' },
      { path: '/activities',  label: '活动公告', icon: 'Bell' },
    ],
  },
  {
    label: '内容管理',
    items: [
      { path: '/posts',    label: '论坛管理', icon: 'ChatDotRound' },
      { path: '/carousel', label: '作品轮播', icon: 'Picture' },
      { path: '/feedback', label: '用户反馈', icon: 'Comment' },
    ],
  },
  {
    label: '毕设进度',
    items: [
      { path: '/thesis', label: '进度管理', icon: 'Reading' },
    ],
  },
  {
    label: '积分系统',
    items: [
      { path: '/points',        label: '积分规则', icon: 'Coin' },
      { path: '/points/shop',   label: '积分商城', icon: 'ShoppingCart' },
      { path: '/points/redeem', label: '兑换审核', icon: 'Tickets' },
    ],
  },
  {
    label: '营销活动',
    items: [
      { path: '/lucky-wheel', label: '幸运转盘', icon: 'Present' },
    ],
  },
  {
    label: '系统',
    items: [
      { path: '/users', label: '用户管理', icon: 'User' },
    ],
  },
]

const titleMap: Record<string, string> = {
  '/': '监控大屏',
  '/orders': '订单管理',
  '/order-types': '需求类型',
  '/activities': '活动公告',
  '/posts': '论坛管理',
  '/carousel': '作品轮播',
  '/feedback': '用户反馈',
  '/points': '积分规则',
  '/points/shop': '积分商城',
  '/points/redeem': '兑换审核',
  '/lucky-wheel': '幸运转盘',
  '/users': '用户管理',
  '/thesis': '毕设进度',
}

const pageTitle = computed(() => titleMap[route.path] ?? '极拓空间 管理后台')

const isActive = (path: string) => {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

function handleLogout() {
  store.logout()
  router.push('/login')
}
</script>

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #app { height: 100%; }
body { background: var(--bg-deep); transition: background 0.25s; }
</style>

<style scoped>
/* ══════════════════════════════════════════════
   Layout
══════════════════════════════════════════════ */
.al {
  display: flex;
  height: 100vh;
  background: var(--bg-deep);
  color: var(--text-hi);
  overflow: hidden;
  transition: background 0.25s, color 0.25s;
}

/* ══════════════════════════════════════════════
   Sidebar
══════════════════════════════════════════════ */
.sidebar {
  width: var(--sidebar-w);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border-right: 1px solid var(--border);
  transition: width 0.28s cubic-bezier(.4,0,.2,1), background 0.25s, border-color 0.25s;
  position: relative;
  overflow: hidden;
  z-index: 100;
}

/* dot-grid 暗色 */
html.dark .sidebar::before {
  content: '';
  position: absolute; inset: 0;
  background-image: radial-gradient(circle at 1.5px 1.5px, rgba(0,212,255,0.07) 1.5px, transparent 0);
  background-size: 22px 22px;
  pointer-events: none;
}

/* 顶部扫描线 暗色 */
html.dark .sidebar::after {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  opacity: 0.5;
  pointer-events: none;
}

.al.collapsed .sidebar { width: var(--sidebar-col); }

/* Logo */
.sl-logo {
  display: flex; align-items: center; gap: 12px;
  padding: 0 14px;
  height: var(--topbar-h);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  position: relative; z-index: 2;
  transition: border-color 0.25s;
}

.sl-brand { display: flex; flex-direction: column; overflow: hidden; flex: 1; }
.brand-name { font-size: 15px; font-weight: 800; color: var(--text-hi); letter-spacing: 0.04em; white-space: nowrap; line-height: 1.2; }
.brand-sub  { font-size: 9px; font-weight: 700; letter-spacing: 0.25em; color: var(--accent); white-space: nowrap; opacity: 0.8; }

.mobile-close { display: none; margin-left: auto; background: none; border: none; cursor: pointer; color: var(--text-md); font-size: 18px; padding: 4px; }

/* Nav */
.sl-nav {
  flex: 1; overflow-y: auto; overflow-x: hidden; padding: 8px 0;
  position: relative; z-index: 2;
}
.sl-nav::-webkit-scrollbar { width: 3px; }
.sl-nav::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }

.sl-group-label {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 12px 5px;
  font-size: 10px; font-weight: 700; color: var(--text-lo);
  letter-spacing: 0.15em; text-transform: uppercase; white-space: nowrap;
}
.gl-line { flex: 1; height: 1px; background: var(--border); }
.gl-text { flex-shrink: 0; }
.sl-group-sep { height: 1px; background: var(--border); margin: 10px 8px; }

.sl-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 14px; margin: 1px 6px;
  border-radius: 8px;
  color: var(--text-md);
  text-decoration: none; font-size: 13.5px; white-space: nowrap;
  transition: all 0.18s ease;
  position: relative; overflow: hidden;
  cursor: pointer;
}
.sl-item::before {
  content: '';
  position: absolute; left: 0; top: 50%; transform: translateY(-50%);
  width: 3px; height: 0;
  background: var(--accent);
  border-radius: 0 3px 3px 0;
  transition: height 0.2s ease;
}
html.dark .sl-item::before { box-shadow: 0 0 8px var(--accent-glow); }
.sl-item:hover { background: var(--bg-hover); color: var(--text-hi); }
.sl-item.active { background: var(--accent-dim); color: var(--accent); }
.sl-item.active::before { height: 60%; }
.si-icon { display: flex; align-items: center; font-size: 16px; flex-shrink: 0; }
.si-label { flex: 1; }

/* Footer collapse btn */
.sl-footer { border-top: 1px solid var(--border); padding: 10px 6px; position: relative; z-index: 2; transition: border-color 0.25s; }
.collapse-btn {
  width: 100%; background: none;
  border: 1px solid var(--border); border-radius: 8px;
  color: var(--text-md); padding: 7px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; font-size: 15px;
  transition: all 0.18s;
}
.collapse-btn:hover { background: var(--bg-hover); border-color: var(--border-mid); color: var(--accent); }

/* ══════════════════════════════════════════════
   Main
══════════════════════════════════════════════ */
.main-wrap { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }

/* Topbar */
.topbar {
  height: var(--topbar-h); flex-shrink: 0;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 20px;
  position: relative;
  transition: background 0.25s, border-color 0.25s;
  z-index: 50;
}
html.dark .topbar::after {
  content: '';
  position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent-dim), transparent);
}

.tb-left { display: flex; align-items: center; gap: 8px; }
.tb-cursor { font-size: 10px; color: var(--accent); animation: blink 1.2s step-end infinite; }
@keyframes blink { 50% { opacity: 0; } }
.tb-title { font-size: 15px; font-weight: 600; color: var(--text-hi); letter-spacing: 0.02em; }

.tb-right { display: flex; align-items: center; gap: 8px; }
.tb-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--success); animation: pulse 2s ease-in-out infinite; }
html.dark .tb-dot { box-shadow: 0 0 8px var(--success); }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
.tb-dot-label { font-size: 12px; color: var(--success); }
.tb-divider { width: 1px; height: 18px; background: var(--border); }
.tb-admin { font-size: 13px; color: var(--text-md); }

/* 主题切换按钮 */
.theme-btn {
  display: flex; align-items: center; justify-content: center;
  width: 34px; height: 34px;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-md);
  cursor: pointer;
  font-size: 16px;
  transition: all 0.18s;
}
.theme-btn:hover { border-color: var(--accent); color: var(--accent); }

.tb-logout {
  display: flex; align-items: center; gap: 5px;
  background: none; border: 1px solid var(--border); border-radius: 8px;
  color: var(--text-md); font-size: 12px; padding: 5px 12px;
  cursor: pointer; transition: all 0.18s;
}
.tb-logout:hover { border-color: var(--danger); color: var(--danger); }

/* 汉堡按钮（移动端） */
.hamburger {
  display: none; flex-direction: column; justify-content: center;
  gap: 5px; background: none; border: none; cursor: pointer; padding: 4px;
  width: 36px; height: 36px;
}
.hamburger span {
  display: block; width: 20px; height: 2px;
  background: var(--text-md); border-radius: 2px;
  transition: all 0.2s;
}

/* Page body */
.page-body {
  flex: 1; overflow-y: auto; padding: 20px;
  background: var(--bg-deep);
  transition: background 0.25s;
}

/* Backdrop */
.sidebar-backdrop {
  display: none;
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 99;
}

/* Transitions */
.fade-slide-enter-active, .fade-slide-leave-active { transition: opacity 0.2s, transform 0.2s; }
.fade-slide-enter-from { opacity: 0; transform: translateX(-6px); }
.fade-slide-leave-to   { opacity: 0; transform: translateX(-6px); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* ══════════════════════════════════════════════
   H5 / 移动端响应式
══════════════════════════════════════════════ */
.desktop-only { display: flex; }
.mobile-only  { display: none; }

@media (max-width: 768px) {
  .desktop-only { display: none !important; }
  .mobile-only  { display: flex !important; }

  /* 侧边栏变成固定抽屉 */
  .sidebar {
    position: fixed !important;
    top: 0; left: 0; bottom: 0;
    width: 260px !important;
    transform: translateX(-100%);
    transition: transform 0.3s cubic-bezier(.4,0,.2,1);
    z-index: 200;
    box-shadow: none;
  }
  .al.mobile-open .sidebar {
    transform: translateX(0);
    box-shadow: 4px 0 30px rgba(0,0,0,0.25);
  }
  .al.mobile-open .sidebar-backdrop { display: block; }

  /* 主区域无左偏移 */
  .al.collapsed .sidebar { width: 260px !important; }
  .main-wrap { margin-left: 0 !important; }

  /* 侧边栏内显示关闭按钮 */
  .mobile-close { display: flex !important; }
  .hamburger { display: flex !important; }

  /* 标题栏 padding 缩小 */
  .topbar { padding: 0 14px; }
  .page-body { padding: 14px; }

  /* tb-admin 隐藏在移动端 */
  .tb-right { gap: 6px; }
}

@media (max-width: 480px) {
  .page-body { padding: 10px; }
  .tb-title { font-size: 13px; }
}
</style>
