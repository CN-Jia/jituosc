<template>
  <div class="sys-monitor">
    <div class="sys-toolbar">
      <span class="sys-toolbar-label">时序图表范围</span>
      <el-select v-model="timeRange" style="width:130px" size="small" @change="fetchChartData">
        <el-option label="近 30 分钟" :value="30" />
        <el-option label="近 1 小时" :value="60" />
        <el-option label="近 3 小时" :value="180" />
        <el-option label="近 6 小时" :value="360" />
        <el-option label="近 24 小时" :value="1440" />
        <el-option label="近 7 天" :value="10080" />
      </el-select>
      <span v-if="lastUpdate" class="sys-toolbar-meta">系统快照 {{ lastUpdate }}</span>
    </div>

    <el-alert
      v-if="status && !status.promAvailable"
      type="warning" show-icon :closable="false"
      title="Prometheus 未连接 — CPU / 磁盘 / 网络时序不可用，卡片数据仍以 Node.js 快照为准"
    />

    <template v-if="!status">
      <div class="skeleton-grid">
        <div v-for="i in 8" :key="i" class="skeleton-card" />
      </div>
    </template>

    <template v-else>
      <section class="section-label">系统资源</section>
      <div class="cards-row">
        <div class="metric-card" :class="statusClass(status.cpu.usagePct, 65, 85)">
          <div class="card-inner">
            <div class="card-icon">🖥</div>
            <div class="card-body">
              <div class="card-value">
                {{ status.cpu.usagePct !== null ? status.cpu.usagePct.toFixed(1) + '%' : '—' }}
              </div>
              <div class="card-label">CPU 使用率</div>
              <div class="card-sub">{{ status.cpu.cores }} 核 · 负载 {{ status.cpu.load1?.toFixed(2) }}</div>
            </div>
          </div>
          <RingGauge :value="status.cpu.usagePct ?? 0" :max="100"
            :color="gaugeColor(status.cpu.usagePct, 65, 85)" />
        </div>

        <div class="metric-card" :class="statusClass(status.memory.usedPct, 70, 85)">
          <div class="card-inner">
            <div class="card-icon">💾</div>
            <div class="card-body">
              <div class="card-value">{{ status.memory.usedPct }}%</div>
              <div class="card-label">内存使用率</div>
              <div class="card-sub">
                {{ fmtBytes(status.memory.usedBytes) }} / {{ fmtBytes(status.memory.totalBytes) }}
              </div>
            </div>
          </div>
          <RingGauge :value="status.memory.usedPct" :max="100"
            :color="gaugeColor(status.memory.usedPct, 70, 85)" />
        </div>

        <div class="metric-card" :class="statusClass(status.disk.usedPct, 75, 90)">
          <div class="card-inner">
            <div class="card-icon">🗄</div>
            <div class="card-body">
              <div class="card-value">
                {{ status.disk.usedPct !== null ? status.disk.usedPct + '%' : '—' }}
              </div>
              <div class="card-label">磁盘使用 (/)</div>
              <div class="card-sub">
                {{ status.disk.usedBytes ? fmtBytes(status.disk.usedBytes) : '—' }}
                / {{ status.disk.totalBytes ? fmtBytes(status.disk.totalBytes) : '—' }}
              </div>
            </div>
          </div>
          <RingGauge :value="status.disk.usedPct ?? 0" :max="100"
            :color="gaugeColor(status.disk.usedPct, 75, 90)" />
        </div>

        <div class="metric-card card-neutral">
          <div class="card-inner">
            <div class="card-icon">🌐</div>
            <div class="card-body">
              <div class="card-value net-value">
                <span class="net-tx">↑ {{ status.network.txBytesPerSec !== null ? fmtSpeed(status.network.txBytesPerSec) : '—' }}</span>
              </div>
              <div class="card-label">网络 出 / 入</div>
              <div class="card-sub net-rx">
                ↓ {{ status.network.rxBytesPerSec !== null ? fmtSpeed(status.network.rxBytesPerSec) : '—' }}
              </div>
            </div>
          </div>
          <div class="net-bars">
            <div class="net-bar-wrap">
              <div class="net-bar-fill tx" :style="{ width: netBarPct(status.network.txBytesPerSec) + '%' }" />
            </div>
            <div class="net-bar-wrap">
              <div class="net-bar-fill rx" :style="{ width: netBarPct(status.network.rxBytesPerSec) + '%' }" />
            </div>
          </div>
        </div>

        <div class="metric-card card-neutral">
          <div class="card-inner">
            <div class="card-icon">⏱</div>
            <div class="card-body">
              <div class="card-value" style="font-size:1.1rem">{{ status.os.uptimeHuman }}</div>
              <div class="card-label">系统运行时长</div>
              <div class="card-sub">{{ status.os.hostname }}</div>
            </div>
          </div>
          <div class="uptime-stack">
            <div class="uptime-item">API <b>{{ fmtUptime(status.process.nodeUptime) }}</b></div>
            <div class="uptime-item">平台 <b>{{ status.os.platform }}/{{ status.os.arch }}</b></div>
          </div>
        </div>

        <div class="metric-card" :class="statusClass(status.cpu.load1 / status.cpu.cores * 100, 70, 90)">
          <div class="card-inner">
            <div class="card-icon">📊</div>
            <div class="card-body">
              <div class="card-value">{{ status.cpu.load1?.toFixed(2) }}</div>
              <div class="card-label">系统负载 (load1)</div>
              <div class="card-sub">1m · 5m · 15m</div>
            </div>
          </div>
          <div class="load-bars">
            <LoadBar label="1m" :value="status.cpu.load1" :cores="status.cpu.cores" />
            <LoadBar label="5m" :value="status.cpu.load5" :cores="status.cpu.cores" />
            <LoadBar label="15m" :value="status.cpu.load15 ?? status.os.loadAvg[2]" :cores="status.cpu.cores" />
          </div>
        </div>

        <div class="metric-card card-neutral">
          <div class="card-inner">
            <div class="card-icon">🔗</div>
            <div class="card-body">
              <div class="card-value">{{ status.process.tcpConns ?? '—' }}</div>
              <div class="card-label">TCP 连接数</div>
              <div class="card-sub">打开文件 {{ status.process.openFiles ?? '—' }} 个</div>
            </div>
          </div>
        </div>
      </div>

      <section class="section-label">商品业务快照（数据库）</section>
      <div class="biz-row">
        <div class="biz-card">
          <div class="biz-icon">📦</div>
          <div class="biz-num">{{ status.business.todayOrders }}</div>
          <div class="biz-label">今日新增商品订单</div>
        </div>
        <div class="biz-card biz-warn" v-if="status.business.pendingOrders > 0">
          <div class="biz-icon">⏳</div>
          <div class="biz-num warn">{{ status.business.pendingOrders }}</div>
          <div class="biz-label">待处理（未完结）</div>
        </div>
        <div class="biz-card" v-else>
          <div class="biz-icon">✅</div>
          <div class="biz-num ok">0</div>
          <div class="biz-label">待处理（未完结）</div>
        </div>
        <div class="biz-card">
          <div class="biz-icon">👥</div>
          <div class="biz-num">{{ status.business.totalUsers }}</div>
          <div class="biz-label">注册用户</div>
        </div>
        <div class="biz-card">
          <div class="biz-icon">🏪</div>
          <div class="biz-num">{{ status.business.totalOrders }}</div>
          <div class="biz-label">商品订单累计</div>
        </div>
        <div class="biz-card biz-warn" v-if="status.business.pendingRedeems > 0">
          <div class="biz-icon">🎁</div>
          <div class="biz-num warn">{{ status.business.pendingRedeems }}</div>
          <div class="biz-label">待审核兑换</div>
        </div>
        <div class="biz-card" v-else>
          <div class="biz-icon">🎁</div>
          <div class="biz-num ok">0</div>
          <div class="biz-label">待审核兑换</div>
        </div>
      </div>

      <section class="section-label">
        资源时序
        <span v-if="!status.promAvailable" class="section-badge warn">需 Prometheus</span>
      </section>
      <div class="charts-grid">
        <div class="chart-card">
          <div class="chart-header">
            <span class="chart-title">CPU (%)</span>
            <span v-if="chartLoading" class="chart-loading-badge">加载中…</span>
          </div>
          <div ref="cpuChartRef" class="chart-canvas" />
        </div>
        <div class="chart-card">
          <div class="chart-header"><span class="chart-title">内存 (%)</span></div>
          <div ref="memChartRef" class="chart-canvas" />
        </div>
        <div class="chart-card">
          <div class="chart-header"><span class="chart-title">网络 (KB/s)</span></div>
          <div ref="netChartRef" class="chart-canvas" />
        </div>
        <div class="chart-card">
          <div class="chart-header"><span class="chart-title">Load Average</span></div>
          <div ref="loadChartRef" class="chart-canvas" />
        </div>
      </div>

      <section class="section-label">服务器信息</section>
      <el-card class="info-card">
        <el-descriptions :column="3" border size="small">
          <el-descriptions-item label="主机名">{{ status.os.hostname }}</el-descriptions-item>
          <el-descriptions-item label="系统">{{ status.os.platform }} / {{ status.os.arch }}</el-descriptions-item>
          <el-descriptions-item label="CPU 型号">{{ status.os.cpuModel }}</el-descriptions-item>
          <el-descriptions-item label="CPU 核心数">{{ status.os.cpuCount }} 核</el-descriptions-item>
          <el-descriptions-item label="系统运行时长">{{ status.os.uptimeHuman }}</el-descriptions-item>
          <el-descriptions-item label="负载 (1 / 5 / 15 min)">
            {{ status.cpu.load1?.toFixed(2) }} / {{ status.cpu.load5?.toFixed(2) }} / {{ status.os.loadAvg[2]?.toFixed(2) }}
          </el-descriptions-item>
          <el-descriptions-item label="API 进程运行">{{ fmtUptime(status.process.nodeUptime) }}</el-descriptions-item>
          <el-descriptions-item label="Prometheus">
            <el-tag :type="status.promAvailable ? 'success' : 'warning'" size="small">
              {{ status.promAvailable ? '已连接' : '未连接' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="快照时间">{{ lastUpdate }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card id="install" class="info-card" v-if="!status.promAvailable">
        <template #header><span>安装 Prometheus + node_exporter</span></template>
        <el-alert type="info" :closable="false" style="margin-bottom:12px">
          安装完成后在大屏点击「全部刷新」即可加载时序图表。
        </el-alert>
        <pre class="install-code">{{ installDocs }}</pre>
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick, defineComponent, h } from 'vue'
import * as echarts from 'echarts'
import { api } from '../api'

const RingGauge = defineComponent({
  props: { value: Number, max: { type: Number, default: 100 }, color: { type: String, default: '#3b82f6' } },
  setup(props) {
    const R = 15.9
    const CIRC = 2 * Math.PI * R
    return () => {
      const pct = Math.min(100, Math.max(0, ((props.value ?? 0) / (props.max ?? 100)) * 100))
      const offset = CIRC * (1 - pct / 100)
      return h('svg', { viewBox: '0 0 36 36', class: 'ring-svg' }, [
        h('circle', { cx: 18, cy: 18, r: R, fill: 'none', stroke: 'rgba(255,255,255,.08)', 'stroke-width': 3 }),
        h('circle', {
          cx: 18, cy: 18, r: R, fill: 'none',
          stroke: props.color, 'stroke-width': 3,
          'stroke-dasharray': `${CIRC}`,
          'stroke-dashoffset': offset,
          'stroke-linecap': 'round',
          transform: 'rotate(-90 18 18)',
          style: 'transition: stroke-dashoffset .5s ease',
        }),
      ])
    }
  },
})

const LoadBar = defineComponent({
  props: { label: String, value: Number, cores: { type: Number, default: 1 } },
  setup(props) {
    return () => {
      const pct = Math.min(100, ((props.value ?? 0) / (props.cores ?? 1)) * 100)
      const color = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e'
      return h('div', { class: 'lb-row' }, [
        h('span', { class: 'lb-label' }, props.label),
        h('div', { class: 'lb-track' }, [
          h('div', { class: 'lb-fill', style: { width: pct + '%', background: color } }),
        ]),
        h('span', { class: 'lb-val' }, (props.value ?? 0).toFixed(2)),
      ])
    }
  },
})

const status = ref<any>(null)
const chartData = ref<any>(null)
const lastUpdate = ref('')
const timeRange = ref(360)
const chartLoading = ref(false)

const cpuChartRef = ref<HTMLElement>()
const memChartRef = ref<HTMLElement>()
const netChartRef = ref<HTMLElement>()
const loadChartRef = ref<HTMLElement>()

let cpuChart: echarts.ECharts | null = null
let memChart: echarts.ECharts | null = null
let netChart: echarts.ECharts | null = null
let loadChart: echarts.ECharts | null = null

function statusClass(val: number | null, warnAt: number, dangerAt: number) {
  if (val === null || val === undefined) return 'card-neutral'
  if (val >= dangerAt) return 'card-danger'
  if (val >= warnAt) return 'card-warn'
  return 'card-ok'
}

function gaugeColor(val: number | null, warnAt: number, dangerAt: number) {
  if (val === null || val === undefined) return '#3b82f6'
  if (val >= dangerAt) return '#ef4444'
  if (val >= warnAt) return '#f59e0b'
  return '#22c55e'
}

function fmtBytes(bytes: number): string {
  if (!bytes) return '0 B'
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB'
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB'
  return (bytes / 1e3).toFixed(0) + ' KB'
}

function fmtSpeed(bps: number): string {
  if (bps >= 1e6) return (bps / 1e6).toFixed(1) + ' MB/s'
  if (bps >= 1e3) return (bps / 1e3).toFixed(1) + ' KB/s'
  return bps.toFixed(0) + ' B/s'
}

function fmtUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}小时 ${m}分` : `${m}分钟`
}

function netBarPct(bps: number | null): number {
  if (!bps) return 0
  return Math.min(100, (bps / (10 * 1024 * 1024)) * 100)
}

const THEME = {
  bg: 'transparent',
  grid: 'rgba(255,255,255,.05)',
  text: '#64748b',
  blue: '#3b82f6',
  green: '#22c55e',
  amber: '#f59e0b',
  slate: '#94a3b8',
}

function buildLineOption(
  series: Array<{ name: string; data: [number, number][]; color: string }>,
  yMax?: number,
): echarts.EChartsOption {
  return {
    backgroundColor: THEME.bg,
    animation: false,
    grid: { top: 20, right: 12, bottom: 28, left: 44, containLabel: false },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#e2e8f0', fontSize: 11 },
      formatter: (params: any) => {
        const t = new Date(params[0].value[0])
        const time = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`
        return params.map((p: any) =>
          `${time}<br/>${p.marker}${p.seriesName}: <b>${Number(p.value[1]).toFixed(1)}</b>`
        ).join('<br/>')
      },
    },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: THEME.grid } },
      axisTick: { show: false },
      axisLabel: {
        color: THEME.text, fontSize: 10,
        formatter: (val: number) => {
          const d = new Date(val)
          return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
        },
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      max: yMax,
      min: 0,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: THEME.grid, type: 'dashed' } },
      axisLabel: { color: THEME.text, fontSize: 10 },
    },
    series: series.map((s, i) => ({
      name: s.name,
      type: 'line',
      data: s.data,
      smooth: 0.3,
      symbol: 'none',
      lineStyle: { color: s.color, width: 1.5 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: s.color + '40' },
          { offset: 1, color: s.color + '00' },
        ]),
      },
      itemStyle: { color: s.color },
      z: series.length - i,
    })),
    legend: series.length > 1 ? {
      top: 0, right: 4,
      itemWidth: 12, itemHeight: 2,
      textStyle: { color: THEME.text, fontSize: 10 },
    } : undefined,
  }
}

