<template>
  <Transition name="popup">
    <div v-if="visible" class="popup-overlay" @click.self="close">
      <div class="popup-card">
        <!-- 关闭按钮 -->
        <button class="popup-close" @click="close">✕</button>

        <!-- 装饰光效 -->
        <div class="popup-glow"></div>

        <!-- 内容 -->
        <div class="popup-content">
          <!-- 图片（如果有） -->
          <img v-if="popupData.imageUrl" :src="popupData.imageUrl" class="popup-image" alt="活动" />

          <!-- 标题 -->
          <h2 class="popup-title">{{ popupData.title }}</h2>

          <!-- 描述 -->
          <p class="popup-desc">{{ popupData.description }}</p>

          <!-- 按钮 -->
          <button class="popup-btn" @click="goToLink">
            {{ popupData.buttonText }}
          </button>

          <!-- 今日不再显示 -->
          <label class="popup-dismiss">
            <input type="checkbox" v-model="dontShowToday" @change="saveDismiss" />
            <span>今日不再显示</span>
          </label>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'

const router = useRouter()
const visible = ref(false)
const popupData = ref({
  enabled: false,
  title: '',
  description: '',
  buttonText: '',
  linkUrl: '',
  imageUrl: '',
  showCondition: 'all',
})
const dontShowToday = ref(false)

function isDismissedToday(): boolean {
  const dismissed = localStorage.getItem('popup-dismissed-date')
  if (!dismissed) return false
  const today = new Date().toDateString()
  return dismissed === today
}

function saveDismiss() {
  if (dontShowToday.value) {
    localStorage.setItem('popup-dismissed-date', new Date().toDateString())
    visible.value = false
  }
}

function close() {
  visible.value = false
}

function goToLink() {
  close()
  if (popupData.value.linkUrl) {
    router.push(popupData.value.linkUrl)
  }
}

async function loadPopup() {
  if (isDismissedToday()) return

  try {
    const res: any = await api.getActivityPopup()
    if (res.data?.enabled) {
      popupData.value = res.data
      visible.value = true
    }
  } catch {
    // 静默失败
  }
}

onMounted(() => {
  // 延迟显示，避免阻塞首页加载
  setTimeout(loadPopup, 1500)
})
</script>

<style scoped>
.popup-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.popup-card {
  position: relative;
  background: var(--card-bg, #fff);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 32px 28px;
  max-width: 380px;
  width: 100%;
  text-align: center;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

/* 装饰光效 */
.popup-glow {
  position: absolute;
  top: -50px;
  left: 50%;
  transform: translateX(-50%);
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(0, 212, 255, 0.15) 0%, transparent 70%);
  pointer-events: none;
}

.popup-close {
  position: absolute;
  top: 12px;
  right: 16px;
  background: none;
  border: none;
  color: var(--text-3, #999);
  font-size: 18px;
  cursor: pointer;
  z-index: 1;
  transition: color 0.2s;
}
.popup-close:hover {
  color: var(--text-1, #333);
}

.popup-content {
  position: relative;
  z-index: 1;
}

.popup-image {
  width: 100%;
  max-height: 180px;
  object-fit: cover;
  border-radius: 12px;
  margin-bottom: 16px;
}

.popup-title {
  font-size: 22px;
  font-weight: 900;
  color: var(--text-1, #333);
  margin-bottom: 8px;
  line-height: 1.3;
}

.popup-desc {
  font-size: 14px;
  color: var(--text-2, #666);
  line-height: 1.6;
  margin-bottom: 24px;
}

.popup-btn {
  width: 100%;
  padding: 14px 24px;
  background: linear-gradient(135deg, #00d4ff, #0099cc);
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 20px rgba(0, 212, 255, 0.3);
}
.popup-btn:hover {
  box-shadow: 0 6px 30px rgba(0, 212, 255, 0.5);
  transform: translateY(-2px);
}

.popup-dismiss {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 16px;
  font-size: 12px;
  color: var(--text-3, #999);
  cursor: pointer;
}
.popup-dismiss input {
  cursor: pointer;
}

/* 动画 */
.popup-enter-active, .popup-leave-active {
  transition: opacity 0.3s ease;
}
.popup-enter-active .popup-card, .popup-leave-active .popup-card {
  transition: transform 0.3s ease;
}
.popup-enter-from, .popup-leave-to {
  opacity: 0;
}
.popup-enter-from .popup-card {
  transform: scale(0.9) translateY(20px);
}
</style>
