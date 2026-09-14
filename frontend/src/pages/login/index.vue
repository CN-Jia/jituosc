<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-header">
        <router-link to="/" class="auth-logo">⚡ 极拓空间</router-link>
        <h1 class="auth-title">欢迎回来</h1>
        <p class="auth-sub">登录以提交需求和查看订单</p>
      </div>

      <form @submit.prevent="handleLogin" class="auth-form">
        <div class="form-group">
          <label class="form-label">邮箱 / 用户名</label>
          <input v-model="form.identifier" class="form-input" placeholder="输入邮箱或用户名" autocomplete="username" />
        </div>

        <div class="form-group">
          <div class="label-row">
            <label class="form-label">密码</label>
            <router-link to="/forgot-password" class="forgot-link">忘记密码？</router-link>
          </div>
          <div class="input-eye">
            <input v-model="form.password" :type="showPwd ? 'text' : 'password'" class="form-input" placeholder="输入密码" autocomplete="current-password" />
            <button type="button" class="eye-btn" @click="showPwd = !showPwd">{{ showPwd ? '🙈' : '👁️' }}</button>
          </div>
        </div>

        <div v-if="errorMsg" class="form-error" style="margin-top:-4px">{{ errorMsg }}</div>

        <button type="submit" class="btn btn-primary auth-submit" :disabled="loading">
          <span v-if="loading" class="spinner" style="width:16px;height:16px;border-width:2px" />
          {{ loading ? '登录中...' : '登 录' }}
        </button>
      </form>

      <p class="auth-switch">
        还没有账号？<router-link to="/register" class="auth-link">立即注册</router-link>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '../../store/user'
import { api } from '../../api'

const router = useRouter()
const route = useRoute()
const store = useUserStore()

const form = ref({ identifier: '', password: '' })
const loading = ref(false)
const errorMsg = ref('')
const showPwd = ref(false)

async function handleLogin() {
  errorMsg.value = ''
  if (!form.value.identifier || !form.value.password) {
    errorMsg.value = '请填写账号和密码'
    return
  }
  loading.value = true
  try {
    const res: any = await api.login(form.value.identifier, form.value.password)
    const d = res.data
    store.setAuth(d.token, { id: d.userId, username: d.username, nickname: d.nickname, email: d.email, emailVerified: true })
    const redirect = route.query.redirect as string
    router.replace(redirect || '/')
  } catch (err: any) {
    errorMsg.value = err?.message ?? '账号或密码错误'
  } finally {
    loading.value = false
  }
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
.label-row { display: flex; justify-content: space-between; align-items: center; }
.forgot-link { font-weight: 500; color: #60a5fa; font-size: 12px; }
.input-eye { position: relative; }
.input-eye .form-input { padding-right: 40px; }
.eye-btn { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; font-size: 16px; cursor: pointer; }
.auth-submit { width: 100%; padding: 14px; font-size: 16px; font-weight: 700; margin-top: 4px;
  background: linear-gradient(135deg, #2563eb, #3b82f6); border-radius: 12px;
  box-shadow: 0 8px 24px rgba(59,130,246,0.35);
}
.auth-submit:hover:not(:disabled) { box-shadow: 0 12px 32px rgba(59,130,246,0.45); }
.auth-switch { text-align: center; margin-top: 24px; font-size: 14px; color: rgba(255,255,255,0.38); }
.auth-link { color: #60a5fa; font-weight: 600; }
:deep(.form-error) { color: #f87171; }

@media (max-width: 640px) {
  .auth-card { padding: 28px 20px; }
}
</style>
