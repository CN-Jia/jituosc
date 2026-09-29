<template>
  <div class="home">
    <!-- ══════════ Hero ══════════ -->
    <section class="hero">
      <!-- 粒子 Canvas 层 -->
      <canvas ref="particleCvs" class="particle-layer" />
      <!-- 光晕背景层 -->
      <div class="hero-aurora">
        <div class="aurora-orb aurora-orb-1" />
        <div class="aurora-orb aurora-orb-2" />
        <div class="aurora-orb aurora-orb-3" />
      </div>
      <!-- 网格背景 -->
      <div class="hero-grid" />

      <div class="hero-inner">
        <div class="hero-eyebrow" :class="{ visible: heroVis }">
          <span class="eyebrow-pill">
            <span class="pill-dot" />
            <span>专业 · 快速 · 可靠</span>
          </span>
        </div>
        <h1 class="hero-title" :class="{ visible: heroVis }">
          让学业<br /><span class="grad-text">不再是负担</span>
        </h1>
        <p class="hero-sub" :class="{ visible: heroVis }">期末作业、日常作业、毕业设计，一站式搞定</p>
        <div class="hero-actions" :class="{ visible: heroVis }">
          <template v-if="store.isLoggedIn">
            <router-link to="/submit" class="btn-hero-primary">
              <span>立即提交</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </router-link>
            <router-link to="/my-orders" class="btn-hero-ghost">查看我的订单</router-link>
          </template>
          <template v-else>
            <button class="btn-hero-primary" @click="openLogin">
              <span>立即开始</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
            <router-link to="/register" class="btn-hero-ghost">免费注册</router-link>
          </template>
        </div>

        <!-- 统计数据 -->
        <div class="hero-stats" :class="{ visible: heroVis }">
          <div class="stat-item">
            <span class="stat-num">{{ counters[0] }}<em>h</em></span>
            <span class="stat-label">快速响应</span>
          </div>
          <div class="stat-divider" />
          <div class="stat-item">
            <span class="stat-num">{{ counters[1] }}<em>%</em></span>
            <span class="stat-label">价格透明</span>
          </div>
          <div class="stat-divider" />
          <div class="stat-item">
            <span class="stat-num">7<em>×24</em></span>
            <span class="stat-label">全天在线</span>
          </div>
          <div class="stat-divider" />
          <div class="stat-item">
            <span class="stat-num">{{ counters[2] }}<em>+</em></span>
            <span class="stat-label">完成案例</span>
          </div>
        </div>

        <!-- 价格参考（紧凑，嵌于 Hero） -->
        <div class="hero-price" :class="{ visible: heroVis }">
          <div class="hero-price-head">
            <span class="hero-price-title">价格参考</span>
            <span class="hero-price-hint">最终报价以管理员确认为准</span>
          </div>
          <div v-if="loadingTypes" class="hero-price-skeleton">
            <div class="hero-skel-line" v-for="i in 3" :key="i" />
          </div>
          <div v-else class="hero-price-rows">
            <div v-for="(t, i) in orderTypes" :key="t.id"
              class="hero-price-row" @click="goSubmitWithType(t.id)">
              <div class="hero-price-left">
                <span class="hero-price-idx">{{ i + 1 }}</span>
                <span class="hero-price-name">{{ t.name }}</span>
              </div>
              <div class="hero-price-right">
                <span class="hero-price-tag">{{ t.price }}</span>
                <svg class="hero-price-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 向下滚动提示 -->
      <div class="scroll-hint" :class="{ visible: heroVis }">
        <div class="scroll-mouse">
          <div class="scroll-dot" />
        </div>
        <span class="scroll-text">滚动探索</span>
      </div>
    </section>

    <!-- ══════════ 特性卡片 ══════════ -->
    <section class="features-section">
      <div class="section-wrap">
        <div class="sec-header reveal">
          <span class="sec-tag">为什么选择我们</span>
          <h2 class="sec-title">专注品质，服务优先</h2>
          <p class="sec-desc">我们用专业和诚意，守护每一份信任</p>
        </div>
        <div class="features-grid">
          <div v-for="(f, i) in features" :key="i"
            class="feat-card reveal" :style="`--delay:${i * 100}ms`">
            <div class="feat-icon-wrap">
              <div class="feat-icon-bg" />
              <span class="feat-icon">{{ f.icon }}</span>
            </div>
            <h3 class="feat-title">{{ f.title }}</h3>
            <p class="feat-desc">{{ f.desc }}</p>
            <div class="feat-line" />
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════ 作品轮播 ══════════ -->
    <section v-if="carousel.length" class="showcase-section">
      <div class="section-wrap">
        <div class="sec-header reveal">
          <span class="sec-tag">历代作品</span>
          <h2 class="sec-title">真实完成案例，品质有目共睹</h2>
        </div>
        <div class="showcase-track">
          <div class="carousel-slide reveal" v-for="(item, i) in carousel" :key="item.id"
            :style="`--delay:${i * 60}ms`">
            <div class="slide-img-wrap">
              <img :src="item.imageUrl" :alt="item.courseName" class="slide-img" loading="lazy" />
              <div class="slide-overlay" />
              <span class="slide-tag">{{ item.orderType }}</span>
            </div>
            <div class="slide-body">
              <div class="slide-course">{{ item.courseName }}</div>
              <div v-if="item.review" class="slide-review">"{{ item.review }}"</div>
              <div class="slide-meta">
                <span v-if="item.orderNoMask" class="slide-no">{{ item.orderNoMask }}</span>
                <span>{{ fmtDate(item.completedAt) }}完成</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════ 主体内容（PC only） ══════════ -->
    <div class="page-body hide-on-mobile">
      <!-- 最新动态 -->
      <section class="section reveal" v-if="activities.length || loadingActivities">
        <div class="section-head">
          <h2 class="section-title">最新动态</h2>
          <span class="section-count" v-if="activities.length">{{ activities.length }} 条</span>
        </div>
        <div v-if="loadingActivities" class="skeleton-grid">
          <div class="skeleton-card" v-for="i in 3" :key="i" />
        </div>
        <div v-else class="activity-grid">
          <div v-for="(a, i) in activities" :key="a.id"
            class="activity-card reveal" :style="`--delay:${i * 60}ms`"
            :class="a.type === 'PROMO' ? 'type-promo' : 'type-notice'">
            <div class="activity-badge">{{ a.type === 'PROMO' ? '🎁 优惠' : '📢 公告' }}</div>
            <div class="activity-title">{{ a.title }}</div>
            <div class="activity-content">{{ a.content }}</div>
          </div>
        </div>
      </section>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../../store/user'
