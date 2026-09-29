<template>
  <div class="thesis-page">
    <!-- 顶部滚动公告条 -->
    <div v-if="noticeVisible" class="notice-bar">
      <div class="notice-track">
        <span class="notice-text">{{ noticeText }}</span>
        <span class="notice-text">{{ noticeText }}</span>
      </div>
    </div>

    <!-- 搜索区 -->
    <section class="search-section">
      <h1 class="search-title">毕业设计进度查询</h1>
      <p class="search-subtitle">输入你的毕业设计题目，查询最新进度</p>
      <div class="search-box">
        <input
          v-model="title"
          class="search-input"
          type="text"
          placeholder="请输入毕业设计题目（精确匹配）"
          @keyup.enter="startQuery"
        />
        <button class="search-btn" @click="startQuery">查询</button>
      </div>
    </section>

    <!-- 活动公告区 -->
    <section class="activities-section">
      <h2 class="section-title">活动公告</h2>
      <div v-if="loadingActivities" class="hint">加载中...</div>
      <div v-else-if="activities.length === 0" class="hint">暂无活动公告</div>
      <div v-else class="activity-list">
        <div v-for="act in activities" :key="act.id" class="activity-card">
          <h3 class="activity-title">{{ act.title }}</h3>
          <p class="activity-content">{{ act.content }}</p>
          <div class="activity-date">{{ formatDate(act.createdAt) }}</div>
        </div>
      </div>
    </section>

    <!-- 6 位验证码弹窗 -->
    <div v-if="showModal" class="modal-mask" @click.self="closeModal">
      <div class="modal">
        <h3 class="modal-title">验证身份</h3>
        <p class="modal-desc">请输入你的 6 位唯一验证码</p>
        <input
          ref="codeInput"
          v-model="code"
          class="code-input"
          type="text"
          inputmode="numeric"
          maxlength="6"
          placeholder="6 位数字"
          @input="onCodeInput"
          @keyup.enter="confirmQuery"
        />
        <div class="modal-actions">
          <button class="btn btn-cancel" :disabled="querying" @click="closeModal">取消</button>
          <button class="btn btn-confirm" :disabled="querying" @click="confirmQuery">
            {{ querying ? '查询中...' : '确认' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../../api'
import { useThesisStore } from '../../store/thesis'

interface Activity {
  id: number
  title: string
  content: string
  published?: boolean
  createdAt: string
}

const router = useRouter()
const thesisStore = useThesisStore()

const noticeText = ref('')
const noticeVisible = ref(false)

const title = ref('')
const code = ref('')
const showModal = ref(false)
const querying = ref(false)
const codeInput = ref<HTMLInputElement | null>(null)

const activities = ref<Activity[]>([])
const loadingActivities = ref(false)

async function fetchNotice() {
  try {
    const data: any = await api.getThesisNotice()
    if (data && data.enabled && data.text) {
      noticeText.value = data.text
      noticeVisible.value = true
    }
  } catch {
    // 漂浮字加载失败时静默忽略，不影响主流程
  }
}

async function fetchActivities() {
  loadingActivities.value = true
  try {
    const data: any = await api.getThesisActivities()
    activities.value = data?.activities || []
  } catch {
    activities.value = []
  } finally {
    loadingActivities.value = false
  }
}

function startQuery() {
  const t = title.value.trim()
  if (!t) {
    alert('请输入毕业设计题目')
    return
  }
  title.value = t
  code.value = ''
  showModal.value = true
  nextTick(() => codeInput.value?.focus())
}

function closeModal() {
  if (querying.value) return
  showModal.value = false
  code.value = ''
}

function onCodeInput() {
  code.value = code.value.replace(/\D/g, '').slice(0, 6)
}

async function confirmQuery() {
  const t = title.value.trim()
  const c = code.value.trim()
  if (!t) {
    alert('请输入毕业设计题目')
    return
  }
  if (!/^\d{6}$/.test(c)) {
    alert('请输入 6 位数字验证码')
    return
  }
  querying.value = true
  try {
    const data: any = await api.queryThesisProject({ title: t, code: c })
    thesisStore.setResult(data)
    showModal.value = false
    code.value = ''
    router.push('/thesis/result')
  } catch (err: any) {
    // 统一失败提示：优先展示后端返回的 message
    const msg = err?.response?.data?.message || err?.message || '查询失败，请稍后重试'
    alert(msg)
  } finally {
    querying.value = false
  }
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

onMounted(() => {
  fetchNotice()
  fetchActivities()
})
</script>

<style scoped>
.thesis-page {
  min-height: calc(100vh - var(--nav-h));
  background: var(--bg);
}

/* 漂浮字 marquee */
.notice-bar {
  overflow: hidden;
  background: linear-gradient(90deg, #ff7a59, #ff9f43);
  color: #fff;
  padding: 10px 0;
  box-shadow: 0 2px 8px rgba(255, 122, 89, 0.35);
}
.notice-track { display: inline-flex; white-space: nowrap; animation: marquee 22s linear infinite; }
.notice-text { display: inline-block; padding: 0 60px; font-size: 15px; letter-spacing: 1px; }
@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }

/* 搜索区 */
.search-section {
  min-height: 62vh;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 60px 20px;
  text-align: center;
}
.search-title { font-size: clamp(30px, 5vw, 44px); font-weight: 900; color: var(--text-1); margin-bottom: 12px; }
.search-subtitle { font-size: 15px; color: var(--text-3); margin-bottom: 32px; }
.search-box { display: flex; width: 100%; max-width: 620px; gap: 12px; }
.search-input {
  flex: 1; height: 52px; padding: 0 18px; font-size: 16px;
  border: 1px solid var(--border); border-radius: 10px;
  background: var(--card-bg); color: var(--text-1);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.search-input:focus { outline: none; border-color: #ff7a59; box-shadow: 0 0 0 3px rgba(255, 122, 89, 0.15); }
.search-btn {
  height: 52px; padding: 0 34px; font-size: 17px; color: #fff; border: none; cursor: pointer;
  background: linear-gradient(90deg, #ff7a59, #ff9f43); border-radius: 10px;
  transition: opacity 0.2s, transform 0.1s;
}
.search-btn:hover { opacity: 0.9; }
.search-btn:active { transform: translateY(1px); }

/* 活动公告 */
.activities-section { max-width: 880px; margin: 0 auto; padding: 20px 20px 60px; }
.section-title {
  font-size: 20px; font-weight: 800; color: var(--text-1);
  margin-bottom: 24px; padding-left: 12px; border-left: 4px solid #ff7a59;
}
.hint { color: var(--text-3); text-align: center; padding: 30px 0; }
.activity-list { display: flex; flex-direction: column; gap: 16px; }
.activity-card {
  background: var(--card-bg); border: 1px solid var(--border);
  border-radius: 12px; padding: 22px 24px;
  box-shadow: 0 2px 12px rgba(44, 62, 80, 0.08);
  transition: transform 0.2s, box-shadow 0.2s;
}
.activity-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(44, 62, 80, 0.12); }
.activity-title { font-size: 15px; font-weight: 700; color: var(--text-1); margin-bottom: 8px; }
.activity-content { font-size: 13px; line-height: 1.8; color: var(--text-2); white-space: pre-wrap; margin-bottom: 12px; }
.activity-date { font-size: 13px; color: var(--text-3); }

/* 弹窗 */
.modal-mask {
  position: fixed; inset: 0; z-index: 100;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0, 0, 0, 0.5); padding: 20px;
}
.modal {
  width: 100%; max-width: 360px; background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 14px; padding: 28px 26px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
}
.modal-title { font-size: 20px; font-weight: 700; color: var(--text-1); margin-bottom: 8px; }
.modal-desc { font-size: 14px; color: var(--text-3); margin-bottom: 18px; }
.code-input {
  width: 100%; height: 54px; text-align: center; font-size: 24px; letter-spacing: 10px;
  border: 1px solid var(--border); border-radius: 10px;
  background: var(--bg); color: var(--text-1);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.code-input:focus { outline: none; border-color: #ff7a59; box-shadow: 0 0 0 3px rgba(255, 122, 89, 0.15); }
.modal-actions { display: flex; gap: 12px; margin-top: 22px; }
.btn { flex: 1; height: 44px; font-size: 15px; border: none; cursor: pointer; border-radius: 9px; transition: opacity 0.2s; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-cancel { background: var(--bg); color: var(--text-2); }
.btn-confirm { background: linear-gradient(90deg, #ff7a59, #ff9f43); color: #fff; }

@media (max-width: 600px) {
  .search-title { font-size: 28px; }
  .search-box { flex-direction: column; }
  .search-btn { width: 100%; }
}
</style>
