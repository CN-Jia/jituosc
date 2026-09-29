<template>
  <Transition name="wg-fade">
    <div v-if="visible" class="wg-overlay" @click="dismiss">
      <!-- 右上角箭头 -->
      <div class="wg-arrow-wrap">
        <svg class="wg-arrow" viewBox="0 0 60 120" fill="none">
          <path d="M30 110 C30 60 50 30 50 10" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
          <polyline points="38,6 50,10 46,22" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>

      <!-- 提示卡片 -->
      <div class="wg-card" @click.stop>
        <div class="wg-icon">🌐</div>
        <h3 class="wg-title">请在浏览器中打开</h3>
        <p class="wg-desc">
          点击右上角 <strong>···</strong><br>
          选择「<strong>在浏览器中打开</strong>」<br>
          获得完整体验
        </p>
        <button class="wg-btn" @click="dismiss">我知道了</button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const visible = ref(false)

function isWeChat(): boolean {
  return /MicroMessenger/i.test(navigator.userAgent)
}

function dismiss() {
  visible.value = false
  sessionStorage.setItem('wg_dismissed', '1')
}

onMounted(() => {
  if (isWeChat() && !sessionStorage.getItem('wg_dismissed')) {
    visible.value = true
  }
})
</script>

<style scoped>
.wg-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  background: rgba(0, 0, 0, 0.88);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

/* 右上角箭头 */
.wg-arrow-wrap {
  position: absolute;
  top: 8px;
  right: 16px;
  width: 60px;
  height: 120px;
  animation: wg-bounce 1.2s ease-in-out infinite;
}
.wg-arrow {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 0 8px rgba(255,255,255,0.6));
}
@keyframes wg-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

/* 提示卡片 */
.wg-card {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  padding: 36px 32px;
  max-width: 320px;
  width: 100%;
  text-align: center;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  margin-top: 20px;
}

.wg-icon {
  font-size: 48px;
  margin-bottom: 16px;
  line-height: 1;
}

.wg-title {
  font-size: 20px;
  font-weight: 800;
  color: #fff;
  margin-bottom: 14px;
  letter-spacing: 0.5px;
}

.wg-desc {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.75);
  line-height: 1.9;
  margin-bottom: 28px;
}
.wg-desc strong {
  color: #fff;
  font-weight: 700;
}

.wg-btn {
  width: 100%;
  padding: 13px 0;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.wg-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

/* 过渡动画 */
.wg-fade-enter-active, .wg-fade-leave-active {
  transition: opacity 0.3s ease;
}
.wg-fade-enter-from, .wg-fade-leave-to {
  opacity: 0;
}
</style>
