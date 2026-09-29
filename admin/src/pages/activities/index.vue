<template>
  <div class="sf-page">
    <div class="sf-panel">
      <div class="sf-panel-hd">
        活动 / 公告管理
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon> 发布公告
        </el-button>
      </div>

      <el-table :data="activities" v-loading="loading" style="width:100%">
        <el-table-column label="类型" width="110">
          <template #default="{ row }">
            <el-tag :type="row.type === 'PROMO' ? 'warning' : 'primary'" size="small">
              {{ row.type === 'PROMO' ? '优惠活动' : '系统公告' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
        <el-table-column prop="content" label="内容" min-width="240" show-overflow-tooltip />
        <el-table-column label="开始时间" width="130">
          <template #default="{ row }">{{ fmtDate(row.startAt) }}</template>
        </el-table-column>
        <el-table-column label="结束时间" width="130">
          <template #default="{ row }">{{ row.endAt ? fmtDate(row.endAt) : '长期有效' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'info'" size="small">
              {{ row.isActive ? '显示' : '隐藏' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="doDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" :title="editId ? '编辑公告' : '发布公告'" width="600px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="类型">
          <el-radio-group v-model="form.type">
            <el-radio value="NOTICE">📢 系统公告</el-radio>
            <el-radio value="PROMO">🎁 优惠活动</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="form.title" placeholder="公告/活动标题" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="form.content" type="textarea" :rows="5" placeholder="详细内容" />
        </el-form-item>
        <el-form-item label="开始时间">
          <el-date-picker v-model="form.startAt" type="datetime" placeholder="选择开始时间" style="width:100%" />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-date-picker v-model="form.endAt" type="datetime" placeholder="不填则长期有效" style="width:100%" clearable />
        </el-form-item>
        <el-form-item label="是否显示">
          <el-switch v-model="form.isActive" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="doSave" :loading="saving">{{ editId ? '保存' : '发布' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../../api'

const activities = ref<any[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const editId = ref('')
const saving = ref(false)
const form = reactive({
  type: 'NOTICE' as 'NOTICE' | 'PROMO',
  title: '', content: '',
  startAt: new Date(),
  endAt: null as Date | null,
  isActive: true,
})

const fmtDate = (d: string) => new Date(d).toLocaleDateString('zh-CN')

async function loadActivities() {
  loading.value = true
  try {
    const res: any = await api.getActivities()
    activities.value = res.data
  } finally { loading.value = false }
}

function openCreate() {
  editId.value = ''
  Object.assign(form, { type: 'NOTICE', title: '', content: '', startAt: new Date(), endAt: null, isActive: true })
  dialogVisible.value = true
}

function openEdit(row: any) {
  editId.value = row.id
  Object.assign(form, { type: row.type, title: row.title, content: row.content, startAt: new Date(row.startAt), endAt: row.endAt ? new Date(row.endAt) : null, isActive: row.isActive })
  dialogVisible.value = true
}

async function doSave() {
  if (!form.title.trim() || !form.content.trim()) return ElMessage.warning('标题和内容不能为空')
  saving.value = true
  try {
    const payload = {
      ...form,
      startAt: (form.startAt instanceof Date ? form.startAt : new Date(form.startAt)).toISOString(),
      endAt: form.endAt ? (form.endAt instanceof Date ? form.endAt : new Date(form.endAt)).toISOString() : null,
    }
    editId.value ? await api.updateActivity(editId.value, payload) : await api.createActivity(payload)
    ElMessage.success(editId.value ? '已更新' : '已发布')
    dialogVisible.value = false
    await loadActivities()
  } catch (e: any) {
    ElMessage.error(e.message ?? '操作失败')
  } finally { saving.value = false }
}

async function doDelete(row: any) {
  await ElMessageBox.confirm(`确定删除「${row.title}」？`, '确认删除', { type: 'warning' })
  try {
    await api.deleteActivity(row.id)
    ElMessage.success('已删除')
    await loadActivities()
  } catch { ElMessage.error('删除失败') }
}

onMounted(loadActivities)
</script>
