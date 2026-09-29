<template>
  <div class="page-container new-post-page">
    <div class="page-header">
      <button class="back-btn" @click="$router.back()">← 返回论坛</button>
      <h2 class="page-title">发布新帖子</h2>
    </div>

    <div class="editor-layout">
      <!-- 主编辑区 -->
      <div class="editor-main">
        <div class="form-group">
          <label class="form-label">标题 <span class="required">*</span></label>
          <input v-model="form.title" class="form-input" placeholder="请输入帖子标题（2~100字）" maxlength="100" />
          <span class="char-count">{{ form.title.length }} / 100</span>
        </div>

        <div class="form-group">
          <label class="form-label">摘要 <span class="hint">（可选，不填则自动截取正文）</span></label>
          <input v-model="form.summary" class="form-input" placeholder="一句话介绍帖子内容" maxlength="200" />
        </div>

        <div class="form-group">
          <label class="form-label">
            正文内容 <span class="required">*</span>
            <span class="hint">— 支持 Markdown 语法</span>
          </label>
          <div class="editor-toolbar">
            <button class="toolbar-btn" :class="{ active: !previewMode }" @click="previewMode = false">✏️ 编辑</button>
            <button class="toolbar-btn" :class="{ active: previewMode }" @click="previewMode = true">👁️ 预览</button>
            <div class="toolbar-divider" />
            <button class="toolbar-btn" title="粗体" @click="insertMd('**', '**', '粗体文字')"><b>B</b></button>
            <button class="toolbar-btn" title="斜体" @click="insertMd('*', '*', '斜体文字')"><i>I</i></button>
            <button class="toolbar-btn" title="代码" @click="insertMd('`', '`', '代码')">&lt;/&gt;</button>
            <button class="toolbar-btn" title="链接" @click="insertMd('[', '](https://)', '链接文字')">🔗</button>
            <button class="toolbar-btn" title="图片链接" @click="showImgHelper = true">🖼️</button>
            <button class="toolbar-btn" title="引用" @click="insertLine('> ', '引用内容')">"</button>
            <button class="toolbar-btn" title="无序列表" @click="insertLine('- ', '列表项')">≡</button>
            <button class="toolbar-btn" title="分割线" @click="insertLine('---', '')">—</button>
          </div>

          <div v-if="!previewMode" class="editor-wrap">
            <textarea
              ref="editorRef"
              v-model="form.content"
              class="md-editor"
              placeholder="在这里写下你的内容...支持 Markdown 格式

**粗体**  *斜体*  `行内代码`

## 二级标题

- 列表项
- 列表项

> 引用内容

![图片描述](图片URL)"
              @keydown.tab.prevent="onTab"
            />
          </div>

          <div v-else class="preview-wrap">
            <div v-if="!form.content" class="preview-empty">暂无内容</div>
            <div v-else class="md-preview" v-html="renderedContent" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">封面图片 <span class="hint">（可选，粘贴图片URL）</span></label>
          <div class="cover-input-row">
            <input v-model="form.cover" class="form-input" placeholder="https://example.com/image.jpg" />
            <div v-if="form.cover" class="cover-preview">
              <img :src="form.cover" alt="封面预览" @error="coverError = true" />
              <span v-if="coverError" class="cover-error">图片加载失败</span>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn btn-outline" @click="$router.back()">取消</button>
          <button class="btn btn-primary" :disabled="submitting || !canSubmit" @click="submit">
            {{ submitting ? '发布中...' : '发布帖子' }}
          </button>
        </div>
      </div>

      <!-- 侧边说明 -->
      <aside class="editor-sidebar">
        <div class="sidebar-card">
          <h4 class="sidebar-title">发帖说明</h4>
          <ul class="sidebar-list">
            <li>帖子发布后需要管理员审核后才会公开显示</li>
            <li>请勿发布广告、违规内容</li>
            <li>正文支持 Markdown 语法</li>
            <li>需要完成邮箱验证才能发帖</li>
          </ul>
        </div>

        <div class="sidebar-card md-help">
          <h4 class="sidebar-title">Markdown 速查</h4>
          <table class="md-table">
            <tr><td><code># 标题</code></td><td>一级标题</td></tr>
            <tr><td><code>**粗体**</code></td><td><strong>粗体</strong></td></tr>
            <tr><td><code>*斜体*</code></td><td><em>斜体</em></td></tr>
            <tr><td><code>`代码`</code></td><td><code>代码</code></td></tr>
            <tr><td><code>- 列表</code></td><td>无序列表</td></tr>
            <tr><td><code>1. 有序</code></td><td>有序列表</td></tr>
            <tr><td><code>> 引用</code></td><td>引用块</td></tr>
            <tr><td><code>![](url)</code></td><td>图片</td></tr>
            <tr><td><code>[文字](url)</code></td><td>链接</td></tr>
          </table>
        </div>
      </aside>
    </div>

    <!-- 图片链接助手弹窗 -->
    <div v-if="showImgHelper" class="modal-mask" @click.self="showImgHelper = false">
      <div class="modal-box">
        <h3 class="modal-title">插入图片</h3>
        <p class="modal-desc">粘贴图片 URL，将自动插入 Markdown 图片语法到正文</p>
        <input v-model="imgUrl" class="form-input" placeholder="https://example.com/image.jpg" autofocus />
        <input v-model="imgAlt" class="form-input" placeholder="图片描述（可选）" />
        <div class="modal-actions">
          <button class="btn btn-outline" @click="showImgHelper = false">取消</button>
          <button class="btn btn-primary" :disabled="!imgUrl" @click="insertImg">插入</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { api } from '../../api'