function fakeSeries(val: number, minutes = 60): [number, number][] {
  const now = Date.now()
  return Array.from({ length: 20 }, (_, i) => [
    now - (19 - i) * (minutes * 60000 / 20),
    Math.max(0, val + (Math.random() - 0.5) * val * 0.1),
  ])
}

function initChart(el: HTMLElement, prev: echarts.ECharts | null): echarts.ECharts {
  prev?.dispose()
  const c = echarts.init(el, undefined, { renderer: 'canvas' })
  if (el.offsetWidth < 10) c.resize({ width: 380, height: 160 })
  return c
}

function renderCharts() {
  if (!status.value) return
  const d = chartData.value
  const s = status.value
  const mins = timeRange.value

  const cpu = d?.cpu?.length > 0 ? d.cpu : fakeSeries(s.cpu.usagePct ?? 0, mins)
  const mem = d?.memory?.length > 0 ? d.memory : fakeSeries(s.memory.usedPct, mins)
  const rx = d?.netRx?.length > 0 ? d.netRx.map(([t, v]: [number, number]) => [t, v / 1024]) : fakeSeries(0, mins)
  const tx = d?.netTx?.length > 0 ? d.netTx.map(([t, v]: [number, number]) => [t, v / 1024]) : fakeSeries(0, mins)

  if (cpuChartRef.value) {
    cpuChart = initChart(cpuChartRef.value, cpuChart)
    cpuChart.setOption(buildLineOption([{ name: 'CPU %', data: cpu, color: THEME.blue }], 100))
  }
  if (memChartRef.value) {
    memChart = initChart(memChartRef.value, memChart)
    memChart.setOption(buildLineOption([{ name: '内存 %', data: mem, color: THEME.green }], 100))
  }
  if (netChartRef.value) {
    netChart = initChart(netChartRef.value, netChart)
    netChart.setOption(buildLineOption([
      { name: '入 KB/s', data: rx, color: THEME.blue },
      { name: '出 KB/s', data: tx, color: THEME.amber },
    ]))
  }
  if (loadChartRef.value) {
    const l1 = fakeSeries(s.cpu.load1 ?? 0, mins)
    const l5 = fakeSeries(s.cpu.load5 ?? 0, mins)
    const l15 = fakeSeries(s.os.loadAvg[2] ?? 0, mins)
    const realL1 = d?.load1?.length > 0 ? d.load1 : l1
    const realL5 = d?.load5?.length > 0 ? d.load5 : l5
    const realL15 = d?.load15?.length > 0 ? d.load15 : l15
    loadChart = initChart(loadChartRef.value, loadChart)
    loadChart.setOption(buildLineOption([
      { name: 'load1', data: realL1, color: THEME.blue },
      { name: 'load5', data: realL5, color: THEME.amber },
      { name: 'load15', data: realL15, color: THEME.slate },
    ]))
  }
}

