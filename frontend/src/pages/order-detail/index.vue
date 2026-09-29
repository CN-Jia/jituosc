<template>
  <div class="detail-page">
    <div class="page-banner">
      <div class="page-banner-inner">
        <router-link to="/my-orders" class="banner-back">← 我的订单</router-link>
        <h1 class="page-banner-title">订单详情</h1>
      </div>
    </div>
    <div v-if="order" class="detail-inner">

      <div class="detail-layout">
        <!-- 主信息 -->
        <div class="main-col">
          <!-- 状态头部 -->
          <div class="status-header" :class="order.status">
            <div class="status-header-left">
              <div class="status-icon">{{ statusIcon(order.status) }}</div>
              <div>
                <div class="status-text">{{ statusLabel(order.status) }}</div>
                <div class="order-no-sm">{{ order.orderNo }}</div>
              </div>
            </div>
            <div class="created-at">{{ fmtDateTime(order.createdAt) }}</div>
          </div>

          <!-- 详情表格 -->
          <div class="info-table">
            <div class="info-row">
              <span class="info-key">课程名称</span>
              <span class="info-val bold">{{ order.courseName }}</span>
            </div>
            <div class="info-row">
              <span class="info-key">需求类型</span>
              <span class="info-val">{{ order.orderType?.name }}</span>
            </div>
            <div class="info-row">
              <span class="info-key">参考价格</span>
              <span class="info-val">{{ order.orderType?.price }}</span>
            </div>
            <div class="info-row">
              <span class="info-key">年级</span>
              <span class="info-val">{{ gradeLabel(order.grade) }}</span>
            </div>
            <div class="info-row">
              <span class="info-key">截止日期</span>
              <span class="info-val">{{ fmtDate(order.deadline) }}</span>
            </div>
            <div class="info-row">
              <span class="info-key">联系微信</span>
              <span class="info-val">{{ order.contactWechat }}</span>
            </div>
            <!-- 免费兑换标识 -->
            <div v-if="order.redeemService?.isFree" class="info-row free-row">
              <span class="info-key">服务套餐</span>
              <span class="info-val"><span class="free-badge">🎁 积分兑换 · 免费</span></span>
            </div>
            <!-- 折扣服务标识 -->
            <div v-else-if="order.redeemService && order.redeemService.discountAmt > 0" class="info-row discount-row">
              <span class="info-key">服务套餐</span>
              <span class="info-val">
                <span class="discount-badge">优惠 −¥{{ order.redeemService.discountAmt }}</span>
                {{ order.redeemService.name }}
              </span>
            </div>
            <!-- 管理员报价（免费订单不显示） -->
            <div v-if="order.quotedPrice && order.quotedPrice !== '0'" class="info-row highlight">
              <span class="info-key">实付金额</span>
              <span class="info-val price">¥{{ order.quotedPrice }}</span>
            </div>
          </div>
        </div>

        <!-- 侧边栏 -->
        <aside class="side-col">
          <!-- 免费订单提示卡 -->
          <div v-if="order.redeemService?.isFree" class="side-card free-card">
            <div class="side-title">🎁 积分兑换免费订单</div>
            <p class="side-desc">本订单通过积分兑换服务套餐，<strong>无需付款</strong>，管理员接单后直接开始处理。</p>
          </div>
          <!-- 折扣服务提示卡 -->
          <div v-else-if="order.redeemService && order.redeemService.discountAmt > 0" class="side-card discount-card">
            <div class="side-title">🏷️ 折扣服务已应用</div>
            <p class="side-desc">已为本订单应用服务套餐优惠 <strong>−¥{{ order.redeemService.discountAmt }}</strong>，管理员报价后自动显示优惠后价格。</p>
          </div>
          <div class="side-card">
            <div class="side-title">💬 联系管理员</div>
            <p class="side-desc">有任何问题，请直接联系管理员微信</p>
            <div class="wechat-box" @click="copyWechat">
              <div>
                <div class="wechat-label-sm">管理员微信</div>
                <div class="wechat-id">{{ adminWechat }}</div>
              </div>
              <div class="copy-pill">复制</div>
            </div>
          </div>

          <div class="side-card status-card">
            <div class="side-title">状态变更记录</div>
            <div v-if="order.statusHistory && order.statusHistory.length" class="timeline">
              <div v-for="(h, i) in order.statusHistory" :key="h.id"
                class="tl-item"
                :class="{ 'tl-last': i === order.statusHistory.length - 1 }">
                <div class="tl-dot" :class="i === order.statusHistory.length - 1 ? 'tl-dot-active' : 'tl-dot-done'"></div>
                <div class="tl-body">
                  <div class="tl-status">{{ statusLabel(h.toStatus) }}</div>
                  <div class="tl-time">{{ fmtDateTime(h.createdAt) }}</div>
                  <div v-if="h.remark" class="tl-remark">{{ h.remark }}</div>
                </div>
              </div>
            </div>
            <div v-else class="status-list">
              <div v-for="s in statusFlow" :key="s.key"
                class="status-node"
                :class="{ active: order.status === s.key, passed: isPassed(s.key, order.status) }">
                <div class="sn-dot"></div>
                <span>{{ s.label }}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
    <div v-else class="loading-state">
      <div class="loader"></div>
      <span>加载中...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../../api'

