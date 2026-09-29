<template>
  <div class="sf-page">
    <div class="sf-panel">
      <div class="sf-panel-hd">
        <div class="sf-toolbar-left">
          <el-select v-model="filterStatus" placeholder="状态" clearable style="width:110px" @change="load">
            <el-option label="待审核" value="PENDING" />
            <el-option label="已发布" value="APPROVED" />
            <el-option label="已拒绝" value="REJECTED" />
          </el-select>
          <el-select v-model="filterBoard" placeholder="板块" clearable style="width:120px" @change="load">
            <el-option v-for="b in boards" :key="b.key" :label="b.label" :value="b.key" />
          </el-select>
        </div>
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon> 发帖
        </el-button>
      </div>

      <el-table :data="posts" v-loading="loading" style="width:100%">
        <el-table-column label="标题" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.isPinned" style="color:var(--el-color-primary);margin-right:4px;font-size:13px">📌</span>
            {{ row.title }}
          </template>
        </el-table-column>
        <el-table-column label="板块" width="100">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ boardLabel(row.board) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="作者" width="110">
          <template #default="{ row }">{{ row.author?.nickname ?? '管理员' }}</template>
        </el-table-column>
        <el-table-column label="评论" width="60" prop="_count.comments" />
        <el-table-column label="发布时间" width="120">
          <template #default="{ row }">{{ fmt(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'PENDING'">
              <el-button type="success" size="small" @click="review(row.id, 'APPROVED')">通过</el-button>
              <el-button type="danger" size="small" @click="review(row.id, 'REJECTED')">拒绝</el-button>
            </template>
            <el-button
              :type="row.isPinned ? 'warning' : 'info'"
              size="small" plain
              @click="togglePin(row)"
            >{{ row.isPinned ? '取消置顶' : '置顶' }}</el-button>
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button type="danger" size="small" plain @click="del(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="total > pageSize" class="sf-pagination">
        <el-pagination background layout="prev, pager, next"
          :total="total" :page-size="pageSize" :current-page="page"
          @current-change="p => { page = p; load() }" />
      </div>
    </div>

    <el-dialog v-model="dialogVisible" :title="editId ? '编辑帖子' : '发布帖子'" width="700px">
      <el-form :model="form" label-width="70px">
        <el-form-item label="板块">
          <el-select v-model="form.board" placeholder="选择板块">
            <el-option v-for="b in boards.filter(b => b.key)" :key="b.key" :label="b.label" :value="b.key" />
          </el-select>
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="form.title" placeholder="帖子标题" />
        </el-form-item>
        <el-form-item label="摘要">
          <el-input v-model="form.summary" placeholder="一句话简介（可选）" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="form.content" type="textarea" :rows="8" placeholder="支持 Markdown" />
        </el-form-item>
        <el-form-item label="置顶">
          <el-switch v-model="form.isPinned" active-text="是" inactive-text="否" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">发布</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { api } from '../../api'
import { format } from 'date-fns'

const boards = [
  { key: 'announcement', label: '公告通知', icon: '📢' },
  { key: 'service', label: '服务说明', icon: '📋' },
  { key: 'faq', label: '常见问题', icon: '❓' },
  { key: 'exchange', label: '用户交流', icon: '💬' },
]

const posts = ref<any[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = 20
const filterStatus = ref('')
const filterBoard = ref('')

const dialogVisible = ref(false)
const submitting = ref(false)
const editId = ref('')
const form = ref({ title: '', summary: '', content: '', isPinned: false, board: 'exchange' })

const statusLabel = (s: string) => ({ PENDING: '待审核', APPROVED: '已发布', REJECTED: '已拒绝' } as any)[s] ?? s
const statusType  = (s: string) => ({ PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' } as any)[s] ?? ''
const boardLabel  = (b: string) => boards.find(x => x.key === b)?.label ?? b
const fmt = (d: string) => format(new Date(d), 'MM-dd HH:mm')

async function load() {
  loading.value = true
  try {
    const res: any = await api.getPosts({
      page: page.value,
      pageSize,
      status: filterStatus.value || undefined,
      board: filterBoard.value || undefined,
    })
    posts.value = res.data.list
    total.value = res.data.total
  } finally { loading.value = false }
}

function openCreate() {
  editId.value = ''
  form.value = { title: '', summary: '', content: '', isPinned: false, board: 'exchange' }
  dialogVisible.value = true
}
function openEdit(row: any) {
  editId.value = row.id
  form.value = { title: row.title, summary: row.summary ?? '', content: row.content, isPinned: row.isPinned ?? false, board: row.board ?? 'exchange' }
  dialogVisible.value = true
}

async function submit() {
  if (!form.value.title || !form.value.content) return ElMessage.warning('请填写标题和内容')
  submitting.value = true
  try {
    if (editId.value) {
      await api.updatePost(editId.value, { title: form.value.title, summary: form.value.summary, content: form.value.content, board: form.value.board })
    } else {
      await api.createAdminPost(form.value)
    }
    ElMessage.success('操作成功')
    dialogVisible.value = false
    load()
  } catch { ElMessage.error('操作失败') } finally { submitting.value = false }
}

async function review(id: string, status: 'APPROVED' | 'REJECTED') {
  await ElMessageBox.confirm(
    status === 'APPROVED' ? '确认通过该帖子？' : '确认拒绝该帖子？',
    '审核确认', { type: 'warning' }
  )
  try {
    await api.reviewPost(id, status)
    ElMessage.success(status === 'APPROVED' ? '已通过' : '已拒绝')
    load()
  } catch (e: any) { ElMessage.error(e.message ?? '操作失败') }
}

async function togglePin(row: any) {
  try {
    await api.pinPost(row.id)
    row.isPinned = !row.isPinned
    ElMessage.success(row.isPinned ? '已置顶' : '已取消置顶')
  } catch { ElMessage.error('操作失败') }
}

async function del(id: string) {
  await ElMessageBox.confirm('确认删除此帖子？', '警告', { type: 'warning' })
  await api.deletePost(id)
  ElMessage.success('已删除')
  load()
}

onMounted(load)
</script>