async function loadStatus() {
  const res: any = await api.getSystemStatus()
  status.value = res.data
  lastUpdate.value = new Date().toLocaleTimeString('zh-CN')
}

async function fetchChartData() {
  chartLoading.value = true
  try {
    const res: any = await api.getSystemChart(timeRange.value)
    chartData.value = res.data
    await nextTick()
    await new Promise(r => setTimeout(r, 80))
    renderCharts()
  } finally {
    chartLoading.value = false
  }
}

async function loadAll() {
  await loadStatus()
  await fetchChartData()
}

function onResize() {
  cpuChart?.resize()
  memChart?.resize()
  netChart?.resize()
  loadChart?.resize()
}

onMounted(() => {
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  cpuChart?.dispose()
  memChart?.dispose()
  netChart?.dispose()
  loadChart?.dispose()
})

defineExpose({ loadAll })

const installDocs = `# 参考 deploy/DEPLOY.md 或监控页历史版本中的完整脚本
# 核心：node_exporter :9100 + Prometheus :9090
# backend/.env: PROMETHEUS_URL=http://localhost:9090
# pm2 restart jthub-api --update-env`
</script>

<style scoped>
.sys-monitor { display: flex; flex-direction: column; gap: 14px; }

.sys-toolbar {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 8px 0 4px;
}
.sys-toolbar-label { font-size: 11px; color: var(--text-lo); font-weight: 600; }
.sys-toolbar-meta { font-size: 11px; color: var(--text-lo); margin-left: auto; }

