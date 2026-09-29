import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import './assets/theme.css'
import App from './App.vue'
import router from './router'

// 管理端只保留深色主题（原明暗切换已移除）
// 一并清掉历史遗留的主题偏好，避免老浏览器里存的值造成不一致
localStorage.removeItem('jituo-admin-theme')
document.documentElement.classList.add('dark')

const app = createApp(App)

// 全局注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })
app.mount('#app')
