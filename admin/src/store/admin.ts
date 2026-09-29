import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAdminStore = defineStore('admin', () => {
  const token = ref(localStorage.getItem('admin_token') ?? '')

  const isLoggedIn = computed(() => !!token.value)

  function setToken(t: string) {
    token.value = t
    localStorage.setItem('admin_token', t)
  }

  function logout() {
    token.value = ''
    localStorage.removeItem('admin_token')
  }

  return { token, isLoggedIn, setToken, logout }
})
