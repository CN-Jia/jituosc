<template>
  <div class="lp">
    <!-- 背景网格 -->
    <div class="lp-grid" />
    <!-- 光晕 -->
    <div class="glow glow-1" />
    <div class="glow glow-2" />

    <div class="lp-card">
      <!-- 顶部扫描线 -->
      <div class="card-scanline" />

      <div class="lp-header">
        <JtLogo :size="52" />
        <div class="lp-brand">
          <span class="brand-name">极拓空间</span>
          <span class="brand-sub">ADMIN CONSOLE</span>
        </div>
      </div>

      <div class="lp-divider">
        <span class="div-line" />
        <span class="div-text">AUTHORIZED ACCESS ONLY</span>
        <span class="div-line" />
      </div>

      <el-form :model="form" @submit.prevent="handleLogin" class="lp-form">
        <div class="field-wrap">
          <el-icon class="field-icon"><User /></el-icon>
          <el-input
            v-model="form.username"
            placeholder="管理员账号"
            size="large"
            class="sf-input"
          />
        </div>
        <div class="field-wrap">
          <el-icon class="field-icon"><Lock /></el-icon>
          <el-input
            v-model="form.password"
            type="password"
            placeholder="登录密码"
            size="large"
            show-password
            class="sf-input"
            @keyup.enter="handleLogin"
          />
        </div>
        <button class="login-btn" :class="{ loading }" @click.prevent="handleLogin" :disabled="loading">
          <span v-if="!loading" class="btn-text">
            <el-icon><Unlock /></el-icon>
            进入管理后台
          </span>
          <span v-else class="btn-text">
            <span class="spinner" />
            验证中...
          </span>
          <span class="btn-glow" />
        </button>
      </el-form>

      <p class="lp-footer">
        <span class="footer-dot" />
        系统已加密，仅限授权管理员访问
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock, Unlock } from '@element-plus/icons-vue'
import { useAdminStore } from '../../store/admin'
import { api } from '../../api'
import JtLogo from '../../components/JtLogo.vue'

const router = useRouter()
const store = useAdminStore()
const loading = ref(false)
const form = ref({ username: '', password: '' })

async function handleLogin() {
  if (!form.value.username || !form.value.password) {
    return ElMessage.warning('请填写账号和密码')
  }
  loading.value = true
  try {
    const res: any = await api.login(form.value.username, form.value.password)
    store.setToken(res.data.token)
    router.replace('/')
  } catch (err: any) {
    ElMessage.error(err?.message ?? '登录失败，请检查账号密码')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.lp {
  min-height: 100vh;
  background: var(--bg-deep);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  transition: background 0.25s;
}

/* dot-grid background */
.lp-grid {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle at 1.5px 1.5px, rgba(0,212,255,0.06) 1.5px, transparent 0);
  background-size: 28px 28px;
  pointer-events: none;
}

.glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  pointer-events: none;
}
.glow-1 {
  width: 500px; height: 500px;
  background: radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 70%);
  top: -120px; right: -120px;
}
.glow-2 {
  width: 400px; height: 400px;
  background: radial-gradient(circle, rgba(168,85,247,0.07) 0%, transparent 70%);
  bottom: -80px; left: -80px;
}

/* Card */
.lp-card {
  position: relative;
  z-index: 1;
  width: 420px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 40px 36px 32px;
  box-shadow: var(--el-box-shadow);
  overflow: hidden;
  transition: background 0.25s, border-color 0.25s;
}

.card-scanline {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #00d4ff, transparent);
  opacity: 0.7;
}

/* Header */
.lp-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 28px;
}
.lp-brand { display: flex; flex-direction: column; }
.brand-name { font-size: 22px; font-weight: 900; color: var(--text-hi); letter-spacing: 0.04em; }
.brand-sub  { font-size: 10px; font-weight: 700; letter-spacing: 0.25em; color: var(--accent); opacity: 0.8; margin-top: 2px; }

/* Divider */
.lp-divider {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 24px;
}
.div-line { flex: 1; height: 1px; background: rgba(0,212,255,0.12); }
.div-text  { font-size: 9px; font-weight: 700; letter-spacing: 0.2em; color: #3d5a70; white-space: nowrap; }

/* Form */
.lp-form { display: flex; flex-direction: column; gap: 12px; }
.field-wrap { position: relative; }
.field-icon {
  position: absolute;
  left: 12px; top: 50%;
  transform: translateY(-50%);
  font-size: 15px;
  color: #3d5a70;
  z-index: 2;
  pointer-events: none;
}
.sf-input :deep(.el-input__wrapper) {
  padding-left: 36px !important;
  background: rgba(0,212,255,0.04) !important;
  box-shadow: 0 0 0 1px rgba(0,212,255,0.14) inset !important;
  border-radius: 9px !important;
}
.sf-input :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px rgba(0,212,255,0.3) inset !important;
}
.sf-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #00d4ff inset, 0 0 12px rgba(0,212,255,0.12) !important;
}
.sf-input :deep(.el-input__inner) { color: #e8f0fe; }

/* Login button */
.login-btn {
  margin-top: 8px;
  width: 100%;
  height: 46px;
  background: var(--accent-dim);
  border: 1px solid var(--accent);
  border-radius: 10px;
  color: var(--accent);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all 0.2s;
  letter-spacing: 0.04em;
}
.login-btn:hover:not(:disabled) {
  background: var(--accent);
  color: #fff;
}
.login-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-text {
  display: flex; align-items: center; justify-content: center;
  gap: 8px; position: relative; z-index: 1;
}
.btn-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 0%, rgba(0,212,255,0.15) 0%, transparent 60%);
  pointer-events: none;
}

.spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(0,212,255,0.3);
  border-top-color: #00d4ff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Footer */
.lp-footer {
  display: flex; align-items: center; gap: 6px;
  justify-content: center;
  margin-top: 20px;
  font-size: 11px;
  color: #3d5a70;
  letter-spacing: 0.04em;
}
.footer-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 6px var(--success);
  animation: pulse 2s ease-in-out infinite;
  flex-shrink: 0;
}
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

/* ── 亮色模式适配 ── */
html:not(.dark) .lp-grid {
  background-image: radial-gradient(circle at 1.5px 1.5px, rgba(37,99,235,0.06) 1.5px, transparent 0);
}
html:not(.dark) .glow-1 { background: radial-gradient(circle, rgba(37,99,235,0.06) 0%, transparent 70%); }
html:not(.dark) .glow-2 { background: radial-gradient(circle, rgba(124,58,237,0.05) 0%, transparent 70%); }
html:not(.dark) .card-scanline { background: linear-gradient(90deg, transparent, var(--accent), transparent); }
html:not(.dark) .div-line { background: var(--border); }
html:not(.dark) .div-text { color: var(--text-lo); }
html:not(.dark) .field-icon { color: var(--text-lo); }
html:not(.dark) .lp-footer { color: var(--text-lo); }
html:not(.dark) .sf-input :deep(.el-input__wrapper) {
  background: #f8fafc !important;
  box-shadow: 0 0 0 1px #e2e8f0 inset !important;
}
html:not(.dark) .sf-input :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #94a3b8 inset !important;
}
html:not(.dark) .sf-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px #2563eb inset !important;
}
html:not(.dark) .sf-input :deep(.el-input__inner) { color: #1e293b; }
html:not(.dark) .spinner { border-color: rgba(37,99,235,0.3); border-top-color: #2563eb; }
html:not(.dark) .btn-glow { background: radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.08) 0%, transparent 60%); }
</style>
