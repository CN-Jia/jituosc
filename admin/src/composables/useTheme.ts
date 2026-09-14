import { ref, watch } from 'vue'

const KEY = 'jituo-admin-theme'
const stored = localStorage.getItem(KEY)
// 默认暗色；若存储了 'light' 则亮色
const isDark = ref(stored !== 'light')

function applyTheme(dark: boolean) {
  if (dark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

// 初始化即应用
applyTheme(isDark.value)

watch(isDark, (val) => {
  localStorage.setItem(KEY, val ? 'dark' : 'light')
  applyTheme(val)
})

export function useTheme() {
  function toggle() {
    isDark.value = !isDark.value
  }
  return { isDark, toggle }
}
