<template>
  <div class="screen">

    <!-- 顶栏 -->
    <header class="screen-header">
      <div class="sh-left">
        <h1 class="sh-title">监控大屏</h1>
        <span class="live-badge" :class="{ 'live-badge--paused': !autoRefresh }">
          <span class="live-dot" />
          {{ autoRefresh ? 'LIVE' : '已暂停' }}
        </span>
        <span v-if="lastGlobalRefresh" class="sh-meta">最后刷新 {{ lastGlobalRefresh }}</span>
      </div>
      <div class="sh-right">
        <el-button size="small" plain @click="toggleAuto">
          <el-icon class="el-icon--left"><VideoPause v-if="autoRefresh" /><VideoPlay v-else /></el-icon>
          {{ autoRefresh ? '暂停' : '恢复' }}
        </el-button>
        <el-button size="small" type="primary" :loading="globalLoading" @click="refreshAll">刷新</el-button>
      </div>
    </header>

    <!-- 指标卡片 -->
    <section class="section-label">
      <span class="sl-line" /><span>需求订单运营</span><span class="sl-line" />
    </section>

    <div class="metrics-grid">
      <div v-for="card in metricCards" :key="card.key" class="metric-card" :style="{ '--clr': card.color, '--clr-dim': card.dim }">
        <div class="mc-top">
          <el-icon class="mc-icon"><component :is="card.icon" /></el-icon>
          <span class="mc-tag" :style="{ color: card.color }">{{ card.tag }}</span>
        </div>
        <div class="mc-val">{{ displayVals[card.key] ?? '—' }}</div>
        <div class="mc-label">{{ card.label }}</div>
        <div class="mc-bar"><div class="mc-bar-fill" :style="{ width: barWidths[card.key] + '%' }" /></div>
      </div>
    </div>

    <!-- 状态分布 -->
    <section class="section-label">
      <span class="sl-line" /><span>订单状态分布</span><span class="sl-line" />
    </section>
    <div class="status-grid">
      <div v-for="s in statusCards" :key="s.key" class="status-card" :style="{ '--sc': s.color }">
        <div class="sc-num">{{ byStatus[s.key] ?? 0 }}</div>
        <div class="sc-label">{{ s.label }}</div>
        <div class="sc-dot" />
      </div>
    </div>

    <!-- 底部：快捷操作 + 最近订单 -->
    <div class="bottom-grid">
      <div class="panel">
        <div class="panel-hd"><el-icon class="ph-icon"><Grid /></el-icon> 快捷操作</div>
        <div class="quick-actions">
          <button v-for="act in quickActions" :key="act.label" class="qa-btn" :style="{ '--qc': act.color }" @click="$router.push(act.path)">
            <el-icon><component :is="act.icon" /></el-icon>
            <span>{{ act.label }}</span>
          </button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-hd">
          <el-icon class="ph-icon"><List /></el-icon> 最近需求订单
        </div>
        <div class="orders-table">
          <div class="ot-head">
            <span class="ot-c ot-no">订单号</span>
            <span class="ot-c ot-name">课程</span>
            <span class="ot-c ot-type">类型</span>
            <span class="ot-c ot-status">状态</span>
          </div>
          <div v-for="row in recentOrders" :key="row.id" class="ot-row">
            <span class="ot-c ot-no">{{ row.orderNo }}</span>
            <span class="ot-c ot-name">{{ row.courseName }}</span>
            <span class="ot-c ot-type">{{ row.orderType?.name ?? '—' }}</span>
            <span class="ot-c ot-status">
              <span class="status-dot" :class="row.status.toLowerCase()">{{ statusLabel(row.status) }}</span>
            </span>
          </div>
          <div v-if="!recentOrders.length" class="ot-empty">暂无订单数据</div>
        </div>
      </div>
    </div>

    <!-- 系统监控 -->
    <section class="section-label section-label--accent">
      <span class="sl-line" /><span>系统资源</span><span class="sl-line" />
    </section>
    <DashboardSysMonitor ref="sysRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { VideoPause, VideoPlay } from '@element-plus/icons-vue'
import { api } from '../../api'
import DashboardSysMonitor from '../../components/DashboardSysMonitor.vue'

const sysRef = ref<InstanceType<typeof DashboardSysMonitor> | null>(null)
const statsData = ref<any>({})
const recentOrders = ref<any[]>([])
const displayVals = ref<Record<string, number>>({})
const autoRefresh = ref(true)
const globalLoading = ref(false)
const lastGlobalRefresh = ref('')
let pollTimer: ReturnType<typeof setInterval> | null = null

const byStatus = computed(() => statsData.value?.byStatus ?? {})

