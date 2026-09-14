<template>
  <div class="thesis-result-page">
    <div class="container">
      <div class="header">
        <button class="back-btn" @click="goBack">← 返回查询</button>
      </div>

      <!-- 项目信息 + 进度条 -->
      <section class="project-card">
        <h1 class="project-title">{{ store.project.title || '未找到项目信息' }}</h1>
        <div class="project-meta">
          <div class="meta-item">
            <span class="meta-label">学生姓名</span>
            <span class="meta-value">{{ store.project.studentName || '-' }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">学号</span>
            <span class="meta-value">{{ store.project.studentNo || '-' }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">导师</span>
            <span class="meta-value">{{ store.project.advisor || '-' }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">专业</span>
            <span class="meta-value">{{ store.project.major || '-' }}</span>
          </div>
        </div>

        <div class="progress-block">
          <div class="progress-head">
            <span class="progress-label">当前进度</span>
            <span class="progress-percent">{{ store.currentPercent }}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: clampPercent(store.currentPercent) + '%' }"></div>
          </div>
        </div>
      </section>

      <!-- 进度明细（时间倒序） -->
      <section class="progress-list-section">
        <h2 class="section-title">进度明细</h2>
        <div v-if="sortedProgresses.length === 0" class="hint">暂无进度记录</div>
        <div v-for="item in sortedProgresses" :key="item.id" class="progress-card">
          <div class="progress-card-head">
            <h3 class="progress-card-title">{{ item.title }}</h3>
            <span class="progress-card-percent">{{ item.percent }}%</span>
          </div>
          <p v-if="item.content" class="progress-card-content">{{ item.content }}</p>
          <div class="progress-card-date">{{ formatDate(item.createdAt) }}</div>
          <div v-if="item.images && item.images.length" class="image-wall">
            <div v-for="img in item.images" :key="img.id" class="image-item">
              <img :src="img.url" :alt="img.filename || item.title" loading="lazy" @click="preview(img.url)" />
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- 图片预览 -->
    <div v-if="previewUrl" class="preview-mask" @click="previewUrl = ''">
      <img class="preview-img" :src="previewUrl" alt="preview" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useThesisStore } from '../../store/thesis'

const router = useRouter()
const store = useThesisStore()
const previewUrl = ref('')

// 按 createdAt 倒序排列进度
const sortedProgresses = computed(() => {
  return [...store.progresses].sort((a, b) => {
    const ta = new Date(a.createdAt).getTime()
    const tb = new Date(b.createdAt).getTime()
    const va = isNaN(ta) ? 0 : ta
    const vb = isNaN(tb) ? 0 : tb
    return vb - va
  })
})

function clampPercent(n: number) {
  if (isNaN(n)) return 0
  return Math.min(100, Math.max(0, n))
}

function goBack() {
  router.push('/thesis')
}

function preview(url: string) {
  previewUrl.value = url
}

function formatDate(s: string) {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
</script>

<style scoped>
.thesis-result-page { min-height: calc(100vh - var(--nav-h, 64px)); background: var(--bg, #f5f7fa); }
.container { max-width: 880px; margin: 0 auto; padding: 24px 20px 60px; }
.header { margin-bottom: 20px; }
.back-btn {
  height: 40px; padding: 0 18px; font-size: 15px; cursor: pointer;
  color: var(--text-hi, #2c3e50); background: var(--bg-panel, #fff);
  border: 1px solid var(--border, #d8dee6); border-radius: 9px; transition: all 0.2s;
}
.back-btn:hover { border-color: #ff7a59; color: #ff7a59; }

/* 项目信息卡片 */
.project-card {
  background: var(--bg-panel, #fff); border: 1px solid var(--border, transparent);
  border-radius: 14px; padding: 28px;
  box-shadow: 0 2px 16px rgba(44, 62, 80, 0.08); margin-bottom: 28px;
}
.project-title { font-size: 24px; font-weight: 700; color: var(--text-hi, #2c3e50); margin-bottom: 20px; line-height: 1.4; }
.project-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 26px; }
.meta-item { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; background: var(--bg-deep, #f7f9fb); border-radius: 9px; }
.meta-label { font-size: 12px; color: var(--text-lo, #95a5a6); }
.meta-value { font-size: 15px; color: var(--text-hi, #2c3e50); font-weight: 500; }

/* 进度条 */
.progress-block { margin-top: 4px; }
.progress-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.progress-label { font-size: 14px; color: var(--text-lo, #7f8c8d); }
.progress-percent { font-size: 22px; font-weight: 700; color: #ff7a59; }
.progress-bar { height: 16px; background: var(--bg-deep, #eef1f4); border-radius: 999px; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #ff7a59, #ff9f43); border-radius: 999px; transition: width 0.6s ease; }

/* 进度明细 */
.section-title {
  font-size: 22px; font-weight: 700; color: var(--text-hi, #2c3e50);
  margin-bottom: 20px; padding-left: 12px; border-left: 4px solid #ff7a59;
}
.hint { color: var(--text-lo, #95a5a6); text-align: center; padding: 30px 0; }
.progress-card {
  background: var(--bg-panel, #fff); border: 1px solid var(--border, transparent);
  border-radius: 12px; padding: 22px 24px;
  box-shadow: 0 2px 12px rgba(44, 62, 80, 0.08); margin-bottom: 16px;
}
.progress-card-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 10px; }
.progress-card-title { font-size: 17px; font-weight: 600; color: var(--text-hi, #2c3e50); }
.progress-card-percent { flex-shrink: 0; font-size: 15px; font-weight: 700; color: #ff7a59; }
.progress-card-content { font-size: 15px; line-height: 1.7; color: var(--text-md, #555); white-space: pre-wrap; margin-bottom: 12px; }
.progress-card-date { font-size: 13px; color: var(--text-lo, #95a5a6); margin-bottom: 12px; }

/* 截图墙 */
.image-wall { display: flex; flex-wrap: wrap; gap: 10px; }
.image-item { width: 150px; height: 110px; overflow: hidden; border-radius: 8px; cursor: zoom-in; background: var(--bg-deep, #f0f2f5); }
.image-item img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.2s; }
.image-item:hover img { transform: scale(1.06); }

/* 图片预览 */
.preview-mask { position: fixed; inset: 0; z-index: 200; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.85); padding: 20px; }
.preview-img { max-width: 100%; max-height: 100%; border-radius: 8px; }
</style>
