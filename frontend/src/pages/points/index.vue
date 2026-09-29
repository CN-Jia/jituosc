<template>
  <div class="points-wrap">
    <div class="page-banner">
      <div class="page-banner-inner">
        <h1 class="page-banner-title">我的积分</h1>
        <p class="page-banner-sub">邀请好友、完成订单即可获得积分</p>
      </div>
    </div>
    <div class="page-container">
    <div class="page-header">
      <span></span>
      <router-link to="/points/shop" class="btn btn-primary">积分商城</router-link>
    </div>

    <!-- 余额卡片 -->
    <div class="balance-cards">
      <div class="balance-card available">
        <div class="balance-label">可用积分</div>
        <div class="balance-value">{{ balance.totalPoints.toLocaleString() }}</div>
      </div>
      <div class="balance-card frozen">
        <div class="balance-label">冻结中</div>
        <div class="balance-value">{{ balance.frozenPoints.toLocaleString() }}</div>
      </div>
      <div class="balance-card lifetime">
        <div class="balance-label">累计获得</div>
        <div class="balance-value">{{ balance.lifetimeEarned.toLocaleString() }}</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tab-bar">
      <button :class="['tab-btn', tab === 'logs' && 'active']" @click="tab = 'logs'">积分明细</button>
      <button :class="['tab-btn', tab === 'redeem' && 'active']" @click="tab = 'redeem'; loadRedeems()">兑换记录</button>
    </div>

    <!-- 积分明细 -->
    <div v-if="tab === 'logs'">
      <div v-if="logs.length === 0 && !logsLoading" class="empty-state">暂无积分记录</div>
      <div class="log-list">
        <div v-for="log in logs" :key="log.id" class="log-item">
          <div class="log-left">
            <span class="log-event-badge" :class="eventClass(log.eventType)">{{ eventLabel(log.eventType) }}</span>
            <span class="log-remark">{{ log.remark || '' }}</span>
          </div>
          <div class="log-right">
            <span class="log-delta" :class="log.delta > 0 ? 'positive' : 'negative'">
              {{ log.delta > 0 ? '+' : '' }}{{ log.delta }}
            </span>
            <span class="log-time">{{ formatDate(log.createdAt) }}</span>
          </div>
        </div>
      </div>
      <div v-if="logsTotal > logs.length" class="load-more">
        <button class="btn btn-secondary" @click="loadMoreLogs" :disabled="logsLoading">加载更多</button>
      </div>
    </div>

    <!-- 兑换记录 -->
    <div v-if="tab === 'redeem'">
      <div v-if="redeems.length === 0" class="empty-state">暂无兑换记录</div>
      <div class="redeem-list">
        <div v-for="r in redeems" :key="r.id" class="redeem-item card">
          <div class="redeem-header">
            <div class="redeem-title-row">
              <span v-if="r.isWheelPrize" class="wheel-badge">🎰 转盘</span>
              <span class="redeem-name">{{ r.shopItem?.name ?? r.prizeName ?? '转盘奖品' }}</span>
            </div>
            <span class="redeem-status" :class="redeemStatusClass(r.status)">{{ redeemStatusLabel(r.status) }}</span>
          </div>
          <div class="redeem-meta">
            <span>{{ r.pointsCost > 0 ? `消耗 ${r.pointsCost} 积分` : '转盘中奖' }}</span>
            <span>{{ formatDate(r.createdAt) }}</span>
          </div>
          <div v-if="r.adminNote" class="redeem-note">备注：{{ r.adminNote }}</div>
          <!-- 折扣券（ORDER_DISCOUNT） -->
          <div v-if="r.coupon" class="coupon-chip">
            <span class="coupon-label">折扣券</span>
            <strong>{{ r.coupon.code }}</strong>
            <span v-if="r.coupon.discountAmt"> · 面值 ¥{{ r.coupon.discountAmt }}</span>
            · 有效期至 {{ formatDate(r.coupon.expiresAt) }}
          </div>
          <!-- 现金大奖兑换码（CASH_REDEEM） -->
          <div v-if="r.redeemCode" class="coupon-chip cash-chip">
            <span class="coupon-label">兑换码</span>
            <strong>{{ r.redeemCode }}</strong>
            <span :class="r.isRedeemed ? 'badge-used' : 'badge-unused'">
              {{ r.isRedeemed ? '已核销' : '待核销' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../../api'

const balance = ref({ totalPoints: 0, frozenPoints: 0, lifetimeEarned: 0 })
const logs = ref<any[]>([])
const logsTotal = ref(0)
const logsPage = ref(1)
const logsLoading = ref(false)
const redeems = ref<any[]>([])
const tab = ref<'logs' | 'redeem'>('logs')

const EVENT_LABELS: Record<string, string> = {
  INVITE_REGISTER: '邀请注册',
  INVITE_FIRST_ORDER: '拉新首购',
  NEW_USER_FIRST_ORDER: '首购奖励',
  ADMIN_ADJUST: '管理调整',
  REDEEM_FREEZE: '兑换冻结',
  REDEEM_DEDUCT: '兑换扣减',
  REDEEM_UNFREEZE: '解冻归还',
}

function eventLabel(type: string) { return EVENT_LABELS[type] ?? type }
function eventClass(type: string) {
  if (['INVITE_REGISTER', 'INVITE_FIRST_ORDER', 'NEW_USER_FIRST_ORDER'].includes(type)) return 'badge-green'
  if (type === 'ADMIN_ADJUST') return 'badge-blue'
  return 'badge-gray'
}
function redeemStatusLabel(s: string) {
  return { PENDING: '待审核', COMPLETED: '已完成', REJECTED: '已拒绝' }[s] ?? s
}
function redeemStatusClass(s: string) {
  return { PENDING: 'status-pending', COMPLETED: 'status-success', REJECTED: 'status-danger' }[s] ?? ''
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

async function loadBalance() {
  const res: any = await api.getPointBalance()
  balance.value = res.data
}

async function loadLogs() {
  logsLoading.value = true
  try {
    const res: any = await api.getPointLogs({ page: 1, pageSize: 20 })
    logs.value = res.data.list
    logsTotal.value = res.data.total
    logsPage.value = 1
  } finally {
    logsLoading.value = false
  }
}

async function loadMoreLogs() {
  logsLoading.value = true
  try {
    const res: any = await api.getPointLogs({ page: logsPage.value + 1, pageSize: 20 })
    logs.value.push(...res.data.list)
    logsPage.value++
  } finally {
    logsLoading.value = false
  }
}

async function loadRedeems() {
  const res: any = await api.getMyRedeems()
  redeems.value = res.data.list
}

onMounted(() => {
  loadBalance()
  loadLogs()
})
</script>

<style scoped>
.points-wrap { background: var(--bg); min-height: calc(100vh - var(--nav-h)); }
.page-banner {
  background: linear-gradient(135deg, #060d1f 0%, #0f1f4d 55%, #1e3a5f 100%);
  padding: 40px 32px 36px; text-align: center;
}
.page-banner-inner { max-width: 800px; margin: 0 auto; }
.page-banner-title { font-size: 28px; font-weight: 900; color: #fff; margin-bottom: 6px; }
.page-banner-sub { font-size: 14px; color: rgba(255,255,255,0.55); }

.page-header { display: flex; justify-content: flex-end; align-items: center; margin-bottom: 20px; }

.balance-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
.balance-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 16px; text-align: center; }
.balance-card.available { border-color: var(--primary); background: linear-gradient(135deg, var(--primary) 0%, #5b8cff 100%); color: #fff; }
.balance-card.available .balance-label, .balance-card.available .balance-value { color: #fff; }
.balance-label { font-size: 12px; color: var(--text-3); margin-bottom: 6px; }
.balance-value { font-size: 26px; font-weight: 800; color: var(--text-1); }

.tab-bar { display: flex; gap: 4px; border-bottom: 1px solid var(--border); margin-bottom: 20px; }
.tab-btn { padding: 8px 16px; border: none; background: none; cursor: pointer; color: var(--text-3); font-size: 14px; border-bottom: 2px solid transparent; transition: all .2s; }
.tab-btn.active { color: var(--primary); border-bottom-color: var(--primary); }

.log-list { display: flex; flex-direction: column; gap: 10px; }
.log-item { display: flex; justify-content: space-between; align-items: flex-start; padding: 12px 16px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; }
.log-left { display: flex; flex-direction: column; gap: 4px; }
.log-right { text-align: right; flex-shrink: 0; margin-left: 12px; }
.log-remark { font-size: 12px; color: var(--text-3); }
.log-delta { font-size: 16px; font-weight: 700; }
.log-delta.positive { color: #22c55e; }
.log-delta.negative { color: #ef4444; }
.log-time { font-size: 11px; color: var(--text-3); display: block; margin-top: 2px; }

.badge-green { background: #dcfce7; color: #16a34a; }
.badge-blue { background: #dbeafe; color: #2563eb; }
.badge-gray { background: var(--bg); color: var(--text-3); }
.log-event-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }

.load-more { text-align: center; margin-top: 16px; }

.redeem-list { display: flex; flex-direction: column; gap: 12px; }
.redeem-item { padding: 16px; }
.redeem-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; flex-wrap: wrap; gap: 8px; }
.redeem-title-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.redeem-name { font-weight: 600; color: var(--text-1); }
.wheel-badge { padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 700; background: linear-gradient(90deg, #7c3aed, #db2777); color: #fff; white-space: nowrap; }
.redeem-meta { font-size: 12px; color: var(--text-3); display: flex; gap: 16px; flex-wrap: wrap; }
.redeem-note { margin-top: 8px; font-size: 12px; color: var(--text-3); }
.coupon-chip { margin-top: 8px; padding: 6px 10px; background: rgba(234,179,8,0.1); border-radius: 6px; font-size: 12px; color: #fbbf24; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.cash-chip { background: rgba(124,58,237,0.12); color: #a78bfa; }
.coupon-label { padding: 1px 6px; border-radius: 4px; background: rgba(255,255,255,0.1); font-size: 11px; }
.badge-used { padding: 1px 8px; border-radius: 10px; background: #4ade80; color: #052e16; font-size: 11px; font-weight: 600; }
.badge-unused { padding: 1px 8px; border-radius: 10px; background: rgba(251,191,36,0.2); color: #fbbf24; font-size: 11px; font-weight: 600; }

.status-pending { background: rgba(251,191,36,0.1); color: #fbbf24; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
.status-success { background: rgba(52,211,153,0.1); color: #34d399; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
.status-danger { background: rgba(248,113,113,0.1); color: #f87171; padding: 2px 8px; border-radius: 4px; font-size: 12px; }

.coupon-list { display: flex; flex-direction: column; gap: 12px; }
.coupon-card { display: flex; align-items: center; gap: 16px; padding: 16px; background: linear-gradient(135deg, rgba(234,179,8,0.06), rgba(250,140,22,0.04)); border: 1px dashed rgba(245,158,11,0.3); border-radius: 12px; }
.coupon-amount { font-size: 2rem; font-weight: 700; color: #d97706; min-width: 80px; text-align: center; }
.coupon-info { flex: 1; }
.coupon-code { font-family: monospace; font-size: 1rem; font-weight: 700; letter-spacing: 2px; color: var(--text-1); }
.coupon-expire { font-size: 12px; color: var(--text-3); margin-top: 4px; }
.coupon-status { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
.cs-unused { background: #22c55e; color: #fff; }
.cs-used { background: #94a3b8; color: #fff; }
.cs-expired { background: #ef4444; color: #fff; }
.coupon-card--inactive { opacity: 0.55; filter: grayscale(0.4); }

.empty-state { text-align: center; padding: 48px 0; color: var(--text-3); }
@media (max-width: 600px) {
  .page-banner { padding: 28px 20px 24px; }
  .page-banner-title { font-size: 22px; }
  .balance-cards { grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .balance-value { font-size: 20px; }
  .log-item { flex-wrap: wrap; }
}

</style>
