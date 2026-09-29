<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">积分商城</h1>
        <p class="page-sub">用积分兑换免费服务或折扣服务套餐</p>
      </div>
      <div class="my-balance">
        <span class="balance-label">可用积分</span>
        <span class="balance-num">{{ balance }}</span>
        <router-link to="/points" class="btn btn-secondary btn-sm">明细</router-link>
      </div>
    </div>

    <!-- 类型筛选 -->
    <div class="filter-bar">
      <button :class="['filter-btn', filter === '' && 'active']" @click="filter = ''; loadItems()">全部</button>
      <button :class="['filter-btn', filter === 'SERVICE' && 'active']" @click="filter = 'SERVICE'; loadItems()">服务套餐</button>
    </div>

    <div v-if="loading" class="loading-state">加载中…</div>
    <div v-else-if="items.length === 0" class="empty-state">暂无可兑换商品</div>

    <div class="shop-grid">
      <div v-for="item in items" :key="item.id" class="shop-card">
        <div v-if="item.coverUrl" class="shop-cover">
          <img :src="item.coverUrl" :alt="item.name" />
        </div>
        <div v-else class="shop-cover shop-cover-placeholder">
          <span>📚</span>
        </div>
        <div class="shop-body">
          <div v-if="!item.discountAmt || Number(item.discountAmt) === 0"
               class="shop-type-badge type-free">🎁 免费兑换</div>
          <div v-else class="shop-type-badge type-discount">🏷️ 折扣服务 −¥{{ item.discountAmt }}</div>
          <div class="shop-name">{{ item.name }}</div>
          <div v-if="item.description" class="shop-desc">{{ item.description }}</div>
          <div v-if="item.discountAmt && Number(item.discountAmt) > 0" class="shop-discount">
            报价时自动抵扣 <strong>¥{{ item.discountAmt }}</strong>
          </div>
          <div class="shop-footer">
            <div class="shop-cost">
              <span class="cost-num">{{ item.pointsCost.toLocaleString() }}</span>
              <span class="cost-unit">积分</span>
            </div>
            <div class="shop-stock" v-if="item.stock >= 0">
              <span :class="item.stock === 0 ? 'stock-out' : 'stock-in'">
                {{ item.stock === 0 ? '已售罄' : `剩余 ${item.stock}` }}
              </span>
            </div>
            <button
              class="btn btn-primary btn-sm"
              :disabled="item.stock === 0 || balance < item.pointsCost || submitting === item.id"
              @click="handleRedeem(item)"
            >
              {{ balance < item.pointsCost ? '积分不足' : '立即兑换' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 确认弹窗 -->
    <div v-if="confirmItem" class="modal-overlay" @click.self="confirmItem = null">
      <div class="modal">
        <h3 class="modal-title">确认兑换</h3>
        <p>确定用 <strong>{{ confirmItem.pointsCost }}</strong> 积分兑换「{{ confirmItem.name }}」？</p>
        <p class="modal-note" v-if="!confirmItem.discountAmt || Number(confirmItem.discountAmt) === 0">
          🎁 兑换后提交订单将<strong>完全免费</strong>，无需付款。积分立即扣除。
        </p>
        <p class="modal-note" v-else>
          🏷️ 兑换后提交订单时，管理员报价将自动扣减 ¥{{ confirmItem.discountAmt }}。积分立即扣除。
        </p>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="confirmItem = null">取消</button>
          <button class="btn btn-primary" :disabled="submitting === confirmItem.id" @click="submitRedeem">
            {{ submitting === confirmItem.id ? '提交中…' : '确认兑换' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../../api'

const items = ref<any[]>([])
const balance = ref(0)
const filter = ref('')
const loading = ref(false)
const submitting = ref<string | null>(null)
const confirmItem = ref<any>(null)
const message = ref('')

async function loadItems() {
  loading.value = true
  try {
    const params: any = {}
    if (filter.value) params.type = filter.value
    const res: any = await api.getShopItems(params)
    items.value = res.data.list
  } finally {
    loading.value = false
  }
}

async function loadBalance() {
  try {
    const res: any = await api.getPointBalance()
    balance.value = res.data.totalPoints
  } catch {}
}

function handleRedeem(item: any) {
  confirmItem.value = item
}

async function submitRedeem() {
  if (!confirmItem.value) return
  submitting.value = confirmItem.value.id
  try {
    await api.submitRedeem(confirmItem.value.id)
    await loadBalance()
    await loadItems()
    const item = confirmItem.value
    confirmItem.value = null
    const isFree = !item.discountAmt || Number(item.discountAmt) === 0
    alert(isFree ? '兑换成功！提交订单时选择此服务套餐即可免费使用。' : `兑换成功！提交订单时选择此服务套餐，自动抵扣 ¥${item.discountAmt}。`)
  } catch (err: any) {
    alert(err?.message ?? '兑换失败，请稍后重试')
  } finally {
    submitting.value = null
  }
}

onMounted(() => {
  loadItems()
  loadBalance()
})
</script>

<style scoped>
.page-container { max-width: 900px; margin: 0 auto; padding: 24px 16px; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
.page-title { font-size: 24px; font-weight: 800; color: var(--text-1); }
.page-sub { color: var(--text-3); font-size: 13px; margin-top: 4px; }
.my-balance { display: flex; align-items: center; gap: 10px; }
.balance-label { font-size: 12px; color: var(--text-3); }
.balance-num { font-size: 22px; font-weight: 800; color: var(--primary); }

.filter-bar { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
.filter-btn { padding: 6px 16px; border: 1px solid var(--border); border-radius: 20px; background: var(--card-bg); color: var(--text-2); cursor: pointer; font-size: 13px; transition: all .2s; }
.filter-btn.active { border-color: var(--primary); background: var(--primary); color: #fff; }

.shop-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
.shop-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; transition: transform .2s, box-shadow .2s; }
.shop-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,.08); }
.shop-cover { height: 140px; overflow: hidden; background: var(--bg); }
.shop-cover img { width: 100%; height: 100%; object-fit: cover; }
.shop-cover-placeholder { display: flex; align-items: center; justify-content: center; font-size: 3rem; }
.shop-body { padding: 16px; }
.shop-type-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; margin-bottom: 8px; }
.type-service { background: rgba(37,99,235,0.15); color: #60a5fa; }
.type-free { background: rgba(22,163,74,0.15); color: #4ade80; }
.type-discount { background: rgba(217,119,6,0.12); color: #fbbf24; }
.shop-name { font-size: 15px; font-weight: 600; color: var(--text-1); margin-bottom: 6px; }
.shop-desc { font-size: 12px; color: var(--text-3); margin-bottom: 8px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.shop-discount { font-size: 13px; color: #fbbf24; margin-bottom: 8px; }
.shop-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.shop-cost { display: flex; align-items: baseline; gap: 4px; }
.cost-num { font-size: 20px; font-weight: 800; color: var(--primary); }
.cost-unit { font-size: 12px; color: var(--text-3); }
.shop-stock { font-size: 12px; }
.stock-out { color: #ef4444; }
.stock-in { color: #22c55e; }

.btn-sm { padding: 6px 14px; font-size: 13px; }
.loading-state, .empty-state { text-align: center; padding: 48px; color: var(--text-3); }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; }
.modal { background: var(--card-bg); border-radius: 16px; padding: 24px; max-width: 400px; width: 100%; }
.modal-title { font-size: 17px; font-weight: 700; margin-bottom: 12px; color: var(--text-1); }
.modal-note { font-size: 12px; color: var(--text-3); margin-top: 8px; }
.modal-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px; }

@media (max-width: 640px) {
  .shop-grid { grid-template-columns: 1fr; }
}

.shop-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,.3); }
</style>