const router = useRouter()

const form = ref({ title: '', summary: '', content: '', cover: '' })
const previewMode = ref(false)
const submitting = ref(false)
const coverError = ref(false)
const showImgHelper = ref(false)
const imgUrl = ref('')
const imgAlt = ref('')
const editorRef = ref<HTMLTextAreaElement | null>(null)

watch(() => form.value.cover, () => { coverError.value = false })

const canSubmit = computed(() => form.value.title.length >= 2 && form.value.content.length >= 10)

const renderedContent = computed(() => {
  if (!form.value.content) return ''
  const raw = marked.parse(form.value.content, { async: false }) as string
  return DOMPurify.sanitize(raw)
})

function insertMd(prefix: string, suffix: string, placeholder: string) {
  const el = editorRef.value
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  const selected = form.value.content.substring(start, end) || placeholder
  const inserted = prefix + selected + suffix
  form.value.content = form.value.content.substring(0, start) + inserted + form.value.content.substring(end)
  el.focus()
  const newPos = start + prefix.length + selected.length + suffix.length
  setTimeout(() => el.setSelectionRange(newPos, newPos), 0)
}

function insertLine(prefix: string, placeholder: string) {
  const el = editorRef.value
  if (!el) return
  const pos = el.selectionStart
  const before = form.value.content.substring(0, pos)
  const after = form.value.content.substring(pos)
  const needNewline = before.length > 0 && !before.endsWith('\n')
  const text = (needNewline ? '\n' : '') + prefix + (placeholder || '') + '\n'
  form.value.content = before + text + after
  el.focus()
  const newPos = pos + text.length
  setTimeout(() => el.setSelectionRange(newPos, newPos), 0)
}

function onTab() {
  const el = editorRef.value
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  form.value.content = form.value.content.substring(0, start) + '  ' + form.value.content.substring(end)
  setTimeout(() => el.setSelectionRange(start + 2, start + 2), 0)
}

