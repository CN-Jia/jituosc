<template>
  <div class="sf-page">
    <div class="sf-panel">
      <div class="sf-panel-hd">
        <div>
          <span class="hd-title">媒体库</span>
          <span class="hd-sub">本服务器存储 · 上传后可复制链接用于收款码、商品图、轮播等</span>
        </div>
        <el-upload
          :show-file-list="false"
          :http-request="doUpload"
          accept="image/jpeg,image/png,image/webp,image/gif"
        >
          <el-button type="primary" :loading="uploading">
            <el-icon><Upload /></el-icon> 上传图片
          </el-button>
        </el-upload>
      </div>

      <el-table :data="list" v-loading="loading" style="width:100%">
        <el-table-column label="预览" width="100">
          <template #default="{ row }">
            <el-image :src="row.url" style="width:72px;height:48px;border-radius:6px" fit="cover" />
          </template>
        </el-table-column>
        <el-table-column label="标题" min-width="140">
          <template #default="{ row }">
            <span>{{ row.title || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="链接" min-width="220">
          <template #default="{ row }">
            <code class="url-code">{{ row.url }}</code>
            <el-button size="small" link type="primary" @click="copy(row.url)">复制</el-button>
          </template>
        </el-table-column>
        <el-table-column prop="originalFilename" label="原文件名" width="160" show-overflow-tooltip />
        <el-table-column label="大小" width="90">
          <template #default="{ row }">{{ fmtSize(row.sizeBytes) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" plain @click="del(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="total > pageSize" class="pagination">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="load"
        />
      </div>
    </div>

    <el-dialog v-model="editVisible" title="编辑标题" width="400px">
      <el-input v-model="editTitle" placeholder="备注标题（可选）" />
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveTitle">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Upload } from '@element-plus/icons-vue'
import { api } from '../../api'

const list = ref<any[]>([])
const loading = ref(false)
const uploading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = 30

const editVisible = ref(false)
const editTitle = ref('')
const editId = ref('')
const saving = ref(false)

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

async function load() {
  loading.value = true
  try {
    const res: any = await api.listMedia({ page: page.value, pageSize })
    list.value = res.data.list ?? []
    total.value = res.data.total ?? 0
  } finally {
    loading.value = false
  }
}

async function doUpload(opt: any) {
  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', opt.file)
    const res: any = await api.uploadMedia(fd)
    ElMessage.success(`上传成功：${res.data?.url ?? ''}`)
    await load()
    opt.onSuccess(res)
  } catch (e: any) {
    ElMessage.error(e?.message ?? '上传失败')
    opt.onError(e)
  } finally {
    uploading.value = false
  }
}

async function copy(s: string) {
  try {
    await navigator.clipboard.writeText(s)
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

function openEdit(row: any) {
  editId.value = row.id
  editTitle.value = row.title ?? ''
  editVisible.value = true
}

async function saveTitle() {
  saving.value = true
  try {
    await api.updateMedia(editId.value, { title: editTitle.value.trim() || null })
    ElMessage.success('已保存')
    editVisible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(e?.message ?? '保存失败')
  } finally {
    saving.value = false
  }
}

async function del(row: any) {
  await ElMessageBox.confirm('删除后文件无法恢复，是否继续？', '提示', { type: 'warning' })
  await api.deleteMedia(row.id)
  ElMessage.success('已删除')
  load()
}

onMounted(load)
</script>

<style scoped>
.sf-page { max-width: 1100px; }
.sf-panel { background: var(--bg-card, #fff); border: 1px solid var(--border, #e2e8f0); border-radius: 12px; overflow: hidden; }
.sf-panel-hd { padding: 16px 20px; border-bottom: 1px solid var(--border, #e2e8f0); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
.hd-title { font-weight: 700; font-size: 16px; margin-right: 8px; }
.hd-sub { font-size: 12px; color: var(--text-3, #94a3b8); }
.url-code { font-size: 12px; color: #64748b; margin-right: 6px; }
.pagination { padding: 12px 16px; display: flex; justify-content: flex-end; }
</style>