const route = useRoute()
const order = ref<any>(null)
const adminWechat = ref('Jt--04')

const statusLabels: Record<string,string> = { CREATED:'已创建', PENDING:'待处理', ACCEPTED:'已接单', IN_PROGRESS:'进行中', COMPLETED:'已完成', CLOSED:'已关闭', CANCELLED:'已取消' }
const gradeLabels: Record<string,string> = { FRESHMAN:'大一', SOPHOMORE:'大二', JUNIOR:'大三' }
const statusFlow = [
  { key: 'CREATED', label: '已创建' },
  { key: 'PENDING', label: '待处理' },
  { key: 'ACCEPTED', label: '已接单' },
  { key: 'IN_PROGRESS', label: '进行中' },
  { key: 'COMPLETED', label: '已完成' },
]
const flowOrder = statusFlow.map(s => s.key)

const statusLabel = (s: string) => statusLabels[s] ?? s
const gradeLabel = (g: string) => gradeLabels[g] ?? g
const fmtDate = (d: string) => new Date(d).toLocaleDateString('zh-CN')
const fmtDateTime = (d: string) => new Date(d).toLocaleString('zh-CN')
const statusIcon = (s: string) => ({ CREATED:'📝', PENDING:'⏳', ACCEPTED:'✅', IN_PROGRESS:'🔨', COMPLETED:'🎉', CLOSED:'🔒', CANCELLED:'❌' }[s] ?? '📋')
const isPassed = (key: string, current: string) => flowOrder.indexOf(key) < flowOrder.indexOf(current)

onMounted(async () => {
  try {
    const [orderRes, configRes]: any[] = await Promise.all([api.getOrder(route.params.id as string), api.getConfig()])
    order.value = orderRes.data
    if (configRes.data?.adminWechatId) adminWechat.value = configRes.data.adminWechatId
  } catch { history.back() }
})

function copyWechat() { navigator.clipboard.writeText(adminWechat.value).then(() => alert(`✅ 已复制 ${adminWechat.value}`)) }
</script>