function countUp(key: string, to: number, duration = 900) {
  const start = Date.now()
  const tick = () => {
    const p = Math.min((Date.now() - start) / duration, 1)
    displayVals.value[key] = Math.round(to * (1 - Math.pow(1 - p, 3)))
    if (p < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

const metricCards = computed(() => [
  { key: 'todayNew', label: '今日新增', tag: 'TODAY', icon: 'Plus', color: 'var(--accent)', dim: 'var(--accent-dim)', raw: statsData.value?.today?.new ?? 0 },
  { key: 'todayDone', label: '今日完成', tag: 'DONE', icon: 'CircleCheck', color: 'var(--success)', dim: 'rgba(16,217,138,0.12)', raw: statsData.value?.today?.completed ?? 0 },
  { key: 'weekNew', label: '本周新增', tag: 'WEEK', icon: 'Calendar', color: 'var(--purple)', dim: 'var(--purple-dim)', raw: statsData.value?.thisWeek?.new ?? 0 },
  { key: 'total', label: '累计订单', tag: 'TOTAL', icon: 'DataLine', color: 'var(--warning)', dim: 'rgba(245,158,11,0.12)', raw: statsData.value?.total ?? 0 },
])

const barWidths = computed(() => {
  const max = Math.max(...metricCards.value.map(c => c.raw), 1)
  return Object.fromEntries(metricCards.value.map(c => [c.key, Math.round((c.raw / max) * 100)]))
})

const statusCards = [
  { key: 'CREATED', label: '已创建', color: '#60a5fa' },
  { key: 'PENDING', label: '待确认', color: '#f59e0b' },
  { key: 'IN_PROGRESS', label: '进行中', color: '#a855f7' },
  { key: 'COMPLETED', label: '已完成', color: '#10d98a' },
  { key: 'CANCELLED', label: '已取消', color: '#6b7280' },
]

const quickActions = [
  { label: '需求类型', path: '/order-types', icon: 'Grid', color: 'var(--accent)' },
  { label: '兑换审核', path: '/points/redeem', icon: 'Tickets', color: 'var(--warning)' },
  { label: '用户管理', path: '/users', icon: 'User', color: '#60a5fa' },
  { label: '积分规则', path: '/points', icon: 'Coin', color: 'var(--purple)' },
  { label: '论坛管理', path: '/posts', icon: 'ChatDotRound', color: 'var(--success)' },
  { label: '活动公告', path: '/activities', icon: 'Bell', color: '#f472b6' },
]

const STATUS_LABELS: Record<string, string> = {
  CREATED: '已创建', PENDING: '待确认', IN_PROGRESS: '进行中',
  COMPLETED: '已完成', CANCELLED: '已取消',
}
const statusLabel = (s: string) => STATUS_LABELS[s] ?? s

async function loadBiz() {
  const res: any = await api.getStats()
  statsData.value = res.data
  recentOrders.value = res.data?.recentOrders ?? []
  const keyMap: Record<string, number> = {
    todayNew: res.data?.today?.new ?? 0,
    todayDone: res.data?.today?.completed ?? 0,
    weekNew: res.data?.thisWeek?.new ?? 0,
    total: res.data?.total ?? 0,
  }
  Object.entries(keyMap).forEach(([k, v]) => countUp(k, v))
}

async function refreshAll() {
  globalLoading.value = true
  try {
    await loadBiz()
    await sysRef.value?.loadAll()
    lastGlobalRefresh.value = new Date().toLocaleTimeString('zh-CN')
  } catch (e: any) { /* ignore */ }
  globalLoading.value = false
}

function toggleAuto() { autoRefresh.value = !autoRefresh.value }

onMounted(async () => {
  await nextTick()
  await refreshAll()
  pollTimer = setInterval(() => { if (autoRefresh.value && !document.hidden) refreshAll() }, 30000)
})
onBeforeUnmount(() => { if (pollTimer) clearInterval(pollTimer) })
</script>

<style scoped>
.screen { padding: 4px 0 24px; display: flex; flex-direction: column; gap: 0; }

.screen-header {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 12px;
  padding: 4px 4px 18px; margin-bottom: 4px;
  border-bottom: 1px solid var(--border);
}
.sh-left { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.sh-title { font-size: 1.25rem; font-weight: 800; color: var(--text-hi); letter-spacing: 0.02em; margin: 0; }
.live-badge {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 10px; font-weight: 700; letter-spacing: .06em;
  color: var(--success); background: rgba(16,217,138,.12);
  border: 1px solid rgba(16,217,138,.25); border-radius: 20px; padding: 2px 10px;
}
.live-badge--paused { color: var(--text-lo); background: var(--bg-hover); border-color: var(--border); }
.live-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; animation: pulse 1.5s infinite; }
.live-badge--paused .live-dot { animation: none; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
.sh-meta { font-size: 11px; color: var(--text-lo); }
.sh-right { display: flex; align-items: center; gap: 8px; }

.section-label {
  display: flex; align-items: center; gap: 12px;
  color: var(--text-lo); font-size: 11px; font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase;
  margin: 28px 0 14px;
}
.section-label--accent { color: var(--accent); margin-top: 32px; }
.sl-line { flex: 1; height: 1px; background: var(--border); }

.metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
@media (max-width: 1100px) { .metrics-grid { grid-template-columns: repeat(2, 1fr); } }

.metric-card {
  background: var(--bg-panel); border: 1px solid var(--border);
  border-top: 3px solid var(--clr); border-radius: var(--radius);
  padding: 18px 20px 16px; position: relative; overflow: hidden;
  transition: all 0.2s;
}
.metric-card::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 0%, var(--clr-dim) 0%, transparent 70%); pointer-events: none; }
.metric-card:hover { box-shadow: 0 0 20px var(--clr-dim), 0 4px 20px rgba(0,0,0,0.15); transform: translateY(-2px); }
.mc-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.mc-icon { font-size: 18px; color: var(--clr); opacity: 0.9; }
.mc-tag { font-size: 9px; font-weight: 800; letter-spacing: 0.18em; padding: 2px 7px; border: 1px solid currentColor; border-radius: 4px; opacity: 0.7; }
.mc-val { font-size: 40px; font-weight: 900; color: var(--text-hi); line-height: 1; font-variant-numeric: tabular-nums; letter-spacing: -1px; }
.mc-label { font-size: 12px; color: var(--text-md); margin-top: 6px; margin-bottom: 14px; }
.mc-bar { height: 3px; background: var(--border); border-radius: 99px; overflow: hidden; }
.mc-bar-fill { height: 100%; background: var(--clr); border-radius: 99px; transition: width 1s cubic-bezier(.4,0,.2,1); box-shadow: 0 0 8px var(--clr); }

.status-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
@media (max-width: 900px) { .status-grid { grid-template-columns: repeat(3, 1fr); } }
.status-card {
  background: var(--bg-panel); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 14px 16px; text-align: center;
  transition: border-color 0.2s;
}
.status-card:hover { border-color: var(--sc); }
.sc-num { font-size: 28px; font-weight: 800; color: var(--sc); font-variant-numeric: tabular-nums; }
.sc-label { font-size: 12px; color: var(--text-md); margin-top: 4px; }
.sc-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--sc); margin: 10px auto 0; box-shadow: 0 0 8px var(--sc); }

