<template>
  <div class="sf-page">
    <div class="sf-panel">
      <div class="sf-panel-hd">
        <div class="sf-toolbar-left">
          <el-select v-model="filterStatus" placeholder="状态" clearable style="width:110px" @change="load">
            <el-option label="待处理" value="PENDING" />
            <el-option label="已回复" value="REPLIED" />
            <el-option label="已解决" value="RESOLVED" />
          </el-select>
          <el-select v-model="filterType" placeholder="类型" clearable style="width:110px" @change="load">
            <el-option label="Bug反馈" value="BUG" />
            <el-option label="功能建议" value="SUGGESTION" />
            <el-option label="其他" value="OTHER" />
          </el-select>
        </div>
      </div>

      <el-table :data="list" v-loading="loading" style="width:100%;cursor:pointer" @row-click="openDetail">
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="typeTagType(row.type)" size="small">{{ typeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="标题" prop="title" min-width="200" show-overflow-tooltip />
        <el-table-column label="用户" width="120">
          <template #default="{ row }">{{ row.user?.nickname ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="提交时间" width="130">
          <template #default="{ row }">{{ fmt(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" plain @click.stop="openDetail(row)">查看回复</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="total > pageSize" class="sf-pagination">
        <el-pagination background layout="prev, pager, next"
          :total="total" :page-size="pageSize" :current-page="page"
          @current-change="p => { page = p; load() }" />
      </div>
    </div>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="反馈详情 & 回复" width="640px">
      <template v-if="current">
        <div class="fb-meta">
          <el-tag :type="typeTagType(current.type)" size="small">{{ typeLabel(current.type) }}</el-tag>
          <el-tag :type="statusTagType(current.status)" size="small">{{ statusLabel(current.status) }}</el-tag>
          <span class="fb-time">{{ fmt(current.createdAt) }}</span>
        </div>
        <div class="fb-title">{{ current.title }}</div>
        <div class="fb-content">{{ current.description }}</div>

        <div class="reply-section">
          <div v-if="current.adminReply" class="admin-reply">
            <span class="reply-label">已回复</span>
            {{ current.adminReply }}
          </div>
          <el-input v-model="replyText" type="textarea" :rows="4" placeholder="输入回复内容..." style="margin-top:12px" />
          <div class="reply-status-row">
            <span class="tip">更新状态：</span>
            <el-select v-model="replyStatus" style="width:120px">
              <el-option label="已回复" value="REPLIED" />
              <el-option label="已解决" value="RESOLVED" />
            </el-select>
          </div>
        </div>
      </template>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button type="primary" :loading="submitting" @click="submitReply">发送回复</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from '../../api'
import { format } from 'date-fns'

const list = ref<any[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = 20
const filterStatus = ref('')
const filterType = ref('')
const detailVisible = ref(false)
const current = ref<any>(null)
const replyText = ref('')
const replyStatus = ref('REPLIED')
const submitting = ref(false)

const typeLabel = (t: string) => ({ BUG: 'Bug反馈', SUGGESTION: '功能建议', OTHER: '其他' } as any)[t] ?? t
const typeTagType = (t: string) => ({ BUG: 'danger', SUGGESTION: 'primary', OTHER: '' } as any)[t] ?? ''
const statusLabel = (s: string) => ({ PENDING: '待处理', REPLIED: '已回复', RESOLVED: '已解决' } as any)[s] ?? s
const statusTagType = (s: string) => ({ PENDING: 'warning', REPLIED: 'primary', RESOLVED: 'success' } as any)[s] ?? ''
const fmt = (d: string) => format(new Date(d), 'MM-dd HH:mm')

async function load() {
  loading.value = true
  try {
    const res: any = await api.getFeedbacks({ page: page.value, pageSize, status: filterStatus.value || undefined, type: filterType.value || undefined })
    list.value = res.data.list
    total.value = res.data.total
  } finally { loading.value = false }
}

function openDetail(row: any) {
  current.value = row
  replyText.value = ''
  replyStatus.value = 'REPLIED'
  detailVisible.value = true
}

async function submitReply() {
  if (!replyText.value.trim()) return ElMessage.warning('请输入回复内容')
  submitting.value = true
  try {
    await api.replyFeedback(current.value.id, replyText.value)
    // replyFeedback 已将状态设为 REPLIED，如果管理员选择 RESOLVED 则再更新一次
    if (replyStatus.value === 'RESOLVED') {
      await api.updateFeedbackStatus(current.value.id, 'RESOLVED')
    }
    ElMessage.success('回复成功')
    detailVisible.value = false
    load()
  } catch (e: any) { ElMessage.error(e.message ?? '操作失败') } finally { submitting.value = false }
}

onMounted(load)
</script>

<style scoped>
.fb-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.fb-time { color: var(--text-lo); font-size: 12px; margin-left: auto; }
.fb-title { font-size: 16px; font-weight: 600; color: var(--text-hi); margin-bottom: 10px; }
.fb-content {
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  color: var(--text-md);
  line-height: 1.7;
  white-space: pre-wrap;
  font-size: 13px;
}
.reply-section { margin-top: 16px; }
.admin-reply {
  background: var(--accent-dim);
  border: 1px solid var(--border);
  border-left: 3px solid var(--accent);
  border-radius: 8px;
  padding: 10px 14px;
  color: var(--text-md);
  font-size: 13px;
  line-height: 1.6;
}
.reply-label {
  display: block;
  font-size: 10px;
  color: var(--accent);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 4px;
}
.reply-status-row { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.tip { color: var(--text-lo); font-size: 13px; }
</style>
