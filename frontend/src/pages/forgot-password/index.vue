<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-header">
        <router-link to="/" class="auth-logo">极拓空间</router-link>
        <h1 class="auth-title">{{ step === 1 ? '找回密码' : '重置密码' }}</h1>
        <p class="auth-sub">{{ step === 1 ? '输入注册邮箱，我们将发送验证码' : '输入验证码和新密码' }}</p>
      </div>

      <!-- Step 1: 输入邮箱 -->
      <form v-if="step === 1" @submit.prevent="sendCode" class="auth-form">
        <div class="form-group">
          <label class="form-label">注册邮箱</label>
          <input v-model="email" type="email" class="form-input" placeholder="your@email.com" />
        </div>
        <div v-if="errorMsg" class="form-error">{{ errorMsg }}</div>
        <div v-if="successMsg" class="form-success">{{ successMsg }}</div>
        <button type="submit" class="btn btn-primary auth-submit" :disabled="loading">
          <span v-if="loading" class="spinner" style="width:16px;height:16px;border-width:2px" />
          {{ loading ? '发送中...' : '发送验证码' }}
        </button>
      </form>

      <!-- Step 2: 输入验证码和新密码 -->
      <form v-else @submit.prevent="resetPassword" class="auth-form">
        <div class="form-group">
          <label class="form-label">邮箱验证码</label>
          <div class="code-row">
            <input v-model="code" class="form-input" placeholder="6位数字验证码" maxlength="6" inputmode="numeric" />
            <button type="button" class="btn btn-outline code-btn" :disabled="codeCD > 0" @click="sendCode">
              {{ codeCD > 0 ? `${codeCD}s` : '重新发送' }}
            </button>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">新密码</label>
          <div class="input-eye">
            <input v-model="newPassword" :type="showPwd ? 'text' : 'password'" class="form-input" placeholder="至少8位，含字母+数字" autocomplete="new-password" />
            <button type="button" class="eye-btn" @click="showPwd = !showPwd">{{ showPwd ? '🙈' : '👁️' }}</button>
          </div>
        </div>
        <div v-if="errorMsg" class="form-error">{{ errorMsg }}</div>
        <button type="submit" class="btn btn-primary auth-submit" :disabled="loading">
          <span v-if="loading" class="spinner" style="width:16px;height:16px;border-width:2px" />
          {{ loading ? '重置中...' : '重置密码' }}
        </button>
      </form>

      <p class="auth-switch">
        <router-link to="/login" class="auth-link">← 返回登录</router-link>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../../api'

const router = useRouter()
const step = ref(1)
const email = ref('')
const code = ref('')
const newPassword = ref('')
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const showPwd = ref(false)
const codeCD = ref(0)
let cdTimer: ReturnType<typeof setInterval>

async function sendCode() {
  errorMsg.value = ''
  successMsg.value = ''
  if (!email.value) { errorMsg.value = '请填写邮箱'; return }
  loading.value = true
  try {
    await api.forgotPassword(email.value)
    successMsg.value = '验证码已发送到您的邮箱'
    if (step.value === 1) step.value = 2
    codeCD.value = 60
    cdTimer = setInterval(() => {
      codeCD.value--
      if (codeCD.value <= 0) clearInterval(cdTimer)
    }, 1000)
  } catch (err: any) {
    errorMsg.value = err?.message ?? '发送失败'
  } finally { loading.value = false }
}

async function resetPassword() {
  errorMsg.value = ''
  if (!code.value || code.value.length !== 6) { errorMsg.value = '请输入6位验证码'; return }
  if (!newPassword.value || newPassword.value.length < 8) { errorMsg.value = '密码至少8位'; return }
  loading.value = true
  try {
    await api.resetPassword(email.value, code.value, newPassword.value)
    alert('密码重置成功，请使用新密码登录')
    router.replace('/login')
  } catch (err: any) {
    errorMsg.value = err?.message ?? '重置失败'
  } finally { loading.value = false }
}
</script>

<style scoped>
.auth-page {
  min-height: calc(100vh - var(--nav-h));
  display: flex; align-items: center; justify-content: center;
  padding: 32px 16px; position: relative; overflow: hidden;
}
.auth-page::before {
  content: '';
  position: absolute; inset: 0;
  background-image: radial-gradient(rgba(59,130,246,0.08) 1px, transparent 1px);
  background-size: 32px 32px;
  pointer-events: none;
}
.auth-card {
  width: 100%; max-width: 420px; position: relative; z-index: 1;
  background: rgba(255,255,255,0.05);
  backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.1);
  padding: 44px 40px;
  box-shadow: 0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08);
}
.auth-header { text-align: center; margin-bottom: 32px; }
.auth-logo {
  font-size: 22px; font-weight: 900; display: block; margin-bottom: 22px;
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}
.auth-title { font-size: 24px; font-weight: 800; color: #fff; margin-bottom: 8px; }
.auth-sub { font-size: 14px; color: rgba(255,255,255,0.45); }
.auth-form { display: flex; flex-direction: column; gap: 16px; }
:deep(.form-label) { color: rgba(255,255,255,0.65); }
.auth-submit { width: 100%; padding: 14px; font-size: 16px; font-weight: 700; margin-top: 4px;
  background: linear-gradient(135deg, #2563eb, #3b82f6); border-radius: 12px;
  box-shadow: 0 8px 24px rgba(59,130,246,0.35);
}
.auth-submit:hover:not(:disabled) { box-shadow: 0 12px 32px rgba(59,130,246,0.45); }
.auth-switch { text-align: center; margin-top: 24px; font-size: 14px; color: rgba(255,255,255,0.38); }
.auth-link { color: #60a5fa; font-weight: 600; }
.form-error { font-size: 12px; color: #f87171; }
.form-success { font-size: 13px; color: #34d399; background: rgba(52,211,153,0.1); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(52,211,153,0.2); }
.code-row { display: flex; gap: 8px; }
.code-row .form-input { flex: 1; }
.code-btn { flex-shrink: 0; white-space: nowrap; padding: 10px 14px; font-size: 13px;
  border-color: rgba(255,255,255,0.15); color: rgba(255,255,255,0.7); }
.code-btn:hover { border-color: #60a5fa; color: #60a5fa; }
.input-eye { position: relative; }
.input-eye .form-input { padding-right: 40px; }
.eye-btn { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; font-size: 16px; cursor: pointer; }

@media (max-width: 640px) {
  .auth-card { padding: 28px 20px; }
}
</style>
