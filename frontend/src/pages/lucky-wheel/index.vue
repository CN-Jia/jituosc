<template>
  <div class="wheel-page">
    <div class="cyber-bg">
      <div class="grid-lines"></div>
      <div class="glow-orb orb-1"></div>
      <div class="glow-orb orb-2"></div>
    </div>

    <div class="wheel-container">
      <div class="wheel-header">
        <button class="back-btn" @click="$router.back()">← 返回</button>
        <div class="spin-count">
          <span class="count-label">剩余次数</span>
          <span class="count-num">{{ remainingSpins }}</span>
        </div>
      </div>

      <h1 class="wheel-title"><span class="title-glow">幸</span>运转盘</h1>
      <p class="wheel-subtitle">邀请好友越多，机会越多！</p>

      <!-- ═══ 横向滚轮区域 ═══ -->
      <div class="slot-wrapper" :class="{ spinning: isSpinning }">
        <div class="slot-mask">
          <div class="slot-fade-left"></div>
          <div class="slot-fade-right"></div>

          <div class="slot-track" ref="trackRef">
            <div
              v-for="(item, i) in slotItems"
              :key="i"
              class="slot-item"
              :class="{
                'is-cash': item.type === 'CASH_REDEEM',
                'is-discount': item.type === 'ORDER_DISCOUNT',
                'is-none': item.type === 'NONE'
              }"
            >
              <div class="slot-item-glow"></div>
              <div class="slot-item-inner">
                <span class="slot-icon">{{ item.icon }}</span>
                <span class="slot-label">{{ shortLabel(item.label) }}</span>
                <span v-if="item.type === 'CASH_REDEEM'" class="slot-tag cash">现金</span>
                <span v-else-if="item.type === 'ORDER_DISCOUNT'" class="slot-tag discount">折扣</span>
              </div>
            </div>
          </div>

          <!-- 中心指示线 -->
          <div class="slot-center-line">
            <div class="center-line-top"></div>
            <div class="center-line-bottom"></div>
          </div>
          <div class="slot-center-arrow">▼</div>
        </div>
      </div>

      <button class="spin-btn" @click="spin" :disabled="isSpinning || remainingSpins <= 0">
        <span class="spin-btn-shine" v-if="!isSpinning && remainingSpins > 0"></span>
        <span class="spin-btn-text">{{ isSpinning ? '🎰 抽奖中...' : '🎯 开始抽奖' }}</span>
      </button>

      <p class="spin-hint" v-if="remainingSpins <= 0">抽奖次数已用完，邀请好友可获得更多机会</p>
      <p class="spin-hint" v-else-if="remainingSpins < 3">邀请好友可获得更多抽奖机会（最多3次）</p>

      <!-- 中奖弹窗 -->
      <Transition name="modal">
        <div v-if="showResult" class="result-modal" @click.self="showResult = false">
          <div class="result-card" :class="{ won: resultWon }">
            <button class="modal-close" @click="showResult = false">✕</button>
            <template v-if="resultWon">
              <div class="result-icon">{{ resultPrize?.icon }}</div>
              <h2 class="result-title">🎉 恭喜中奖！</h2>
              <p class="result-prize">{{ resultPrize?.label }}</p>
              <div v-if="redeemCode" class="redeem-code-box">
                <span class="redeem-label">您的兑换码</span>
                <span class="redeem-code">{{ redeemCode }}</span>
                <button class="copy-btn" @click="copyCode">复制</button>
                <p class="redeem-hint">请联系管理员凭此码兑换现金</p>
              </div>
              <p v-else class="result-hint">折扣券已发放到您的账户，下单时自动生效</p>
            </template>
            <template v-else>
              <div class="result-icon">😢</div>
              <h2 class="result-title">谢谢惠顾</h2>
              <p class="result-hint">下次一定中！</p>
            </template>
            <div class="result-actions">
              <button class="result-btn primary" @click="showResult = false">
                {{ remainingSpins > 0 ? '再试一次' : '好的，知道了' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <div class="history-section" v-if="history.length > 0">
        <h3 class="section-title"><span class="title-line" /><span>中奖记录</span><span class="title-line" /></h3>
        <div class="history-list">
          <div v-for="h in history" :key="h.createdAt" class="history-item" :class="{ 'is-won': h.won }">
            <span class="history-icon">{{ h.won ? '🎁' : '🎯' }}</span>
            <span class="history-label">{{ h.prizeLabel }}</span>
            <span v-if="h.redeemCode" class="history-code">{{ h.redeemCode }}</span>
            <span v-if="h.isRedeemed" class="history-redeemed">已兑换</span>
          </div>
        </div>
      </div>

      <div class="rules-section">
        <h3 class="section-title"><span class="title-line" /><span>活动规则</span><span class="title-line" /></h3>
        <div class="rules-list">
          <div class="rule-item">📌 新用户注册即送 <strong>1次</strong> 抽奖机会</div>
          <div class="rule-item">👥 每成功邀请 <strong>1位</strong> 好友 +1次</div>
          <div class="rule-item">🎯 最多可获得 <strong>3次</strong> 抽奖机会</div>
          <div class="rule-item">💰 现金奖品凭兑换码联系管理员兑换</div>
          <div class="rule-item">🎫 折扣券自动发放，下单时自动生效</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { api } from '../../api'

const prizes = ref<any[]>([])
const remainingSpins = ref(0)
const history = ref<any[]>([])
const isSpinning = ref(false)
const showResult = ref(false)
const resultWon = ref(false)
const resultPrize = ref<any>(null)
const redeemCode = ref('')
const trackRef = ref<HTMLElement | null>(null)

const ITEM_W = 110
const GAP = 10
const FULL = ITEM_W + GAP
const REPEAT = 10

let marqueeRaf = 0
let marqueePos = 0
const MARQUEE_SPEED = 0.5 // px/frame

// 运行时从 DOM 读取真实尺寸，兼容移动端响应式
function getActualFull(): number {
  const track = trackRef.value
  if (!track) return FULL
  const firstItem = track.querySelector('.slot-item') as HTMLElement | null
  if (!firstItem) return FULL
  const gap = parseFloat(getComputedStyle(track).gap) || GAP
  return firstItem.offsetWidth + gap
}

function shortLabel(label: string) {
  return label.replace(/^[^\s]+\s/, '')
}

const slotItems = computed(() => {
  if (!prizes.value.length) return []
  const arr: any[] = []
  for (let r = 0; r < REPEAT; r++) {
    for (const p of prizes.value) arr.push(p)
  }
  return arr
})

// 空闲时持续滚动
function startMarquee() {
  const track = trackRef.value
  if (!track || isSpinning.value) return
  const f = getActualFull()
  const oneSet = prizes.value.length * f

  function tick() {
    marqueePos += MARQUEE_SPEED
    if (marqueePos >= oneSet) marqueePos -= oneSet
    track!.style.transition = 'none'
    track!.style.transform = `translateX(-${marqueePos}px)`
    marqueeRaf = requestAnimationFrame(tick)
  }
  marqueeRaf = requestAnimationFrame(tick)
}

function stopMarquee() {
  cancelAnimationFrame(marqueeRaf)
}

async function loadInfo() {
  try {
    const res: any = await api.getLuckyWheelInfo()
    prizes.value = res.data.prizes
    remainingSpins.value = res.data.remainingSpins
    history.value = res.data.history
  } catch (err) { console.error(err) }
}

function spin() {
  if (isSpinning.value || remainingSpins.value <= 0) return
  isSpinning.value = true
  stopMarquee()

  const track = trackRef.value
  if (!track) { isSpinning.value = false; return }

  api.spinLuckyWheel().then((res: any) => {
    const { prizeIndex, prize, won, redeemCode: code, remainingSpins: remaining } = res.data

    // 使用实际 DOM 尺寸，兼容移动端
    const f = getActualFull()
    const n = prizes.value.length

    // translateX(-i*f) 恰好让第 i 个 item 居中（CSS padding 已使 item-0 在 x=0 时居中）
    const targetIdx = (REPEAT - 2) * n + prizeIndex
    const targetPos = targetIdx * f

    // 先跳到 3 整轮之后，再缓动到目标
    const fastStart = n * f * 3 + marqueePos
    track.style.transition = 'none'
    track.style.transform = `translateX(-${fastStart}px)`

    requestAnimationFrame(() => {
      track.style.transition = 'transform 4s cubic-bezier(0.12, 0.7, 0.15, 1)'
      track.style.transform = `translateX(-${targetPos}px)`
    })

    setTimeout(() => {
      track.classList.add('flash-stop')
      setTimeout(() => track.classList.remove('flash-stop'), 600)

      isSpinning.value = false
      resultWon.value = won
      resultPrize.value = prize
      redeemCode.value = code || ''
      remainingSpins.value = remaining

      setTimeout(() => {
        showResult.value = true
        loadInfo()
        marqueePos = targetPos % (n * f)
        startMarquee()
      }, 800)
    }, 4200)
  }).catch((err: any) => {
    isSpinning.value = false
    startMarquee()
    alert(err?.message ?? '抽奖失败')
  })
}

function copyCode() {
  if (redeemCode.value) navigator.clipboard.writeText(redeemCode.value).then(() => alert('✅ 已复制'))
}

onMounted(() => {
  loadInfo().then(() => {
    setTimeout(startMarquee, 300)
  })
})
onUnmounted(stopMarquee)
</script>

<style scoped>
.wheel-page { min-height: 100vh; background: var(--bg); position: relative; overflow: hidden; padding-bottom: 60px; }
.cyber-bg { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
.grid-lines { position: absolute; inset: 0; background-image: linear-gradient(rgba(0,212,255,0.03) 1px,transparent 1px), linear-gradient(90deg,rgba(0,212,255,0.03) 1px,transparent 1px); background-size: 60px 60px; }
.glow-orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.15; }
.orb-1 { width: 400px; height: 400px; background: #00d4ff; top: -100px; right: -100px; }
.orb-2 { width: 300px; height: 300px; background: #a855f7; bottom: -50px; left: -80px; }

.wheel-container { position: relative; z-index: 1; max-width: 560px; margin: 0 auto; padding: 20px 16px; }
.wheel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.back-btn { background: none; border: 1px solid var(--border); color: var(--text-2); padding: 8px 16px; border-radius: 8px; font-size: 14px; cursor: pointer; transition: all 0.2s; }
.back-btn:hover { border-color: var(--primary); color: var(--primary); }
.spin-count { display: flex; align-items: center; gap: 8px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 20px; padding: 6px 16px; }
.count-label { font-size: 12px; color: var(--text-3); }
.count-num { font-size: 20px; font-weight: 800; color: #00d4ff; font-variant-numeric: tabular-nums; }

.wheel-title { text-align: center; font-size: 32px; font-weight: 900; color: var(--text-1); margin-bottom: 4px; letter-spacing: 4px; }
.title-glow { color: #00d4ff; text-shadow: 0 0 20px rgba(0,212,255,0.5); }
.wheel-subtitle { text-align: center; font-size: 14px; color: var(--text-3); margin-bottom: 32px; }

/* ═══ 横向滚轮 ═══ */
.slot-wrapper { position: relative; margin: 0 auto 32px; }

.slot-mask {
  position: relative;
  overflow: hidden;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(0,212,255,0.04) 0%, rgba(13,17,23,0.9) 50%, rgba(0,212,255,0.04) 100%);
  border: 1px solid rgba(0,212,255,0.2);
  padding: 20px 0;
  box-shadow: 0 0 40px rgba(0,212,255,0.06), inset 0 0 40px rgba(0,0,0,0.3);
}

.slot-track {
  display: flex;
  gap: 10px;
  padding: 0 calc(50% - 55px);
  will-change: transform;
}
.slot-track.flash-stop {
  animation: flash-stop 0.6s ease-out;
}
@keyframes flash-stop {
  0% { filter: brightness(1.8) drop-shadow(0 0 20px rgba(0,212,255,0.8)); }
  50% { filter: brightness(1.3) drop-shadow(0 0 10px rgba(0,212,255,0.4)); }
  100% { filter: brightness(1); }
}

.slot-item {
  flex-shrink: 0;
  width: 110px;
  height: 100px;
  border-radius: 14px;
  position: relative;
  overflow: hidden;
  transition: transform 0.15s, box-shadow 0.15s;
}

.slot-item-glow {
  position: absolute;
  inset: 0;
  border-radius: 14px;
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
}

.slot-item-inner {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 10px 6px;
  border-radius: 14px;
  position: relative;
  z-index: 1;
}

/* 类型样式 */
.slot-item.is-cash {
  background: linear-gradient(135deg, rgba(255,107,107,0.18), rgba(255,107,107,0.05));
  border: 1.5px solid rgba(255,107,107,0.45);
  box-shadow: 0 0 16px rgba(255,107,107,0.1), inset 0 1px 0 rgba(255,255,255,0.06);
}
.slot-item.is-cash .slot-item-glow { background: radial-gradient(circle at 50% 80%, rgba(255,107,107,0.15) 0%, transparent 70%); }
.slot-item.is-cash .slot-icon { filter: drop-shadow(0 0 6px rgba(255,107,107,0.5)); }

.slot-item.is-discount {
  background: linear-gradient(135deg, rgba(0,212,255,0.14), rgba(168,85,247,0.08));
  border: 1.5px solid rgba(0,212,255,0.35);
  box-shadow: 0 0 16px rgba(0,212,255,0.1), inset 0 1px 0 rgba(255,255,255,0.06);
}
.slot-item.is-discount .slot-item-glow { background: radial-gradient(circle at 50% 80%, rgba(0,212,255,0.15) 0%, transparent 70%); }
.slot-item.is-discount .slot-icon { filter: drop-shadow(0 0 6px rgba(0,212,255,0.5)); }

.slot-item.is-none {
  background: linear-gradient(135deg, rgba(100,116,139,0.12), rgba(100,116,139,0.04));
  border: 1.5px solid rgba(100,116,139,0.2);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
}

.slot-icon {
  font-size: 30px;
  line-height: 1;
  transition: transform 0.2s;
}

.slot-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-1);
  text-align: center;
  line-height: 1.2;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slot-tag {
  font-size: 9px;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 6px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
.slot-tag.cash { background: rgba(255,107,107,0.2); color: #ff6b6b; }
.slot-tag.discount { background: rgba(0,212,255,0.15); color: #00d4ff; }

/* 中心指示器 */
.slot-center-line {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 2px;
  z-index: 10;
  pointer-events: none;
}
.center-line-top, .center-line-bottom {
  width: 100%;
  height: 50%;
  background: linear-gradient(180deg, #00d4ff 0%, rgba(0,212,255,0.1) 100%);
}
.center-line-bottom {
  background: linear-gradient(0deg, #00d4ff 0%, rgba(0,212,255,0.1) 100%);
}

.slot-center-arrow {
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 16px;
  color: #00d4ff;
  text-shadow: 0 0 12px rgba(0,212,255,0.9);
  z-index: 11;
  animation: arrow-pulse 1s ease-in-out infinite;
}
@keyframes arrow-pulse {
  0%, 100% { opacity: 0.6; transform: translateX(-50%) translateY(0); }
  50% { opacity: 1; transform: translateX(-50%) translateY(3px); }
}

/* 左右渐变遮罩 */
.slot-fade-left, .slot-fade-right {
  position: absolute;
  top: 0; bottom: 0;
  width: 70px;
  z-index: 5;
  pointer-events: none;
}
.slot-fade-left { left: 0; background: linear-gradient(90deg, rgba(13,17,23,0.95) 0%, transparent 100%); }
.slot-fade-right { right: 0; background: linear-gradient(270deg, rgba(13,17,23,0.95) 0%, transparent 100%); }

/* 抖动效果 */
.slot-wrapper.spinning .slot-mask {
  animation: slot-shake 0.08s linear infinite;
}
@keyframes slot-shake {
  0% { transform: translateX(0); }
  25% { transform: translateX(-1px); }
  75% { transform: translateX(1px); }
  100% { transform: translateX(0); }
}

/* ═══ 按钮 ═══ */
.spin-btn {
  display: block;
  margin: 0 auto 16px;
  padding: 16px 52px;
  border-radius: 16px;
  border: 2px solid #00d4ff;
  background: linear-gradient(135deg, #0d1117 0%, #16213e 100%);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all 0.3s;
  box-shadow: 0 0 20px rgba(0,212,255,0.25), inset 0 0 20px rgba(0,212,255,0.08);
}
.spin-btn:hover:not(:disabled) {
  box-shadow: 0 0 40px rgba(0,212,255,0.5), inset 0 0 30px rgba(0,212,255,0.15);
  transform: translateY(-2px);
}
.spin-btn:active:not(:disabled) { transform: translateY(0) scale(0.98); }
.spin-btn:disabled { opacity: 0.4; cursor: not-allowed; border-color: rgba(0,212,255,0.2); }
.spin-btn-text { font-size: 18px; font-weight: 900; color: #00d4ff; letter-spacing: 3px; text-shadow: 0 0 14px rgba(0,212,255,0.5); position: relative; z-index: 1; }

.spin-btn-shine {
  position: absolute;
  top: 0; left: -100%;
  width: 60%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(0,212,255,0.15), transparent);
  animation: btn-shine 2.5s ease-in-out infinite;
}
@keyframes btn-shine {
  0% { left: -100%; }
  50% { left: 140%; }
  100% { left: 140%; }
}

.spin-hint { text-align: center; font-size: 13px; color: var(--text-3); margin-bottom: 32px; }

/* ═══ 弹窗 ═══ */
.result-modal {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px;
}
.result-card {
  background: var(--card-bg); border: 1px solid var(--border); border-radius: 20px;
  padding: 40px 32px; max-width: 400px; width: 100%; text-align: center; position: relative; overflow: hidden;
}
.result-card.won { border-color: #00d4ff; box-shadow: 0 0 40px rgba(0,212,255,0.2); }
.result-card.won::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(90deg, #00d4ff, #a855f7, #00d4ff);
}
.modal-close { position: absolute; top: 16px; right: 16px; background: none; border: none; color: var(--text-3); font-size: 18px; cursor: pointer; }
.result-icon { font-size: 64px; margin-bottom: 16px; }
.result-title { font-size: 24px; font-weight: 900; color: var(--text-1); margin-bottom: 8px; }
.result-prize { font-size: 18px; font-weight: 700; color: #00d4ff; margin-bottom: 20px; }
.result-hint { font-size: 14px; color: var(--text-3); margin-bottom: 20px; }
.redeem-code-box { background: rgba(0,212,255,0.05); border: 1px dashed #00d4ff; border-radius: 12px; padding: 20px; margin: 16px 0; }
.redeem-label { display: block; font-size: 12px; color: var(--text-3); margin-bottom: 8px; }
.redeem-code {
  display: block; font-family: 'JetBrains Mono', monospace; font-size: 28px; font-weight: 900;
  color: #00d4ff; letter-spacing: 4px; margin-bottom: 12px; text-shadow: 0 0 20px rgba(0,212,255,0.3);
}
.copy-btn {
  background: rgba(0,212,255,0.1); border: 1px solid #00d4ff; color: #00d4ff;
  padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s;
}
.copy-btn:hover { background: #00d4ff; color: #0d1117; }
.redeem-hint { font-size: 12px; color: var(--text-3); margin-top: 8px; }
.result-actions { margin-top: 24px; }
.result-btn { padding: 14px 32px; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer; transition: all 0.2s; border: none; }
.result-btn.primary { background: linear-gradient(135deg, #00d4ff, #0099cc); color: #fff; box-shadow: 0 4px 20px rgba(0,212,255,0.3); }
.result-btn.primary:hover { box-shadow: 0 6px 30px rgba(0,212,255,0.5); transform: translateY(-2px); }
.modal-enter-active, .modal-leave-active { transition: opacity 0.3s; }
.modal-enter-active .result-card, .modal-leave-active .result-card { transition: transform 0.3s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .result-card { transform: scale(0.9); }

/* ═══ 记录 & 规则 ═══ */
.history-section, .rules-section { margin-top: 40px; }
.section-title { display: flex; align-items: center; gap: 12px; font-size: 14px; font-weight: 700; color: var(--text-3); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 16px; }
.title-line { flex: 1; height: 1px; background: var(--border); }
.history-list { display: flex; flex-direction: column; gap: 8px; }
.history-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; font-size: 14px; }
.history-item.is-won { border-color: rgba(0,212,255,0.3); }
.history-icon { font-size: 20px; }
.history-label { flex: 1; color: var(--text-1); font-weight: 600; }
.history-code { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #00d4ff; background: rgba(0,212,255,0.08); padding: 2px 8px; border-radius: 4px; }
.history-redeemed { font-size: 11px; color: var(--text-3); background: rgba(0,212,255,0.08); padding: 2px 8px; border-radius: 4px; }
.rules-list { display: flex; flex-direction: column; gap: 8px; }
.rule-item { font-size: 13px; color: var(--text-2); line-height: 1.6; padding: 8px 12px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; }
.rule-item strong { color: #00d4ff; }

@media (max-width: 480px) {
  .slot-item { width: 90px; height: 84px; }
  .slot-icon { font-size: 26px; }
  .slot-label { font-size: 10px; }
  .slot-track { gap: 8px; padding: 0 calc(50% - 45px); }
  .wheel-title { font-size: 24px; }
  .spin-btn { padding: 14px 36px; }
  .spin-btn-text { font-size: 16px; letter-spacing: 2px; }
}
</style>
