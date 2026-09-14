import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface UserInfo {
  id: string
  username: string
  nickname: string
  email: string
  phone?: string
  wechatId?: string
  grade?: string
  emailVerified: boolean
}

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('jituo_token') ?? '')
  const userInfo = ref<UserInfo | null>(null)

  const isLoggedIn = computed(() => !!token.value)
  const nickname = computed(() => userInfo.value?.nickname ?? '')

  function setAuth(t: string, info: UserInfo) {
    token.value = t
    userInfo.value = info
    localStorage.setItem('jituo_token', t)
    localStorage.setItem('jituo_user', JSON.stringify(info))
  }

  function setUserInfo(info: UserInfo) {
    userInfo.value = info
    localStorage.setItem('jituo_user', JSON.stringify(info))
  }

  function logout() {
    token.value = ''
    userInfo.value = null
    localStorage.removeItem('jituo_token')
    localStorage.removeItem('jituo_user')
  }

  // 从 localStorage 恢复登录状态
  const savedUser = localStorage.getItem('jituo_user')
  if (savedUser && token.value) {
    try { userInfo.value = JSON.parse(savedUser) } catch { /* ignore */ }
  }

  return { token, userInfo, isLoggedIn, nickname, setAuth, setUserInfo, logout }
})
