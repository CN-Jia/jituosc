<template>
  <div class="result-page">
    <div class="result-card">
      <div class="success-anim">
        <div class="success-ring ring-3"></div>
        <div class="success-ring ring-2"></div>
        <div class="success-ring ring-1"></div>
        <div class="success-core">✓</div>
      </div>
      <h1 class="result-title">提交成功！</h1>
      <p class="result-sub">请保存您的订单号，并按照以下步骤完成后续操作</p>

      <div class="order-no-box">
        <div class="order-no-label">订 单 号</div>
        <div class="order-no">{{ orderNo }}</div>
        <button class="copy-btn" @click="copyOrderNo">复制订单号</button>
      </div>

      <!-- 免费订单专属提示 -->
      <div v-if="isFree" class="free-notice">
        🎁 本订单通过积分兑换服务套餐，<strong>完全免费</strong>，无需付款！
      </div>

      <div class="steps-card">
        <div class="steps-title">📌 接下来需要做什么？</div>
        <div class="steps">
          <div class="step-item">
            <div class="step-dot">1</div>
            <div class="step-body">
              <div class="step-main">添加管理员微信
                <strong class="wechat-btn" @click="copyWechat">{{ adminWechat }}</strong>
                （点击复制）
              </div>
            </div>
          </div>
          <div class="step-item">
            <div class="step-dot">2</div>
            <div class="step-body">
              <div class="step-main">发消息备注订单号 <strong>{{ orderNo }}</strong></div>
            </div>
          </div>
          <div class="step-item">
            <div class="step-dot">3</div>
            <div class="step-body">
              <div v-if="isFree" class="step-main">等待管理员接单，<strong style="color:#52c41a">无需付款</strong>，直接开始处理</div>
              <div v-else class="step-main">等待管理员确认报价并处理</div>
            </div>
          </div>
        </div>
      </div>

      <div class="result-actions">
        <router-link to="/my-orders" class="btn-solid">查看我的订单</router-link>
        <router-link to="/" class="btn-outline">返回首页</router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
const route = useRoute()
const orderNo = computed(() => route.query.orderNo as string ?? '')
const adminWechat = computed(() => route.query.adminWechat as string ?? 'Jt--04')
const isFree = computed(() => route.query.free === '1')
function copyOrderNo() { navigator.clipboard.writeText(orderNo.value).then(() => alert('✅ 订单号已复制')) }
function copyWechat() { navigator.clipboard.writeText(adminWechat.value).then(() => alert(`✅ 已复制：${adminWechat.value}`)) }
</script>

<style scoped>
.result-page {
  min-height: calc(100vh - var(--nav-h)); display: flex; align-items: center; justify-content: center;
  padding: 48px 24px;
  background: linear-gradient(135deg, #060d1f 0%, #0f1f4d 55%, #1a2d5a 100%);
  position: relative; overflow: hidden;
}
.result-page::before {
  content: ''; position: absolute; inset: 0;
  background-image: radial-gradient(rgba(59,130,246,0.06) 1px, transparent 1px);
  background-size: 32px 32px; pointer-events: none;
}
.result-card {
  background: rgba(255,255,255,0.06);
  backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 24px; padding: 56px 48px; max-width: 560px; width: 100%; text-align: center;
  box-shadow: 0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08);
  position: relative; z-index: 1;
}

@media (max-width: 640px) {
  .result-page { padding: 20px 14px 80px; align-items: flex-start; }
  .result-card { padding: 28px 20px; border-radius: 16px; }
  .result-title { font-size: 24px; }
  .order-no { font-size: 20px; letter-spacing: 1px; }
  .result-actions { flex-direction: column; }
}

.success-anim { position: relative; width: 100px; height: 100px; margin: 0 auto 28px; }
.success-core {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, var(--primary), #4096ff);
  border-radius: 50%; color: #fff; font-size: 36px; font-weight: 900;
  box-shadow: 0 8px 32px rgba(22,119,255,0.35);
}
.success-ring {
  position: absolute; border-radius: 50%;
  border: 2px solid rgba(22,119,255,0.2);
  animation: ring-pulse 2s ease-out infinite;
}
.ring-1 { inset: -8px; animation-delay: 0s; }
.ring-2 { inset: -18px; animation-delay: 0.3s; }
.ring-3 { inset: -28px; animation-delay: 0.6s; }
@keyframes ring-pulse { 0% { opacity: 0.6; } 100% { opacity: 0; transform: scale(1.3); } }

.result-title { font-size: 32px; font-weight: 800; color: #fff; margin-bottom: 8px; }
.result-sub { font-size: 15px; color: rgba(255,255,255,0.5); margin-bottom: 32px; }

.order-no-box { background: var(--primary-light); border-radius: 14px; padding: 24px; margin-bottom: 24px; }
.order-no-label { font-size: 12px; font-weight: 600; color: var(--primary); letter-spacing: 3px; margin-bottom: 8px; }
.order-no { font-size: 28px; font-weight: 900; color: var(--primary); letter-spacing: 2px; margin-bottom: 16px; }
.copy-btn { background: var(--primary); color: #fff; border: none; border-radius: 8px; padding: 8px 20px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
.copy-btn:hover { background: var(--primary-dark); }

.free-notice { background: rgba(52,211,153,0.1); border: 1.5px solid rgba(52,211,153,0.25); border-radius: 10px; padding: 14px 20px; margin-bottom: 20px; font-size: 15px; color: #34d399; text-align: center; }
.steps-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 24px; margin-bottom: 28px; text-align: left; }
.steps-title { font-size: 15px; font-weight: 700; color: rgba(255,255,255,0.85); margin-bottom: 18px; }
.steps { display: flex; flex-direction: column; gap: 14px; }
.step-item { display: flex; gap: 14px; align-items: flex-start; }
.step-dot {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg, var(--primary), #4096ff);
  color: #fff; font-size: 13px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 3px 10px rgba(22,119,255,0.25);
}
.step-main { font-size: 14px; color: rgba(255,255,255,0.6); line-height: 1.7; padding-top: 4px; }
.wechat-btn { color: var(--primary); cursor: pointer; }
.wechat-btn:hover { text-decoration: underline; }

.result-actions { display: flex; gap: 12px; }
.btn-solid { flex: 1; background: linear-gradient(135deg, var(--primary), #4096ff); color: #fff; border-radius: 10px; padding: 14px; font-size: 15px; font-weight: 700; text-align: center; box-shadow: 0 6px 20px rgba(22,119,255,0.3); transition: box-shadow 0.15s; }
.btn-solid:hover { box-shadow: 0 10px 28px rgba(22,119,255,0.4); }
.btn-outline { flex: 1; border: 1.5px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.6); border-radius: 10px; padding: 14px; font-size: 15px; font-weight: 500; text-align: center; transition: border-color 0.15s, color 0.15s; }
.btn-outline:hover { border-color: #60a5fa; color: #60a5fa; }
</style>