.section-label {
  font-size: 10px; font-weight: 700; letter-spacing: .1em;
  text-transform: uppercase; color: var(--text-lo);
  display: flex; align-items: center; gap: 8px;
}
.section-badge {
  font-size: 9px; font-weight: 600; padding: 1px 7px; border-radius: 4px;
  text-transform: none; letter-spacing: 0;
}
.section-badge.warn { color: #f59e0b; background: rgba(245,158,11,.1); border: 1px solid rgba(245,158,11,.2); }

.skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px,1fr)); gap: 10px; }
.skeleton-card {
  height: 88px; border-radius: 12px;
  background: linear-gradient(90deg, var(--bg-panel) 25%, var(--bg-deep) 50%, var(--bg-panel) 75%);
  background-size: 200% 100%; animation: shimmer 1.4s infinite;
}
@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

.cards-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(195px,1fr)); gap: 10px; }
.metric-card {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 12px; padding: 14px 16px;
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  position: relative; overflow: hidden;
  transition: border-color .2s, transform .15s;
}
.metric-card:hover { transform: translateY(-1px); }
.metric-card::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
  border-radius: 12px 12px 0 0;
}
.card-ok::before    { background: #22c55e; }
.card-warn::before  { background: #f59e0b; }
.card-danger::before{ background: #ef4444; }
.card-neutral::before{ background: var(--accent); }

.card-ok     { border-color: rgba(34,197,94,.15); }
.card-warn   { border-color: rgba(245,158,11,.2); }
.card-danger { border-color: rgba(239,68,68,.25); }
.card-neutral{ border-color: rgba(59,130,246,.15); }

.card-inner { display: flex; align-items: center; gap: 11px; flex: 1; min-width: 0; }
.card-icon  { font-size: 1.3rem; flex-shrink: 0; }
.card-body  { flex: 1; min-width: 0; }
.card-value { font-size: 1.35rem; font-weight: 800; color: var(--text-hi); line-height: 1.2; font-variant-numeric: tabular-nums; }
.card-label { font-size: 10px; color: var(--text-lo); margin-top: 3px; letter-spacing: .04em; }
.card-sub   { font-size: 10px; color: var(--text-md); margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.ring-svg { width: 46px; height: 46px; flex-shrink: 0; }

.net-value { font-size: 1rem; }
.net-tx { color: #f59e0b; }
.net-rx { color: #3b82f6; }
.net-bars { display: flex; flex-direction: column; gap: 5px; width: 50px; flex-shrink: 0; }
.net-bar-wrap { height: 4px; background: rgba(255,255,255,.06); border-radius: 2px; overflow: hidden; }
.net-bar-fill { height: 100%; border-radius: 2px; transition: width .5s ease; }
.net-bar-fill.tx { background: #f59e0b; }
.net-bar-fill.rx { background: #3b82f6; }

.uptime-stack { display: flex; flex-direction: column; gap: 4px; min-width: 80px; }
.uptime-item { font-size: 10px; color: var(--text-lo); white-space: nowrap; }
.uptime-item b { color: var(--text-md); font-weight: 600; }

.load-bars { display: flex; flex-direction: column; gap: 5px; width: 90px; flex-shrink: 0; }
.lb-row { display: flex; align-items: center; gap: 4px; }
.lb-label { font-size: 9px; color: var(--text-lo); width: 18px; flex-shrink: 0; }
.lb-track { flex: 1; height: 4px; background: rgba(255,255,255,.06); border-radius: 2px; overflow: hidden; }
.lb-fill  { height: 100%; border-radius: 2px; transition: width .5s ease; }
.lb-val   { font-size: 9px; color: var(--text-lo); width: 28px; text-align: right; flex-shrink: 0; font-variant-numeric: tabular-nums; }

.biz-row { display: flex; flex-wrap: wrap; gap: 10px; }
.biz-card {
  flex: 1 1 100px; min-width: 100px; max-width: 180px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 10px; padding: 14px 16px; text-align: center;
  transition: border-color .2s;
}
.biz-card.biz-warn { border-color: rgba(245,158,11,.35); }
.biz-icon { font-size: 1.2rem; margin-bottom: 6px; }
.biz-num  { font-size: 1.6rem; font-weight: 800; color: var(--text-hi); line-height: 1; font-variant-numeric: tabular-nums; }
.biz-num.warn { color: #f59e0b; }
.biz-num.ok   { color: #22c55e; }
.biz-label { font-size: 10px; color: var(--text-lo); margin-top: 5px; letter-spacing: .04em; }

.charts-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.chart-card {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 12px; padding: 14px 16px;
}
.chart-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.chart-title { font-size: 10px; font-weight: 700; color: var(--text-lo); letter-spacing: .08em; text-transform: uppercase; }
.chart-loading-badge { font-size: 9px; color: #f59e0b; }
.chart-canvas { height: 160px; }

.info-card { margin: 0; }
.install-code {
  background: var(--bg-deep); border-radius: 8px; padding: 14px;
  font-size: 11px; line-height: 1.7; color: var(--text-md);
  overflow-x: auto; white-space: pre-wrap; word-break: break-all;
  border: 1px solid var(--border); margin: 0;
}

@media (max-width: 900px) {
  .charts-grid { grid-template-columns: 1fr; }
}
@media (max-width: 600px) {
  .cards-row { grid-template-columns: repeat(2, 1fr); }
  .biz-card { max-width: none; }
}
</style>
