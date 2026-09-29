<template>
  <div class="page-container">
    <button class="back-btn" @click="$router.back()">← 返回</button>

    <div v-if="loading" class="loading-box"><span class="spinner" /></div>

    <template v-else-if="post">
      <div class="post-detail card">
        <div class="post-meta">
          <span class="badge" :class="post.type === 'ANNOUNCEMENT' ? 'badge-blue' : 'badge-gray'">
            {{ post.type === 'ANNOUNCEMENT' ? '📢 公告' : '💬 讨论' }}
          </span>
          <span class="post-time">{{ fmtFull(post.createdAt) }}</span>
        </div>
        <h1 class="post-title">{{ post.title }}</h1>
        <div class="post-author">👤 {{ post.author?.nickname ?? '管理员' }}</div>
        <hr class="divider" />
        <div class="post-content" v-html="renderedContent" />
      </div>

      <!-- 评论区 -->
      <div class="comments-section">
        <h3 class="comments-title">评论区 <span class="comments-count">{{ post.comments?.length ?? 0 }}</span></h3>

        <div v-if="post.comments?.length" class="comment-list">
          <div v-for="c in post.comments" :key="c.id" class="comment-item">
            <div class="comment-header">
              <span class="comment-user">{{ c.user?.nickname }}</span>
              <span class="comment-grade">{{ gradeLabel(c.user?.grade) }}</span>
              <span class="comment-time">{{ fmt(c.createdAt) }}</span>
              <button
                v-if="store.isLoggedIn && c.userId === store.userInfo?.id"
                class="comment-del-btn"
                @click="deleteComment(c.id)"
                title="删除评论"
              >删除</button>
            </div>
            <p class="comment-content">{{ c.content }}</p>
          </div>
        </div>
        <div v-else class="empty-state" style="padding:24px 0">
          <div style="color:var(--text-3);font-size:14px">暂无评论，快来发表看法吧</div>
        </div>

        <!-- 发表评论 -->
        <div v-if="store.isLoggedIn" class="comment-form">
          <textarea v-model="commentText" class="form-input" :rows="3" placeholder="分享你的看法..." style="resize:vertical" />
          <button class="btn btn-primary" :disabled="submitting || !commentText.trim()" @click="submitComment">
            {{ submitting ? '发布中...' : '发表评论' }}
          </button>
        </div>
        <div v-else class="comment-login-hint">
          <router-link to="/login" class="auth-link">登录</router-link> 后参与讨论
        </div>
      </div>
    </template>

    <div v-else class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">帖子不存在</div></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '../../store/user'
import { api } from '../../api'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const route = useRoute()
const store = useUserStore()
const post = ref<any>(null)
const loading = ref(false)
const commentText = ref('')
const submitting = ref(false)


const gradeLabel = (g?: string) => ({ FRESHMAN: '大一', SOPHOMORE: '大二', JUNIOR: '大三' }[g ?? ''] ?? '')

const fmt = (d: string) => {
  const date = new Date(d)
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`
}
const fmtFull = (d: string) => {
  const date = new Date(d)
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`
}

const renderedContent = computed(() => {
  if (!post.value?.content) return ''
  const raw = marked.parse(post.value.content, { async: false }) as string
  return DOMPurify.sanitize(raw)
})

async function load() {
  loading.value = true
  try {
    const res: any = await api.getPost(route.params.id as string)
    post.value = res.data
  } finally { loading.value = false }
}

async function submitComment() {
  if (!commentText.value.trim()) return
  submitting.value = true
  try {
    const res: any = await api.createComment(post.value.id, commentText.value)
    post.value.comments = [...(post.value.comments ?? []), res.data]
    commentText.value = ''
  } catch (err: any) {
    alert(err?.message ?? '评论失败')
  } finally { submitting.value = false }
}

async function deleteComment(commentId: string) {
  if (!confirm('确认删除这条评论？')) return
  try {
    await api.deleteMyComment(post.value.id, commentId)
    post.value.comments = post.value.comments.filter((c: any) => c.id !== commentId)
  } catch (err: any) {
    alert(err?.message ?? '删除失败')
  }
}