function insertImg() {
  const alt = imgAlt.value || '图片'
  const mdStr = `\n![${alt}](${imgUrl.value})\n`
  const el = editorRef.value
  if (el) {
    const pos = el.selectionStart
    form.value.content = form.value.content.substring(0, pos) + mdStr + form.value.content.substring(pos)
  } else {
    form.value.content += mdStr
  }
  showImgHelper.value = false
  imgUrl.value = ''
  imgAlt.value = ''
  previewMode.value = false
}

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  try {
    const body: any = {
      title: form.value.title.trim(),
      content: form.value.content,
    }
    if (form.value.summary.trim()) body.summary = form.value.summary.trim()
    if (form.value.cover.trim()) body.cover = form.value.cover.trim()
    await api.createPost(body)
    alert('发帖成功！帖子将在管理员审核后公开展示。')
    router.push('/forum')
  } catch (err: any) {
    alert(err?.message ?? '发布失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.new-post-page { padding-bottom: 60px; }

.page-header { margin-bottom: 24px; }
.back-btn { background: none; border: none; color: var(--primary); font-size: 14px; cursor: pointer; padding: 0 0 8px; display: block; }
.back-btn:hover { text-decoration: underline; }
.page-title { font-size: 22px; font-weight: 800; color: var(--text-1); }

.editor-layout { display: grid; grid-template-columns: 1fr 260px; gap: 24px; align-items: start; }
@media (max-width: 768px) {
  .editor-layout { grid-template-columns: 1fr; }
  .editor-sidebar { order: -1; }
}

.editor-main { display: flex; flex-direction: column; gap: 20px; }

.form-group { display: flex; flex-direction: column; gap: 6px; position: relative; }
.form-label { font-size: 14px; font-weight: 600; color: var(--text-1); }
.required { color: #e53e3e; }
.hint { font-size: 12px; color: var(--text-3); font-weight: 400; }
.char-count { font-size: 11px; color: var(--text-3); text-align: right; position: absolute; right: 0; top: 0; }

.editor-toolbar {
  display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
  padding: 8px 12px; background: var(--bg); border: 1px solid var(--border);
  border-bottom: none; border-radius: var(--radius) var(--radius) 0 0;
}
.toolbar-btn {
  padding: 4px 10px; border-radius: 6px; border: 1px solid transparent;
  background: none; font-size: 13px; color: var(--text-2);
  cursor: pointer; transition: all 0.15s; min-width: 28px;
}
.toolbar-btn:hover, .toolbar-btn.active { border-color: var(--primary); color: var(--primary); background: var(--primary-light); }
.toolbar-divider { width: 1px; height: 20px; background: var(--border); margin: 0 4px; }

.editor-wrap, .preview-wrap {
  min-height: 300px; border: 1px solid var(--border);
  border-radius: 0 0 var(--radius) var(--radius);
}
.md-editor {
  width: 100%; min-height: 300px; padding: 16px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 14px;
  line-height: 1.7; resize: vertical;
  background: var(--white); color: var(--text-1);
  border: none; outline: none; border-radius: 0 0 var(--radius) var(--radius);
  box-sizing: border-box;
}
.preview-wrap { padding: 16px; background: var(--white); }
.preview-empty { color: var(--text-3); font-size: 14px; padding: 20px 0; }
.md-preview { font-size: 15px; line-height: 1.8; color: var(--text-2); }

.cover-input-row { display: flex; flex-direction: column; gap: 10px; }
.cover-preview { max-width: 200px; }
.cover-preview img { width: 100%; border-radius: 8px; border: 1px solid var(--border); }
.cover-error { font-size: 12px; color: #e53e3e; }

.form-actions { display: flex; justify-content: flex-end; gap: 12px; padding-top: 8px; }

/* Sidebar */
.editor-sidebar { display: flex; flex-direction: column; gap: 16px; }
.sidebar-card {
  background: var(--card-bg); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 16px;
}
.sidebar-title { font-size: 14px; font-weight: 700; color: var(--text-1); margin-bottom: 10px; }
.sidebar-list { font-size: 13px; color: var(--text-2); padding-left: 18px; line-height: 2; }

.md-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.md-table tr { border-bottom: 1px solid var(--border); }
.md-table td { padding: 4px 6px; color: var(--text-2); vertical-align: middle; }
.md-table td:first-child { color: var(--text-3); }
.md-table code { background: var(--bg); padding: 1px 4px; border-radius: 3px; font-size: 11px; color: var(--primary); }

/* Modal */
.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px; }
.modal-box { background: var(--white); border-radius: 12px; padding: 24px; width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 12px; }
.modal-title { font-size: 16px; font-weight: 700; color: var(--text-1); }
.modal-desc { font-size: 13px; color: var(--text-3); }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; }

/* Markdown preview styles */
.md-preview :deep(h1), .md-preview :deep(h2), .md-preview :deep(h3) { font-weight: 700; color: var(--text-1); margin: 16px 0 8px; }
.md-preview :deep(h1) { font-size: 22px; }
.md-preview :deep(h2) { font-size: 18px; }
.md-preview :deep(h3) { font-size: 16px; }
.md-preview :deep(p) { margin: 8px 0; }
.md-preview :deep(code) { background: #1c2333; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; color: #60a5fa; }
.md-preview :deep(pre) { background: #1e1e2e; padding: 14px 16px; border-radius: 8px; overflow-x: auto; }
.md-preview :deep(pre code) { background: none; color: #cdd6f4; font-size: 13px; }
.md-preview :deep(blockquote) { border-left: 3px solid var(--primary); padding: 4px 12px; margin: 8px 0; color: var(--text-3); background: var(--bg); border-radius: 0 6px 6px 0; }
.md-preview :deep(ul), .md-preview :deep(ol) { padding-left: 22px; margin: 6px 0; }
.md-preview :deep(li) { margin: 3px 0; }
.md-preview :deep(img) { max-width: 100%; border-radius: 8px; margin: 8px 0; }
.md-preview :deep(a) { color: var(--primary); text-decoration: underline; }
.md-preview :deep(hr) { border: none; border-top: 1px solid var(--border); margin: 16px 0; }
.md-preview :deep(table) { border-collapse: collapse; width: 100%; margin: 8px 0; }
.md-preview :deep(th), .md-preview :deep(td) { border: 1px solid var(--border); padding: 6px 12px; font-size: 13px; }
.md-preview :deep(th) { background: var(--bg); font-weight: 600; }

</style>
