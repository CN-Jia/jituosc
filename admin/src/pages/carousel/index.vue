<template>
  <div class="sf-page">
    <div class="sf-panel">
      <div class="sf-panel-hd">
        <span>作品轮播管理 <span class="hd-sub">· 展示在首页的历代作品</span></span>
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon> 添加作品
        </el-button>
      </div>

      <el-table :data="list" v-loading="loading" style="width:100%">
        <el-table-column label="预览" width="90">
          <template #default="{ row }">
            <el-image :src="row.imageUrl" style="width:64px;height:42px;border-radius:6px;object-fit:cover;border:1px solid var(--border)" fit="cover" />
          </template>
        </el-table-column>
        <el-table-column label="课程名" prop="courseName" min-width="160" />
        <el-table-column label="类型" prop="orderType" width="100" />
        <el-table-column label="完成时间" width="120">
          <template #default="{ row }">{{ fmt(row.completedAt) }}</template>
        </el-table-column>
        <el-table-column label="评价" prop="review" show-overflow-tooltip />
        <el-table-column label="排序" prop="sortOrder" width="70" />
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'info'" size="small">{{ row.isActive ? '显示' : '隐藏' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button type="danger" size="small" plain @click="del(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" :title="editId ? '编辑作品' : '添加作品'" width="600px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="图片链接"><el-input v-model="form.imageUrl" placeholder="https://..." /></el-form-item>
        <el-form-item label="课程名称"><el-input v-model="form.courseName" /></el-form-item>
        <el-form-item label="需求类型"><el-input v-model="form.orderType" placeholder="如：代码、报告" /></el-form-item>
        <el-form-item label="完成时间">
          <el-date-picker v-model="form.completedAt" type="datetime" style="width:100%" />
        </el-form-item>
        <el-form-item label="客户评价"><el-input v-model="form.review" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="订单号(脱敏)"><el-input v-model="form.orderNoMask" placeholder="如：JT****2024" /></el-form-item>
        <el-form-item label="排序权重"><el-input-number v-model="form.sortOrder" :min="0" /></el-form-item>
        <el-form-item label="是否显示"><el-switch v-model="form.isActive" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../../api'
import { format } from 'date-fns'

const list = ref<any[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const submitting = ref(false)
const editId = ref('')

const defaultForm = () => ({ imageUrl: '', courseName: '', orderType: '', completedAt: null as any, review: '', orderNoMask: '', sortOrder: 0, isActive: true })
const form = ref(defaultForm())
const fmt = (d: string) => format(new Date(d), 'yyyy-MM-dd')

async function load() {
  loading.value = true
  try {
    const res: any = await api.getCarousel()
    list.value = res.data
  } finally { loading.value = false }
}

function openCreate() { editId.value = ''; form.value = defaultForm(); dialogVisible.value = true }
function openEdit(row: any) {
  editId.value = row.id
  form.value = { imageUrl: row.imageUrl, courseName: row.courseName, orderType: row.orderType, completedAt: new Date(row.completedAt), review: row.review ?? '', orderNoMask: row.orderNoMask ?? '', sortOrder: row.sortOrder, isActive: row.isActive }
  dialogVisible.value = true
}

async function submit() {
  if (!form.value.imageUrl || !form.value.courseName || !form.value.completedAt) return ElMessage.warning('请填写完整信息')
  submitting.value = true
  const data = { ...form.value, completedAt: new Date(form.value.completedAt).toISOString() }
  try {
    editId.value ? await api.updateCarouselItem(editId.value, data) : await api.createCarouselItem(data)
    ElMessage.success('保存成功')
    dialogVisible.value = false
    load()
  } catch (e: any) { ElMessage.error(e.message ?? '保存失败') } finally { submitting.value = false }
}

async function del(id: string) {
  await ElMessageBox.confirm('确认删除此轮播项？', '确认删除', { type: 'warning' })
  try {
    await api.deleteCarouselItem(id)
    ElMessage.success('已删除')
    load()
  } catch (e: any) { ElMessage.error(e.message ?? '删除失败') }
}

onMounted(load)
</script>

<style scoped>
.hd-sub { font-size: 12px; color: var(--text-lo); font-weight: 400; }
</style>
