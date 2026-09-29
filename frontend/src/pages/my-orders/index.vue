<template>
  <div class="orders-page">
    <!-- 页头 Banner -->
    <div class="page-banner">
      <div class="page-banner-inner">
        <h1 class="page-banner-title">我的订单</h1>
        <p class="page-banner-sub">查看和跟踪所有需求进度</p>
      </div>
    </div>
    <div class="orders-inner">
      <div class="page-head">
        <span class="orders-count" v-if="!loading && orders.length">共 {{ orders.length }} 条</span>
        <router-link to="/submit" class="btn-new">+ 提交新需求</router-link>
      </div>

      <div v-if="loading" class="skeleton-list">
        <div class="skeleton-order" v-for="i in 3" :key="i"></div>
      </div>
      <div v-else-if="orders.length === 0" class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-title">暂无订单</div>
        <div class="empty-desc">提交您的第一个需求</div>
        <router-link to="/submit" class="empty-btn">去提交需求</router-link>
      </div>
      <div v-else class="order-list">
        <router-link
          v-for="o in orders"
          :key="o.id"
          :to="`/my-orders/${o.id}`"
          class="order-card"
        >
          <div class="card-left">
            <div class="order-status-bar" :class="o.status"></div>
            <div class="order-main">
              <div class="order-course">{{ o.courseName }}</div>
              <div class="order-meta">
                <span class="meta-type">{{ o.orderType?.name }}</span>
                <span class="meta-sep">·</span>
                <span>截止 {{ fmtDate(o.deadline) }}</span>
              </div>
              <div class="order-no">{{ o.orderNo }}</div>
            </div>
          </div>
          <div class="card-right">
            <div v-if="o.quotedPrice === '0'" class="order-price free-price">🎁 免费</div>
            <div v-else-if="o.quotedPrice" class="order-price">¥{{ o.quotedPrice }}</div>
            <span class="order-status-badge" :class="o.status">{{ statusLabel(o.status) }}</span>
            <span class="card-arrow">›</span>
          </div>
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../../api'

const orders = ref<any[]>([])
const loading = ref(true)
const statusLabels: Record<string,string> = { CREATED:'已创建', PENDING:'待处理', ACCEPTED:'已接单', IN_PROGRESS:'进行中', COMPLETED:'已完成', CLOSED:'已关闭', CANCELLED:'已取消' }
const statusLabel = (s: string) => statusLabels[s] ?? s
const fmtDate = (d: string) => new Date(d).toLocaleDateString('zh-CN')

onMounted(async () => {
  try { const res: any = await api.getMyOrders(); orders.value = res.data?.list ?? [] }
  finally { loading.value = false }
})
</script>

<style scoped>
/* ── Banner ── */
.page-banner {
  background: linear-gradient(135deg, #060d1f 0%, #0f1f4d 55%, #1e3a5f 100%);
  padding: 40px 32px 36px; text-align: center;
}
.page-banner-inner { max-width: 800px; margin: 0 auto; }
.page-banner-title { font-size: 28px; font-weight: 900; color: #fff; margin-bottom: 6px; }
.page-banner-sub { font-size: 14px; color: rgba(255,255,255,0.55); }

.orders-page { background: var(--bg); min-height: calc(100vh - var(--nav-h)); }
.orders-inner { max-width: 800px; margin: 0 auto; padding: 28px 24px 80px; }
.page-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
.orders-count { font-size: 13px; color: var(--text-3); }

@media (max-width: 640px) {
  .page-banner { padding: 28px 20px 24px; }
  .page-banner-title { font-size: 22px; }
  .orders-inner { padding: 16px 14px 80px; }
  .order-main { padding: 14px 14px 14px 14px; }
  .order-course { font-size: 15px; }
  .card-right { padding: 14px 14px; }
}
.btn-new { background: var(--primary); color: #fff; border-radius: 9px; padding: 9px 20px; font-size: 14px; font-weight: 600; transition: background 0.15s; }
.btn-new:hover { background: var(--primary-dark); }

.skeleton-list { display: flex; flex-direction: column; gap: 12px; }
.skeleton-order { height: 88px; border-radius: var(--radius); background: linear-gradient(90deg, #1c2333 25%, #252d3f 50%, #1c2333 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
@keyframes shimmer { to { background-position: -200% 0; } }

.empty-state { text-align: center; padding: 80px 0; }
.empty-icon { font-size: 56px; margin-bottom: 16px; }
.empty-title { font-size: 20px; font-weight: 700; color: var(--text-1); margin-bottom: 8px; }
.empty-desc { font-size: 14px; color: var(--text-3); margin-bottom: 24px; }
.empty-btn { display: inline-block; background: var(--primary); color: #fff; border-radius: 9px; padding: 11px 24px; font-size: 14px; font-weight: 600; }

.order-list { display: flex; flex-direction: column; gap: 12px; }
.order-card {
  background: var(--card); border-radius: var(--radius-lg);
  display: flex; align-items: center; justify-content: space-between;
  overflow: hidden; box-shadow: var(--shadow-sm);
  transition: box-shadow 0.2s, transform 0.2s;
}
.order-card:hover { box-shadow: var(--shadow); transform: translateY(-2px); }
.card-left { display: flex; align-items: stretch; flex: 1; min-width: 0; }
.order-status-bar { width: 4px; flex-shrink: 0; }
.PENDING .order-status-bar  { background: #fa8c16; }
.ACCEPTED .order-status-bar { background: var(--primary); }
.IN_PROGRESS .order-status-bar { background: #13c2c2; }
.COMPLETED .order-status-bar { background: var(--success); }
.CLOSED .order-status-bar    { background: #30363d; }
.order-main { padding: 20px 20px 20px 20px; flex: 1; min-width: 0; }
.order-course { font-size: 17px; font-weight: 700; color: var(--text-1); margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.order-meta { display: flex; gap: 8px; font-size: 13px; color: var(--text-3); margin-bottom: 6px; flex-wrap: wrap; }
.meta-type { background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 5px; color: var(--text-2); }
.meta-sep { color: var(--border); }
.order-no { font-size: 12px; color: var(--text-3); font-family: monospace; }
.card-right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; padding: 20px 20px; flex-shrink: 0; }
.order-price { font-size: 15px; font-weight: 800; color: var(--primary); }
.free-price { color: #52c41a; }
.order-status-badge { font-size: 12px; padding: 4px 10px; border-radius: 20px; font-weight: 600; white-space: nowrap; }
.PENDING .order-status-badge  { background: rgba(250,140,22,0.12); color: #ffa940; }
.ACCEPTED .order-status-badge { background: rgba(59,130,246,0.12); color: #60a5fa; }
.IN_PROGRESS .order-status-badge { background: rgba(19,194,194,0.12); color: #36cfc9; }
.COMPLETED .order-status-badge { background: rgba(52,211,153,0.12); color: #34d399; }
.CLOSED .order-status-badge    { background: rgba(255,255,255,0.06); color: #8b949e; }
.card-arrow { font-size: 20px; color: var(--text-3); }
.PENDING .order-status-bar  { background: #ffa940; }
.IN_PROGRESS .order-status-bar { background: #36cfc9; }
</style>