import { api } from '../../api'

const store = useUserStore()
const router = useRouter()
const activities = ref<any[]>([])
const orderTypes = ref<any[]>([])
const carousel = ref<any[]>([])
const loadingActivities = ref(true)
const loadingTypes = ref(true)
const heroVis = ref(false)
const particleCvs = ref<HTMLCanvasElement | null>(null)
const counters = ref([1, 99, 199])
let pollTimer: ReturnType<typeof setInterval> | null = null

const fmtDate = (d: string) => {
  const dt = new Date(d)
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月`
}
const adminWechat = ref('Jt--04')

function openLogin() { router.push('/login') }
function goSubmitWithType(id: string) {
  if (store.isLoggedIn) {
    router.push({ path: '/submit', query: { typeId: id } })
  } else {
    openLogin()
  }
}

const features = [
  { icon: '⚡', title: '快速响应', desc: '提交需求后 1-2 小时内管理员确认，不让您干等。' },
  { icon: '💎', title: '品质保障', desc: '每份作业认真对待，不满意可修改，质量优先。' },
  { icon: '💰', title: '价格透明', desc: '先报价再付款，无隐藏收费，价格清晰明了。' },
  { icon: '🔒', title: '隐私安全', desc: '订单信息严格保密，仅您与管理员可见。' },
]

/* ═══════════════════════════════════════════
   高级粒子系统 — 多层 + 鼠标交互 + 景深
   ═══════════════════════════════════════════ */
interface Star {
  x: number; y: number
  vx: number; vy: number
  r: number; alpha: number
  layer: number           // 0=远景 1=中景 2=近景
  twinklePhase: number    // 闪烁相位
  twinkleSpeed: number
  hue: number
}

interface ShootingStar {
  x: number; y: number
  vx: number; vy: number
  life: number; maxLife: number
  len: number
  angle: number
}

function initParticleSystem() {
  const el = particleCvs.value
  if (!el) return
  const ctx = el.getContext('2d')!
  let W = 0, H = 0
  const stars: Star[] = []
  const shooting: ShootingStar[] = []
  let mouse = { x: -9999, y: -9999 }
  let rafId = 0
  let time = 0

  function resize() {
    W = el.offsetWidth
    H = el.offsetHeight
    el.width = W * devicePixelRatio
    el.height = H * devicePixelRatio
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
  }

  function spawnStar(forceLayer?: number): Star {
    const layer = forceLayer ?? (Math.random() < 0.5 ? 0 : Math.random() < 0.6 ? 1 : 2)
    const speedMul = [0.08, 0.2, 0.45][layer]
    const sizeRange = [[0.4, 1.0], [0.8, 1.8], [1.4, 3.0]][layer]
    const hueBase = 200 + layer * 20
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * speedMul,
      vy: (Math.random() - 0.5) * speedMul,
      r: Math.random() * (sizeRange[1] - sizeRange[0]) + sizeRange[0],
      alpha: Math.random() * 0.4 + (layer === 2 ? 0.4 : 0.15),
      layer,
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleSpeed: Math.random() * 0.02 + 0.008,
      hue: hueBase + Math.random() * 40 - 20,
    }
  }

  function spawnShootingStar() {
    if (shooting.length >= 2) return
    const angle = Math.random() * 0.4 + 0.3 // ~17-40 degrees
    const speed = Math.random() * 6 + 8
    shooting.push({
      x: Math.random() * W * 0.7,
      y: Math.random() * H * 0.3,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      maxLife: 1,
      len: Math.random() * 80 + 60,
      angle,
    })
  }

  resize()
  // Create layered stars
  const totalStars = W < 640 ? 55 : 120
  for (let i = 0; i < totalStars; i++) {
    stars.push(spawnStar())
  }
  window.addEventListener('resize', () => {
    resize()
    // Re-spawn if count mismatch
    const needed = (W < 640 ? 55 : 120) - stars.length
    for (let i = 0; i < needed; i++) stars.push(spawnStar())
  })

  // Mouse parallax
  function onMouseMove(e: MouseEvent) {
    mouse.x = e.clientX
    mouse.y = e.clientY
  }
  window.addEventListener('mousemove', onMouseMove)

  // Occasional shooting stars
  const shootingInterval = setInterval(() => {
    if (Math.random() < 0.35) spawnShootingStar()
  }, 4000)

  function draw() {
    ctx.clearRect(0, 0, W, H)
    time += 1

    // Sort by layer for depth
    stars.sort((a, b) => a.layer - b.layer)

    for (const p of stars) {
      // Twinkle
      const twinkle = Math.sin(time * p.twinkleSpeed + p.twinklePhase)
      const currentAlpha = p.alpha * (0.6 + 0.4 * twinkle)

      // Parallax based on layer
      const parallax = [0.008, 0.015, 0.025][p.layer]
      const dx = (mouse.x - W / 2) * parallax
      const dy = (mouse.y - H / 2) * parallax

      const px = p.x + dx
      const py = p.y + dy

      p.x += p.vx
      p.y += p.vy
      if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20
      if (p.y < -20) p.y = H + 20; if (p.y > H + 20) p.y = -20

      // Glow for near layer
      if (p.layer === 2 && currentAlpha > 0.3) {
        const glow = ctx.createRadialGradient(px, py, 0, px, py, p.r * 5)
        glow.addColorStop(0, `hsla(${p.hue}, 85%, 72%, ${currentAlpha * 0.3})`)
        glow.addColorStop(1, `hsla(${p.hue}, 85%, 72%, 0)`)
        ctx.beginPath()
        ctx.arc(px, py, p.r * 5, 0, Math.PI * 2)
        ctx.fillStyle = glow
        ctx.fill()
      }

      // Star core
      ctx.beginPath()
      ctx.arc(px, py, p.r, 0, Math.PI * 2)
      const sat = p.layer === 2 ? '85%' : '70%'
      const lgt = p.layer === 2 ? '78%' : '65%'
      ctx.fillStyle = `hsla(${p.hue}, ${sat}, ${lgt}, ${currentAlpha})`
      ctx.fill()
    }

    // Draw connection lines for near layer
    const nearStars = stars.filter(s => s.layer === 2)
    const LINK_DIST = 140
    for (let i = 0; i < nearStars.length; i++) {
      for (let j = i + 1; j < nearStars.length; j++) {
        const a = nearStars[i], b = nearStars[j]
        const parallaxA = 0.025
        const parallaxB = 0.025
        const ax = a.x + (mouse.x - W / 2) * parallaxA
        const ay = a.y + (mouse.y - H / 2) * parallaxA
        const bx = b.x + (mouse.x - W / 2) * parallaxB
        const by = b.y + (mouse.y - H / 2) * parallaxB
        const dist = Math.hypot(ax - bx, ay - by)
        if (dist < LINK_DIST) {
          const lineAlpha = 0.06 * (1 - dist / LINK_DIST)
          ctx.beginPath()
          ctx.moveTo(ax, ay)
          ctx.lineTo(bx, by)
          ctx.strokeStyle = `rgba(120, 180, 255, ${lineAlpha})`
          ctx.lineWidth = 0.5
          ctx.stroke()
        }
      }
    }

    // Shooting stars
    for (let i = shooting.length - 1; i >= 0; i--) {
      const s = shooting[i]
      s.life -= 0.015
      if (s.life <= 0) { shooting.splice(i, 1); continue }
      s.x += s.vx
      s.y += s.vy

      const alpha = s.life * 0.9
      const tailX = s.x - Math.cos(s.angle) * s.len * s.life
      const tailY = s.y - Math.sin(s.angle) * s.len * s.life

      const grad = ctx.createLinearGradient(s.x, s.y, tailX, tailY)
      grad.addColorStop(0, `rgba(200, 230, 255, ${alpha})`)
      grad.addColorStop(0.3, `rgba(160, 200, 255, ${alpha * 0.5})`)
      grad.addColorStop(1, `rgba(120, 160, 255, 0)`)

      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(tailX, tailY)
      ctx.strokeStyle = grad
      ctx.lineWidth = 1.8
      ctx.lineCap = 'round'
      ctx.stroke()

      // Head glow
      const headGlow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 6)
      headGlow.addColorStop(0, `rgba(220, 240, 255, ${alpha})`)
      headGlow.addColorStop(1, `rgba(200, 220, 255, 0)`)
      ctx.beginPath()
      ctx.arc(s.x, s.y, 6, 0, Math.PI * 2)
      ctx.fillStyle = headGlow
      ctx.fill()
    }

    rafId = requestAnimationFrame(draw)
  }
  draw()

  return () => {
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('resize', resize)
    clearInterval(shootingInterval)
    cancelAnimationFrame(rafId)
  }
}

// ── 计数器动画 ──────────────────────────────
function animateCounters() {
  const targets = [2, 100, 200]
  const durations = [800, 1200, 1500]
  targets.forEach((target, i) => {
    const start = performance.now()
    function tick(now: number) {
      const t = Math.min((now - start) / durations[i], 1)
      const ease = 1 - Math.pow(1 - t, 3)
      counters.value[i] = Math.round(ease * target)
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

// ── Intersection Observer ──────────────────
function initReveal() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        (e.target as HTMLElement).classList.add('revealed')
        obs.unobserve(e.target)
      }
    })
  }, { threshold: 0.12 })
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el))
  return obs
}

async function fetchData(silent = false) {
  try {
    const [a, t, c, cfg]: any[] = await Promise.all([
      api.getActivities(), api.getOrderTypes(), api.getCarousel(), api.getConfig(),
    ])
    activities.value = a.data?.list ?? a.data ?? []
    orderTypes.value = t.data ?? []
    carousel.value = c.data ?? []
    if (cfg.data?.adminWechatId) adminWechat.value = cfg.data.adminWechatId
  } finally {
    if (!silent) { loadingActivities.value = false; loadingTypes.value = false }
  }
}

let cleanup: (() => void) | undefined
let revealObs: IntersectionObserver | undefined

onMounted(() => {
  setTimeout(() => { heroVis.value = true }, 80)
  setTimeout(animateCounters, 500)
  cleanup = initParticleSystem()
  fetchData().then(() => {
    setTimeout(() => { revealObs = initReveal() }, 100)
  })
  pollTimer = setInterval(() => fetchData(true), 60_000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  cleanup?.()
  revealObs?.disconnect()
})
</script>

<style scoped>
/* ═══ 全局 ═══ */
.home { overflow-x: hidden; }

/* ═══════════════════════════════════
   Hero
   ═══════════════════════════════════ */
.hero {
  position: relative;
  min-height: 100vh;
  margin-top: calc(-1 * var(--nav-h));
  padding-top: var(--nav-h);
  background: #030818;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}

/* 粒子画布 */
.particle-layer {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  pointer-events: none;
  z-index: 2;
}

/* 极光光晕背景 */
.hero-aurora {
  position: absolute; inset: 0;
  overflow: hidden;
  z-index: 1;
}
.aurora-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.35;
}
.aurora-orb-1 {
  width: 600px; height: 600px;
  top: -200px; left: -100px;
  background: radial-gradient(circle, #1e40af 0%, transparent 70%);
  animation: auroraFloat1 15s ease-in-out infinite;
}
.aurora-orb-2 {
  width: 500px; height: 500px;
  bottom: -150px; right: -100px;
  background: radial-gradient(circle, #7c3aed 0%, transparent 70%);
  animation: auroraFloat2 18s ease-in-out infinite;
}
.aurora-orb-3 {
  width: 400px; height: 400px;
  top: 30%; left: 50%;
  transform: translateX(-50%);
  background: radial-gradient(circle, #0ea5e9 0%, transparent 70%);
  animation: auroraFloat3 12s ease-in-out infinite;
}
@keyframes auroraFloat1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(80px, 40px) scale(1.1); }
  66% { transform: translate(-30px, 60px) scale(0.95); }
}
@keyframes auroraFloat2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(-60px, -40px) scale(1.05); }
  66% { transform: translate(40px, -30px) scale(0.9); }
}
@keyframes auroraFloat3 {
  0%, 100% { transform: translateX(-50%) translate(0, 0) scale(1); opacity: 0.2; }
  50% { transform: translateX(-50%) translate(30px, -40px) scale(1.15); opacity: 0.35; }
}

/* 网格背景 */
.hero-grid {
  position: absolute; inset: 0;
  z-index: 1;
  background-image:
    linear-gradient(rgba(59, 130, 246, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(59, 130, 246, 0.04) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(ellipse 70% 60% at 50% 40%, black 20%, transparent 80%);
  -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 40%, black 20%, transparent 80%);
}

/* Hero 内容 */
.hero-inner {
  position: relative; z-index: 3;
  text-align: center; padding: 80px 24px 120px;
  max-width: 780px; margin: 0 auto;
}

/* 入场动画 */
.hero-eyebrow, .hero-title, .hero-sub, .hero-actions, .hero-stats {
  opacity: 0; transform: translateY(32px);
  transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}
.hero-eyebrow.visible { opacity: 1; transform: none; transition-delay: 0s; }
.hero-title.visible   { opacity: 1; transform: none; transition-delay: 0.15s; }
.hero-sub.visible     { opacity: 1; transform: none; transition-delay: 0.28s; }
.hero-actions.visible { opacity: 1; transform: none; transition-delay: 0.38s; }
.hero-stats.visible   { opacity: 1; transform: none; transition-delay: 0.5s; }

.eyebrow-pill {
  display: inline-flex; align-items: center; gap: 10px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.7);
  font-size: 13px; font-weight: 500;
  padding: 8px 24px; border-radius: 100px;
  letter-spacing: 2px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.pill-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: #34d399;
  box-shadow: 0 0 8px rgba(52,211,153,0.6);
  animation: pillPulse 2s ease-in-out infinite;
}
@keyframes pillPulse {
  0%, 100% { box-shadow: 0 0 4px rgba(52,211,153,0.4); }
  50% { box-shadow: 0 0 12px rgba(52,211,153,0.8); }
}

.hero-title {
  font-size: clamp(48px, 8vw, 88px);
  font-weight: 900; color: #fff; line-height: 1.1;
  margin: 28px 0 22px; letter-spacing: -2px;
  text-shadow: 0 4px 60px rgba(59,130,246,0.2);
}
.grad-text {
  background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 40%, #34d399 80%, #60a5fa 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
  background-size: 300% auto;
  animation: gradShift 6s ease infinite;
}
@keyframes gradShift { 0%, 100% { background-position: 0% center; } 50% { background-position: 100% center; } }

.hero-sub {
  font-size: 18px; color: rgba(255,255,255,0.55);
  margin-bottom: 44px; line-height: 1.8; font-weight: 400;
}
.hero-actions { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; margin-bottom: 64px; }

.btn-hero-primary {
  display: inline-flex; align-items: center; gap: 10px;
  background: #fff; color: #0f172a;
  border: none; border-radius: 14px;
  padding: 15px 32px; font-size: 15px; font-weight: 700;
  cursor: pointer; white-space: nowrap;
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.1),
    0 8px 32px rgba(0,0,0,0.3),
    0 0 60px rgba(59,130,246,0.15);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s;
  position: relative; overflow: hidden;
}
.btn-hero-primary::before {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(135deg, transparent 40%, rgba(59,130,246,0.08));
  opacity: 0; transition: opacity 0.2s;
}
.btn-hero-primary:hover {
  transform: translateY(-2px);
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.15),
    0 16px 48px rgba(0,0,0,0.35),
    0 0 80px rgba(59,130,246,0.2);
}
.btn-hero-primary:hover::before { opacity: 1; }

.btn-hero-ghost {
  background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.85);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 14px; padding: 15px 28px; font-size: 15px; font-weight: 500;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: all 0.2s;
}
.btn-hero-ghost:hover {
  background: rgba(255,255,255,0.1);
  border-color: rgba(255,255,255,0.25);
  color: #fff;
}

/* Stats */
.hero-stats {
  display: inline-flex; align-items: center;
  gap: 32px; flex-wrap: wrap;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 20px; padding: 24px 40px;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
.stat-item { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.stat-num {
  font-size: 36px; font-weight: 900; color: #fff; line-height: 1;
  font-variant-numeric: tabular-nums;
  letter-spacing: -1px;
}
.stat-num em { font-size: 16px; font-style: normal; opacity: 0.5; margin-left: 1px; }
.stat-label { font-size: 12px; color: rgba(255,255,255,0.4); letter-spacing: 0.05em; font-weight: 500; }
.stat-divider {
  width: 1px; height: 44px;
  background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.12), transparent);
}

/* Hero 价格参考（紧凑） */
.hero-price {
  opacity: 0; transform: translateY(32px);
  transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  margin-top: 32px;
  width: 100%; max-width: 520px; margin-left: auto; margin-right: auto;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  overflow: hidden;
}
.hero-price.visible { opacity: 1; transform: none; transition-delay: 0.62s; }
.hero-price-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px; border-bottom: 1px solid rgba(255,255,255,0.06);
}
.hero-price-title { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.7); letter-spacing: 0.08em; text-transform: uppercase; }
.hero-price-hint { font-size: 11px; color: rgba(255,255,255,0.28); }
.hero-price-skeleton { padding: 10px 20px; }
.hero-skel-line {
  height: 13px; border-radius: 6px; margin-bottom: 8px;
  background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
  background-size: 200% 100%; animation: shimmer 1.5s infinite;
}
.hero-price-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 20px; cursor: pointer;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  transition: background 0.15s;
}
.hero-price-row:last-child { border-bottom: none; }
.hero-price-row:hover { background: rgba(255,255,255,0.05); }
.hero-price-left { display: flex; align-items: center; gap: 10px; }
.hero-price-idx {
  width: 22px; height: 22px; border-radius: 6px;
  background: rgba(96,165,250,0.15); color: #60a5fa;
  font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.hero-price-name { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.78); }
.hero-price-right { display: flex; align-items: center; gap: 6px; }
.hero-price-tag {
  background: rgba(96,165,250,0.15); color: #60a5fa;
  font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 6px;
}
.hero-price-arrow { color: rgba(255,255,255,0.22); transition: color 0.15s, transform 0.15s; flex-shrink: 0; }
.hero-price-row:hover .hero-price-arrow { color: #60a5fa; transform: translateX(3px); }

/* Scroll hint */
.scroll-hint {
  position: absolute; bottom: 32px; left: 50%;
  transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  z-index: 3;
  opacity: 0; transform: translateX(-50%) translateY(20px);
  transition: opacity 0.8s ease 1s, transform 0.8s ease 1s;
}
.scroll-hint.visible { opacity: 1; transform: translateX(-50%) translateY(0); }

.scroll-mouse {
  width: 22px; height: 34px;
  border: 1.5px solid rgba(255,255,255,0.25);
  border-radius: 11px; display: flex; align-items: flex-start;
  justify-content: center; padding-top: 6px;
}
.scroll-dot {
  width: 3px; height: 8px; background: rgba(255,255,255,0.5);
  border-radius: 2px; animation: scrollDot 2s ease-in-out infinite;
}
.scroll-text {
  font-size: 11px; color: rgba(255,255,255,0.3); letter-spacing: 1px;
  font-weight: 500;
}
@keyframes scrollDot {
  0%, 100% { opacity: 1; transform: translateY(0); }
  50% { opacity: 0.2; transform: translateY(8px); }
}

/* ═══ Reveal 动画 ═══ */
.reveal {
  opacity: 0; transform: translateY(30px);
  transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) calc(var(--delay, 0ms)),
              transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) calc(var(--delay, 0ms));
}
.reveal.revealed { opacity: 1; transform: none; }

/* ═══ Section 通用 ═══ */
.section-wrap { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
.sec-header { text-align: center; margin-bottom: 52px; }
.sec-tag {
  display: inline-block; font-size: 12px; font-weight: 700;
  letter-spacing: 2px; text-transform: uppercase;
  color: var(--primary); background: var(--primary-light);
  padding: 6px 18px; border-radius: 100px; margin-bottom: 18px;
}
.sec-title {
  font-size: clamp(24px, 3.5vw, 36px); font-weight: 800; color: var(--text-1);
  margin-bottom: 10px;
}
.sec-desc {
  font-size: 15px; color: var(--text-3); line-height: 1.6;
}

/* ═══ Features ═══ */
.features-section {
  padding: 100px 0;
  background: var(--card-bg);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}
.features-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px;
}
@media (max-width: 900px) { .features-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 520px) { .features-grid { grid-template-columns: 1fr; } }

.feat-card {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 20px; padding: 36px 28px;
  text-align: center;
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s, border-color 0.3s;
  cursor: default;
  position: relative; overflow: hidden;
}
.feat-line {
  position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 0; height: 3px; border-radius: 3px;
  background: linear-gradient(90deg, var(--primary), #a78bfa);
  transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.feat-card:hover {
  transform: translateY(-8px);
  box-shadow: var(--shadow-lg);
  border-color: transparent;
}
.feat-card:hover .feat-line { width: 60%; }

.feat-icon-wrap {
  width: 72px; height: 72px; border-radius: 20px;
  margin: 0 auto 20px; position: relative;
  display: flex; align-items: center; justify-content: center;
  background: var(--primary-light);
}
.feat-icon-bg {
  position: absolute; inset: 0; border-radius: 20px;
  background: linear-gradient(135deg, var(--primary-light), transparent);
  opacity: 0; transition: opacity 0.3s;
}
.feat-card:hover .feat-icon-bg { opacity: 1; }
.feat-icon { font-size: 32px; line-height: 1; position: relative; z-index: 1; }
.feat-title { font-size: 16px; font-weight: 700; color: var(--text-1); margin-bottom: 10px; }
.feat-desc { font-size: 13px; color: var(--text-2); line-height: 1.9; }

/* ═══ Showcase ═══ */
.showcase-section {
  padding: 88px 0;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}
.showcase-track {
  display: flex; gap: 16px; overflow-x: auto;
  scroll-snap-type: x mandatory; padding: 8px 4px 20px;
  scrollbar-width: thin; scrollbar-color: var(--border) transparent;
}
.showcase-track::-webkit-scrollbar { height: 4px; }
.showcase-track::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
.carousel-slide {
  scroll-snap-align: start; flex-shrink: 0; width: 260px;
  background: var(--card-bg); border-radius: 16px;
  border: 1px solid var(--border);
  overflow: hidden; box-shadow: var(--shadow-sm);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s;
}
.carousel-slide:hover { transform: translateY(-6px); box-shadow: var(--shadow); }
.slide-img-wrap { position: relative; overflow: hidden; }
.slide-img { width: 100%; height: 160px; object-fit: cover; display: block; transition: transform 0.5s; }
.carousel-slide:hover .slide-img { transform: scale(1.05); }
.slide-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.3) 0%, transparent 50%);
  pointer-events: none;
}
.slide-tag {
  position: absolute; top: 10px; left: 10px;
  background: rgba(15,23,42,0.7); color: #fff;
  font-size: 11px; font-weight: 600; padding: 4px 12px; border-radius: 8px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.1);
}
.slide-body { padding: 16px 18px; }
.slide-course { font-size: 14px; font-weight: 700; color: var(--text-1); margin-bottom: 6px; }
.slide-review {
  font-size: 12px; color: var(--text-2); font-style: italic; margin-bottom: 10px;
  line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.slide-meta { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-3); }
.slide-no { color: var(--primary); font-weight: 600; }

/* ═══ Page body ═══ */
.page-body { max-width: 1200px; margin: 0 auto; padding: 64px 24px 80px; }
.section { margin-bottom: 52px; }
.section-head { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.section-title { font-size: 20px; font-weight: 800; color: var(--text-1); }
.section-count {
  font-size: 12px; color: var(--text-3);
  background: var(--border); padding: 2px 10px; border-radius: 100px;
}
.section-hint { font-size: 13px; color: var(--text-3); }

/* Skeleton */
.skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
.skeleton-card {
  height: 130px; border-radius: 14px;
  background: linear-gradient(90deg, var(--bg) 25%, var(--border) 50%, var(--bg) 75%);
  background-size: 200% 100%; animation: shimmer 1.5s infinite;
}
.skeleton-line {
  height: 18px; border-radius: 6px; margin-bottom: 10px;
  background: linear-gradient(90deg, var(--bg) 25%, var(--border) 50%, var(--bg) 75%);
  background-size: 200% 100%; animation: shimmer 1.5s infinite;
}
.skeleton-line:last-child { width: 55%; }
@keyframes shimmer { to { background-position: -200% 0; } }

/* Activity cards */
.activity-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 18px; }
.activity-card {
  background: var(--card-bg);
  border-radius: 16px; padding: 22px;
  border: 1px solid var(--border);
  border-left: 4px solid var(--primary);
  box-shadow: var(--shadow-sm);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s;
}
.activity-card:hover { transform: translateY(-4px); box-shadow: var(--shadow); }
.activity-card.type-promo { border-left-color: var(--warning); }
.activity-badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 700;
  padding: 3px 10px; border-radius: 100px; margin-bottom: 10px;
}
.type-notice .activity-badge { background: var(--primary-light); color: var(--primary); }
.type-promo .activity-badge { background: rgba(250,140,22,0.12); color: var(--warning); }
.activity-title { font-size: 15px; font-weight: 700; color: var(--text-1); margin-bottom: 8px; line-height: 1.4; }
.activity-content { font-size: 13px; color: var(--text-2); line-height: 1.8; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }

/* Two-col */
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
@media (max-width: 768px) { .two-col { grid-template-columns: 1fr; } }

/* Price card */
.price-card {
  background: var(--card-bg); border-radius: 16px;
  border: 1px solid var(--border); overflow: hidden;
  box-shadow: var(--shadow-sm);
}
.price-skeleton { padding: 20px 24px; }
.price-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid var(--border); cursor: pointer;
  transition: background 0.15s;
}
.price-row.last { border-bottom: none; }
.price-row:hover { background: var(--primary-light); }
.price-left { display: flex; align-items: flex-start; gap: 14px; }
.price-idx {
  width: 28px; height: 28px; border-radius: 8px;
  background: var(--primary-light); color: var(--primary);
  font-size: 13px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.price-name { font-size: 15px; font-weight: 600; color: var(--text-1); }
.price-desc { font-size: 12px; color: var(--text-3); margin-top: 3px; }
.price-right { display: flex; align-items: center; gap: 8px; }
.price-tag {
  background: var(--primary-light); color: var(--primary);
  font-size: 13px; font-weight: 700; padding: 5px 13px; border-radius: 8px;
}
.price-arrow {
  color: var(--text-3); transition: color 0.15s, transform 0.15s;
  flex-shrink: 0;
}
.price-row:hover .price-arrow { color: var(--primary); transform: translateX(4px); }

/* CTA card */
.cta-card {
  background: linear-gradient(145deg, #0f172a 0%, #1e3a5f 45%, #1e40af 100%);
  border-radius: 20px;
  color: #fff; height: 100%;
  display: flex; flex-direction: column;
  position: relative; overflow: hidden;
  box-shadow: 0 8px 40px rgba(15,23,42,0.5);
}
.cta-content { padding: 36px 30px; position: relative; z-index: 2; }
.cta-glow {
  position: absolute; top: -80px; right: -80px;
  width: 280px; height: 280px; border-radius: 50%;
  background: radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%);
  pointer-events: none; z-index: 1;
  animation: ctaGlow 8s ease-in-out infinite;
}
.cta-glow-2 {
  position: absolute; bottom: -60px; left: -60px;
  width: 200px; height: 200px; border-radius: 50%;
  background: radial-gradient(circle, rgba(14,165,233,0.2) 0%, transparent 70%);
  pointer-events: none; z-index: 1;
  animation: ctaGlow2 10s ease-in-out infinite;
}
@keyframes ctaGlow {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(-20px, 20px) scale(1.1); }
}
@keyframes ctaGlow2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(15px, -15px) scale(1.05); }
}
.cta-icon-wrap {
  width: 52px; height: 52px; border-radius: 14px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.1);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 18px; color: rgba(255,255,255,0.85);
}
.cta-title { font-size: 22px; font-weight: 800; margin-bottom: 10px; }
.cta-desc { font-size: 14px; color: rgba(255,255,255,0.6); line-height: 1.8; margin-bottom: 24px; }
.cta-steps { flex: 1; display: flex; flex-direction: column; gap: 14px; margin-bottom: 24px; }
.cta-step { display: flex; align-items: center; gap: 14px; font-size: 14px; color: rgba(255,255,255,0.8); }
.step-n {
  width: 26px; height: 26px; border-radius: 8px;
  background: rgba(255,255,255,0.08); font-size: 12px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  border: 1px solid rgba(255,255,255,0.08);
}
.cta-wechat { font-size: 13px; color: rgba(255,255,255,0.45); margin-bottom: 20px; }
.cta-wechat strong { color: rgba(255,255,255,0.85); }
.cta-btn {
  background: rgba(255,255,255,0.95); color: #0f172a;
  border: none; border-radius: 12px;
  padding: 15px; font-size: 15px; font-weight: 700;
  cursor: pointer; text-align: center;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s;
}
.cta-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(0,0,0,0.3); }

/* ═══ PC only 区块 ═══ */
@media (max-width: 640px) {
  .hide-on-mobile { display: none !important; }
}

/* ═══ H5 响应式 ═══ */
@media (max-width: 640px) {
  .hero-inner { padding: 40px 20px 80px; }
  .hero-title { font-size: 42px; letter-spacing: -1px; }
  .hero-sub { font-size: 15px; margin-bottom: 32px; }
  .hero-actions { gap: 10px; margin-bottom: 44px; }
  .btn-hero-primary { padding: 14px 28px; font-size: 15px; }
  .btn-hero-ghost { padding: 13px 22px; font-size: 14px; }
  .hero-stats { gap: 16px; padding: 20px 28px; }
  .stat-num { font-size: 28px; }
  .stat-num em { font-size: 14px; }
  .stat-label { font-size: 11px; }
  .stat-divider { height: 32px; }
  .scroll-hint { display: none; }
  .hero-price { margin-top: 24px; }
  .hero-price-row { padding: 9px 16px; }
  .hero-price-name { font-size: 12px; }

  .features-section { padding: 56px 0; }
  .features-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .feat-card { padding: 22px 16px; }
  .feat-icon-wrap { width: 56px; height: 56px; margin-bottom: 14px; }
  .feat-icon { font-size: 26px; }
  .feat-title { font-size: 14px; }
  .feat-desc { font-size: 12px; }
  .sec-title { font-size: 22px; }

  .showcase-section { padding: 48px 0; }
  .carousel-slide { width: 220px; }
  .slide-img { height: 130px; }
}

@media (max-width: 400px) {
  .hero-title { font-size: 34px; }
  .hero-stats { gap: 10px; padding: 16px 20px; }
  .stat-divider { height: 24px; }
  .features-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
}
</style>