<style scoped>
.page-banner {
  background: linear-gradient(135deg, #060d1f 0%, #0f1f4d 55%, #1e3a5f 100%);
  padding: 28px 32px;
}
.page-banner-inner { max-width: 1000px; margin: 0 auto; }
.banner-back { font-size: 13px; color: rgba(255,255,255,0.5); display: block; margin-bottom: 6px; transition: color 0.15s; }
.banner-back:hover { color: rgba(255,255,255,0.9); }
.page-banner-title { font-size: 22px; font-weight: 800; color: #fff; }

.detail-page { background: var(--bg); min-height: calc(100vh - var(--nav-h)); }
.detail-inner { max-width: 1000px; margin: 0 auto; padding: 24px 32px 80px; }

@media (max-width: 640px) {
  .page-banner { padding: 20px 16px; }
  .page-banner-title { font-size: 18px; }
  .detail-inner { padding: 16px 14px 80px; }
  .status-header { padding: 16px 16px; flex-direction: column; align-items: flex-start; gap: 8px; }
  .status-text { font-size: 17px; }
  .info-row { padding: 12px 16px; flex-direction: column; align-items: flex-start; gap: 4px; }
  .info-val { text-align: left; }
  .info-val.price { font-size: 18px; }
  .side-card { padding: 16px; }
}
.breadcrumb { margin-bottom: 20px; }
.bc-back { font-size: 14px; color: var(--text-3); transition: color 0.15s; }
.bc-back:hover { color: var(--primary); }

.detail-layout { display: grid; grid-template-columns: 1fr 280px; gap: 24px; align-items: start; }
@media (max-width: 768px) { .detail-layout { grid-template-columns: 1fr; } }

/* ─── 状态头 ─── */
.status-header {
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: 24px 28px; display: flex; align-items: center; justify-content: space-between;
}
.PENDING.status-header  { background: rgba(250,140,22,0.1); }
.ACCEPTED.status-header { background: rgba(59,130,246,0.1); }
.IN_PROGRESS.status-header { background: rgba(19,194,194,0.1); }
.COMPLETED.status-header { background: rgba(52,211,153,0.1); }
.CLOSED.status-header    { background: rgba(255,255,255,0.04); }
.status-header-left { display: flex; align-items: center; gap: 14px; }
.status-icon { font-size: 32px; }
.status-text { font-size: 20px; font-weight: 800; color: var(--text-1); }
.order-no-sm { font-size: 13px; color: var(--text-3); margin-top: 2px; font-family: monospace; }
.created-at { font-size: 13px; color: var(--text-3); }

/* ─── 详情表格 ─── */
.info-table { background: var(--card); border-radius: 0 0 var(--radius-lg) var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm); }
.info-row { display: flex; justify-content: space-between; align-items: center; padding: 16px 28px; border-bottom: 1px solid var(--border); }
.info-row:last-child { border-bottom: none; }
.info-row.highlight { background: var(--primary-light); }
.info-row.free-row { background: rgba(52,211,153,0.06); }
.info-row.discount-row { background: rgba(250,140,22,0.06); }
.free-badge { background: #52c41a; color: #fff; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 12px; }
.discount-badge { background: #fa8c16; color: #fff; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 12px; margin-right: 6px; }
.info-key { font-size: 14px; color: var(--text-3); font-weight: 500; }
.info-val { font-size: 15px; color: var(--text-1); text-align: right; }
.info-val.bold { font-weight: 700; font-size: 16px; }
.info-val.price { font-size: 22px; font-weight: 900; color: var(--primary); }

.free-card { border: 1.5px solid rgba(52,211,153,0.3); background: rgba(52,211,153,0.06); }
.discount-card { border: 1.5px solid rgba(250,140,22,0.3); background: rgba(250,140,22,0.06); }

/* ─── 侧边栏 ─── */
.side-col { display: flex; flex-direction: column; gap: 16px; }
.side-card { background: var(--card); border-radius: var(--radius-lg); padding: 24px; box-shadow: var(--shadow-sm); }
.side-title { font-size: 15px; font-weight: 700; color: var(--text-1); margin-bottom: 10px; }
.side-desc { font-size: 13px; color: var(--text-3); margin-bottom: 16px; }
.wechat-box { background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: background 0.15s; }
.wechat-box:hover { background: var(--primary-light); }
.wechat-label-sm { font-size: 11px; color: var(--text-3); margin-bottom: 4px; }
.wechat-id { font-size: 18px; font-weight: 800; color: var(--text-1); }
.copy-pill { background: var(--primary); color: #fff; font-size: 12px; padding: 5px 12px; border-radius: 6px; }

/* 状态流程 */
.status-card { }
.status-list { display: flex; flex-direction: column; gap: 12px; margin-top: 4px; }
.status-node { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--text-3); }
.sn-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--border); border: 2px solid var(--border); flex-shrink: 0; transition: all 0.2s; }
.status-node.passed .sn-dot { background: var(--success); border-color: var(--success); }
.status-node.passed { color: var(--text-2); }
.status-node.active .sn-dot { background: var(--primary); border-color: var(--primary); box-shadow: 0 0 0 4px rgba(22,119,255,0.2); }
.status-node.active { color: var(--primary); font-weight: 700; }

/* ─── 时间线 ─── */
.timeline { display: flex; flex-direction: column; gap: 0; margin-top: 4px; }
.tl-item { display: flex; gap: 10px; position: relative; padding-bottom: 16px; }
.tl-item.tl-last { padding-bottom: 0; }
.tl-item::before {
  content: ''; position: absolute; left: 5px; top: 14px;
  width: 2px; bottom: 0; background: var(--border);
}
.tl-last::before { display: none; }
.tl-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; margin-top: 3px; z-index: 1; }
.tl-dot-done { background: var(--success); }
.tl-dot-active { background: var(--primary); box-shadow: 0 0 0 4px rgba(22,119,255,0.15); }
.tl-body { flex: 1; }
.tl-status { font-size: 14px; font-weight: 600; color: var(--text-1); }
.tl-time { font-size: 12px; color: var(--text-3); margin-top: 2px; }
.tl-remark { font-size: 12px; color: var(--text-2); margin-top: 4px; background: rgba(255,255,255,0.04); border-radius: 4px; padding: 4px 8px; }

/* ─── 加载 ─── */
.loading-state { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 120px 0; color: var(--text-3); font-size: 15px; }
.loader { width: 36px; height: 36px; border: 3px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

</style>
