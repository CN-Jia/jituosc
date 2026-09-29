<template>
  <div class="forum-wrap">
    <div class="page-banner">
      <div class="page-banner-inner">
        <h1 class="page-banner-title">论坛社区</h1>
        <p class="page-banner-sub">公告、服务说明、常见问题、用户交流</p>
      </div>
    </div>
    <div class="page-container">

    <!-- 板块 tab -->
    <div class="board-tabs">
      <button
        v-for="b in boards" :key="b.key"
        class="board-tab" :class="{ active: activeBoard === b.key }"
        @click="switchBoard(b.key)"
      >
        {{ b.icon }} {{ b.label }}
      </button>
    </div>

    <div class="filter-row">
      <router-link v-if="store.isLoggedIn && activeBoard === 'exchange'" to="/forum/new" class="btn btn-primary new-post-btn">+ 发帖</router-link>
    </div>

    <div v-if="loading" class="loading-box">
      <span class="spinner" />
    </div>

    <div v-else-if="posts.length === 0" class="empty-state">
      <div class="empty-state-icon">💬</div>
      <div class="empty-state-text">暂无帖子</div>
    </div>

    <div v-else class="post-list">
      <router-link
        v-for="post in posts" :key="post.id"
        :to="`/forum/${post.id}`"
        class="post-card"
        :class="{ pinned: post.isPinned }"
      >
        <div class="post-meta">
          <span v-if="post.isPinned" class="pin-badge">📌 置顶</span>
          <span class="post-date">{{ fmt(post.createdAt) }}</span>
        </div>
        <h3 class="post-title">{{ post.title }}</h3>
        <p v-if="post.summary" class="post-summary">{{ post.summary }}</p>
        <div class="post-footer">
          <span class="post-author">{{ post.author?.nickname ?? '管理员' }}</span>
          <span class="post-comments">💬 {{ post._count?.comments ?? 0 }} 条评论</span>
        </div>
      </router-link>
    </div>

    <div v-if="total > pageSize" class="load-more">
      <button class="btn btn-outline" @click="loadMore" :disabled="loading">
        {{ loading ? '加载中...' : '加载更多' }}
      </button>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserStore } from '../../store/user'
import { api } from '../../api'

const store = useUserStore()
const posts = ref<any[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = 20
const total = ref(0)
const activeBoard = ref('')

const boards = [
  { key: '', label: '全部', icon: '📋' },
  { key: 'announcement', label: '公告通知', icon: '📢' },
  { key: 'service', label: '服务说明', icon: '📋' },
  { key: 'faq', label: '常见问题', icon: '❓' },
  { key: 'exchange', label: '用户交流', icon: '💬' },
]

function fmt(d: string) {
  const date = new Date(d)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

async function fetchPosts(reset = false) {
  if (reset) { page.value = 1; posts.value = [] }
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize }
    if (activeBoard.value) params.board = activeBoard.value
    const res: any = await api.getPosts(params)
    const list = res.data?.list ?? []
    if (reset) posts.value = list
    else posts.value.push(...list)
    total.value = res.data?.total ?? 0
  } finally { loading.value = false }
}

function switchBoard(key: string) {
  activeBoard.value = key
  fetchPosts(true)
}

function loadMore() {
  page.value++
  fetchPosts()
}

onMounted(() => fetchPosts(true))
</script>

<style scoped>
.forum-wrap { background: var(--bg); min-height: calc(100vh - var(--nav-h)); }
.page-banner {
  background: linear-gradient(135deg, #060d1f 0%, #0f1f4d 55%, #1e3a5f 100%);
  padding: 40px 32px 36px; text-align: center;
}
.page-banner-inner { max-width: 900px; margin: 0 auto; }
.page-banner-title { font-size: 28px; font-weight: 900; color: #fff; margin-bottom: 6px; }
.page-banner-sub { font-size: 14px; color: rgba(255,255,255,0.55); }

/* 板块 tabs */
.board-tabs { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
.board-tab {
  background: var(--card); border: 1px solid var(--border);
  border-radius: 20px; padding: 8px 18px; font-size: 14px;
  color: var(--text-2); cursor: pointer;
  transition: all 0.15s;
}
.board-tab:hover { border-color: var(--primary); color: var(--primary); }
.board-tab.active {
  background: var(--primary); color: #fff; border-color: var(--primary);
}

.filter-row { display: flex; justify-content: flex-end; margin-bottom: 20px; }
.new-post-btn { font-size: 14px; padding: 8px 16px; }

.loading-box { display: flex; justify-content: center; padding: 48px; }

.post-list { display: flex; flex-direction: column; gap: 12px; }

.post-card {
  display: block; background: var(--card); border-radius: 12px;
  padding: 20px 24px; text-decoration: none; color: inherit;
  border: 1px solid var(--border); transition: all 0.15s;
  box-shadow: var(--shadow-sm);
}
.post-card:hover { border-color: var(--primary); box-shadow: var(--shadow); transform: translateY(-1px); }
.post-card.pinned { border-left: 3px solid var(--primary); }

.post-meta { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.pin-badge { font-size: 12px; background: var(--primary-light); color: var(--primary); padding: 2px 8px; border-radius: 4px; font-weight: 600; }
.post-date { font-size: 12px; color: var(--text-3); }

.post-title { font-size: 17px; font-weight: 700; color: var(--text-1); margin-bottom: 6px; line-height: 1.4; }
.post-summary { font-size: 14px; color: var(--text-2); margin-bottom: 10px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

.post-footer { display: flex; align-items: center; gap: 16px; font-size: 13px; color: var(--text-3); }
.post-author { font-weight: 500; }

.load-more { display: flex; justify-content: center; padding: 24px 0; }

@media (max-width: 640px) {
  .page-banner { padding: 28px 20px 24px; }
  .page-banner-title { font-size: 22px; }
  .board-tabs { gap: 6px; }
  .board-tab { padding: 6px 14px; font-size: 13px; }
  .post-card { padding: 16px; }
  .post-title { font-size: 15px; }
}
</style>