onMounted(load)
</script>

<style scoped>
.back-btn { background: none; border: none; color: var(--primary); font-size: 14px; cursor: pointer; padding: 0 0 16px; display: block; }
.back-btn:hover { text-decoration: underline; }
.loading-box { display: flex; justify-content: center; padding: 48px; }
.post-detail { margin-bottom: 24px; }
.post-meta { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.post-time { font-size: 12px; color: var(--text-3); }
.post-title { font-size: 22px; font-weight: 800; color: var(--text-1); margin-bottom: 8px; line-height: 1.4; }
.post-author { font-size: 13px; color: var(--text-3); }
.post-content { font-size: 15px; line-height: 1.8; color: var(--text-2); }
.post-content :deep(h1), .post-content :deep(h2), .post-content :deep(h3) { font-weight: 700; color: var(--text-1); margin: 16px 0 8px; }
.post-content :deep(h1) { font-size: 22px; }
.post-content :deep(h2) { font-size: 18px; }
.post-content :deep(h3) { font-size: 16px; }
.post-content :deep(p) { margin: 8px 0; }
.post-content :deep(code) { background: #1c2333; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; color: #60a5fa; }
.post-content :deep(pre) { background: #1e1e2e; padding: 14px 16px; border-radius: 8px; overflow-x: auto; margin: 10px 0; }
.post-content :deep(pre code) { background: none; color: #cdd6f4; font-size: 13px; }
.post-content :deep(blockquote) { border-left: 3px solid var(--primary); padding: 4px 12px; margin: 8px 0; color: var(--text-3); background: var(--bg); border-radius: 0 6px 6px 0; }
.post-content :deep(ul), .post-content :deep(ol) { padding-left: 22px; margin: 6px 0; }
.post-content :deep(li) { margin: 3px 0; }
.post-content :deep(img) { max-width: 100%; border-radius: 8px; margin: 8px 0; }
.post-content :deep(a) { color: var(--primary); text-decoration: underline; }
.post-content :deep(hr) { border: none; border-top: 1px solid var(--border); margin: 16px 0; }
.post-content :deep(table) { border-collapse: collapse; width: 100%; margin: 8px 0; }
.post-content :deep(th), .post-content :deep(td) { border: 1px solid var(--border); padding: 6px 12px; font-size: 13px; }
.post-content :deep(th) { background: var(--bg); font-weight: 600; }

.comments-section { display: flex; flex-direction: column; gap: 16px; }
.comments-title { font-size: 16px; font-weight: 700; color: var(--text-1); display: flex; align-items: center; gap: 8px; }
.comments-count { background: var(--border); color: var(--text-3); font-size: 12px; padding: 2px 8px; border-radius: 10px; }

.comment-list { display: flex; flex-direction: column; gap: 12px; }
.comment-item { background: var(--bg); border-radius: 10px; padding: 14px 16px; }
.comment-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
.comment-user { font-size: 13px; font-weight: 600; color: var(--text-1); }
.comment-grade { font-size: 11px; color: var(--primary); background: var(--primary-light); padding: 1px 6px; border-radius: 10px; }
.comment-time { font-size: 11px; color: var(--text-3); margin-left: auto; }
.comment-del-btn { font-size: 11px; color: #f87171; background: none; border: none; cursor: pointer; padding: 2px 6px; border-radius: 4px; transition: background 0.2s; }
.comment-del-btn:hover { background: rgba(245,108,108,0.1); }
.comment-content { font-size: 14px; color: var(--text-2); line-height: 1.6; }

.comment-form { display: flex; flex-direction: column; gap: 10px; }
.comment-login-hint { text-align: center; color: var(--text-3); font-size: 14px; padding: 16px; background: var(--bg); border-radius: 10px; }
.auth-link { color: var(--primary); font-weight: 600; }

</style>
