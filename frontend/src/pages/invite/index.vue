<template>
  <div class="invite-wrap">
    <div class="page-banner">
      <div class="page-banner-inner">
        <h1 class="page-banner-title">邀请好友</h1>
        <p class="page-banner-sub">邀请注册得 50 积分，好友首购再得 100 积分</p>
      </div>
    </div>
    <div class="page-container">
    <div class="page-header">
    </div>

    <!-- 邀请码卡片 -->
    <div class="invite-card card">
      <div class="invite-code-section">
        <div class="invite-code-label">我的邀请码</div>
        <div class="invite-code">{{ inviteCode || '加载中…' }}</div>
        <button class="btn btn-primary" @click="copyLink">复制邀请链接</button>
      </div>
      <div class="invite-stats">
        <div class="stat-item">
          <div class="stat-num">{{ stats.totalInvited }}</div>
          <div class="stat-label">已邀请</div>
        </div>
        <div class="stat-item">
          <div class="stat-num">{{ stats.pendingFirst }}</div>
          <div class="stat-label">待首购</div>
        </div>
        <div class="stat-item success">
          <div class="stat-num">{{ stats.completedFirst }}</div>
          <div class="stat-label">已完成</div>
        </div>
      </div>
    </div>

    <!-- 邀请规则说明 -->
    <div class="rules-card card">
      <h3 class="rules-title">积分规则</h3>
      <div class="rule-item">
        <span class="rule-icon">1️⃣</span>
        <span>好友通过你的链接注册 → 你立即获得 <strong>50</strong> 积分</span>
      </div>
      <div class="rule-item">
        <span class="rule-icon">2️⃣</span>
        <span>好友完成首笔订单 → 你再得 <strong>100</strong> 积分，好友也得 <strong>30</strong> 积分</span>
      </div>
      <div class="rule-item">
        <span class="rule-icon">💡</span>
        <span>每位好友只计算首次邀请关系，不可重复绑定</span>
      </div>
    </div>

    <!-- 邀请列表 -->
    <div class="section-title">邀请记录</div>
    <div v-if="invitees.length === 0" class="empty-state">还没有邀请好友，快去分享吧！</div>
    <div class="invitee-list">
      <div v-for="u in invitees" :key="u.nickname + u.registeredAt" class="invitee-item card">
        <div class="invitee-avatar">{{ u.nickname?.charAt(0) ?? '?' }}</div>
        <div class="invitee-info">
          <div class="invitee-name">{{ u.nickname }}</div>
          <div class="invitee-time">注册于 {{ formatDate(u.registeredAt) }}</div>
        </div>
        <div class="invitee-status">
          <span v-if="u.firstOrderAt" class="badge badge-success">已首购</span>
          <span v-else class="badge badge-pending">待首购</span>
        </div>
      </div>
    </div>

    <div v-if="copied" class="toast">链接已复制！</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../../api'

const inviteCode = ref('')
const inviteUrl = ref('')
const stats = ref({ totalInvited: 0, pendingFirst: 0, completedFirst: 0 })
const invitees = ref<any[]>([])
const copied = ref(false)

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function copyLink() {
  navigator.clipboard.writeText(inviteUrl.value).then(() => {
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }).catch(() => {
    const inp = document.createElement('input')
    inp.value = inviteUrl.value
    document.body.appendChild(inp)
    inp.select()
    document.execCommand('copy')
    document.body.removeChild(inp)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  })
}

onMounted(async () => {
  try {
    const [infoRes, inviteesRes]: any[] = await Promise.all([api.getInviteInfo(), api.getInvitees()])
    inviteCode.value = infoRes.data.inviteCode
    inviteUrl.value = infoRes.data.inviteUrl
    stats.value = {
      totalInvited: infoRes.data.totalInvited,
      pendingFirst: infoRes.data.pendingFirst,
      completedFirst: infoRes.data.completedFirst,
    }
    invitees.value = inviteesRes.data.list
  } catch {}
})
</script>

<style scoped>
.invite-wrap { background: var(--bg); min-height: calc(100vh - var(--nav-h)); }
.page-banner {
  background: linear-gradient(135deg, #060d1f 0%, #0f1f4d 55%, #1e3a5f 100%);
  padding: 40px 32px 36px; text-align: center;
}
.page-banner-inner { max-width: 700px; margin: 0 auto; }
.page-banner-title { font-size: 28px; font-weight: 900; color: #fff; margin-bottom: 6px; }
.page-banner-sub { font-size: 14px; color: rgba(255,255,255,0.55); }

.page-container { max-width: 700px; margin: 0 auto; padding: 24px 16px; }
.page-header { margin-bottom: 4px; }

.invite-card { padding: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px; margin-bottom: 16px; }
.invite-code-section { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; }
.invite-code-label { font-size: 12px; color: var(--text-3); }
.invite-code { font-family: monospace; font-size: 28px; font-weight: 700; letter-spacing: 4px; color: var(--primary); }

.invite-stats { display: flex; gap: 24px; flex-shrink: 0; }
.stat-item { text-align: center; }
.stat-num { font-size: 26px; font-weight: 800; color: var(--text-1); }
.stat-item.success .stat-num { color: #22c55e; }
.stat-label { font-size: 12px; color: var(--text-3); margin-top: 2px; }

.rules-card { padding: 20px; margin-bottom: 24px; }
.rules-title { font-size: 15px; font-weight: 700; margin-bottom: 12px; color: var(--text-1); }
.rule-item { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; font-size: 14px; color: var(--text-2); border-bottom: 1px solid var(--border); }
.rule-item:last-child { border-bottom: none; }
.rule-icon { font-size: 1rem; flex-shrink: 0; }

.section-title { font-size: 15px; font-weight: 700; color: var(--text-1); margin-bottom: 12px; }
.invitee-list { display: flex; flex-direction: column; gap: 10px; }
.invitee-item { display: flex; align-items: center; gap: 12px; padding: 14px 16px; }
.invitee-avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; }
.invitee-info { flex: 1; min-width: 0; }
.invitee-name { font-weight: 600; color: var(--text-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.invitee-time { font-size: 12px; color: var(--text-3); margin-top: 2px; }
.badge { padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; white-space: nowrap; }
.badge-success { background: rgba(52,211,153,0.12); color: #34d399; }
.badge-pending { background: rgba(251,191,36,0.12); color: #fbbf24; }

.empty-state { text-align: center; padding: 48px; color: var(--text-3); }

.toast { position: fixed; bottom: calc(80px + env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%); background: #1e293b; color: #fff; padding: 10px 20px; border-radius: 20px; font-size: 13px; z-index: 9999; white-space: nowrap; }

@media (max-width: 640px) {
  .page-banner { padding: 28px 20px 24px; }
  .page-banner-title { font-size: 22px; }
  .invite-card { flex-direction: column; align-items: flex-start; }
  .invite-stats { gap: 16px; }
}

.stat-item.success .stat-num { color: #34d399; }
.toast { background: #f1f5f9; color: #0d1117; }
</style>