.bottom-grid { display: grid; grid-template-columns: 280px 1fr; gap: 14px; margin-top: 28px; }
@media (max-width: 900px) { .bottom-grid { grid-template-columns: 1fr; } }

.panel { background: var(--bg-panel); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
.panel-hd { display: flex; align-items: center; gap: 8px; padding: 14px 18px; border-bottom: 1px solid var(--border); font-size: 13px; font-weight: 600; color: var(--text-hi); }
.ph-icon { color: var(--accent); font-size: 15px; }

.quick-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 14px; }
.qa-btn {
  display: flex; align-items: center; gap: 8px;
  background: var(--bg-deep); border: 1px solid var(--border);
  border-radius: 8px; color: var(--text-md); font-size: 12.5px;
  padding: 10px 12px; cursor: pointer; transition: all 0.18s;
}
.qa-btn .el-icon { font-size: 14px; color: var(--qc); }
.qa-btn:hover { background: var(--bg-hover); border-color: var(--qc); color: var(--text-hi); }

.orders-table { padding: 0 18px 14px; }
.ot-head { display: flex; padding: 10px 0 6px; font-size: 11px; font-weight: 700; color: var(--text-lo); letter-spacing: 0.08em; text-transform: uppercase; border-bottom: 1px solid var(--border); }
.ot-row { display: flex; padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 13px; color: var(--text-md); }
.ot-row:last-child { border-bottom: none; }
.ot-empty { padding: 24px 0; text-align: center; color: var(--text-lo); font-size: 13px; }
.ot-c { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 8px; }
.ot-no { width: 140px; flex-shrink: 0; font-family: monospace; font-size: 12px; }
.ot-name { flex: 1; min-width: 0; }
.ot-type { width: 80px; flex-shrink: 0; }
.ot-status { width: 80px; flex-shrink: 0; }

.status-dot { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; }
.status-dot.created     { color: #60a5fa; background: rgba(96,165,250,0.12); }
.status-dot.pending     { color: #f59e0b; background: rgba(245,158,11,0.12); }
.status-dot.in_progress { color: #a855f7; background: rgba(168,85,247,0.12); }
.status-dot.completed   { color: #10d98a; background: rgba(16,217,138,0.12); }
.status-dot.cancelled   { color: #6b7280; background: rgba(107,114,128,0.12); }
</style>
