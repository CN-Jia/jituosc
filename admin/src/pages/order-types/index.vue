<template>
  <div class="sf-page">
    <div class="sf-panel">
      <div class="sf-panel-hd">
        需求类型管理
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon> 添加类型
        </el-button>
      </div>

      <el-table :data="types" v-loading="loading" style="width:100%">
        <el-table-column prop="sortOrder" label="排序" width="80" />
        <el-table-column prop="name" label="类型名称" width="180" />
        <el-table-column prop="price" label="参考价格" width="160" />
        <el-table-column prop="description" label="说明" min-width="200" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'info'" size="small">
              {{ row.isActive ? '已上架' : '已下架' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" :type="row.isActive ? 'warning' : 'success'" @click="toggleActive(row)">
              {{ row.isActive ? '下架' : '上架' }}
            </el-button>
            <el-button size="small" type="danger" plain @click="doDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" :title="editId ? '编辑类型' : '添加类型'" width="500px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="类型名称">
          <el-input v-model="form.name" placeholder="如：期末作业" />
        </el-form-item>
        <el-form-item label="参考价格">
          <el-input v-model="form.price" placeholder="如：200-500元" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="类型说明（可选）" />
        </el-form-item>
        <el-form-item label="排序权重">
          <el-input-number v-model="form.sortOrder" :min="0" />
          <span class="tip">数字越小越靠前</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="doSave" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../../api'

const types = ref<any[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const editId = ref('')
const saving = ref(false)
const form = reactive({ name: '', price: '', description: '', sortOrder: 0, isActive: true })

async function loadTypes() {
  loading.value = true
  try {
    const res: any = await api.getOrderTypes()
    types.value = res.data
  } finally { loading.value = false }
}

function openCreate() {
  editId.value = ''
  Object.assign(form, { name: '', price: '', description: '', sortOrder: 0, isActive: true })
  dialogVisible.value = true
}

function openEdit(row: any) {
  editId.value = row.id
  Object.assign(form, { name: row.name, price: row.price, description: row.description ?? '', sortOrder: row.sortOrder, isActive: row.isActive })
  dialogVisible.value = true
}

async function doSave() {
  if (!form.name.trim() || !form.price.trim()) return ElMessage.warning('名称和价格不能为空')
  saving.value = true
  try {
    editId.value ? await api.updateOrderType(editId.value, form) : await api.createOrderType(form)
    ElMessage.success(editId.value ? '已更新' : '已创建')
    dialogVisible.value = false
    await loadTypes()
  } catch (e: any) {
    ElMessage.error(e.message ?? '操作失败')
  } finally { saving.value = false }
}

async function toggleActive(row: any) {
  try {
    await api.updateOrderType(row.id, { isActive: !row.isActive })
    ElMessage.success(row.isActive ? '已下架' : '已上架')
    await loadTypes()
  } catch (e: any) { ElMessage.error(e.message ?? '操作失败') }
}

async function doDelete(row: any) {
  await ElMessageBox.confirm(`确定删除需求类型「${row.name}」？`, '确认删除', { type: 'warning' })
  try {
    await api.deleteOrderType(row.id)
    ElMessage.success('已删除')
    await loadTypes()
  } catch (e: any) { ElMessage.error(e.message ?? '删除失败') }
}

onMounted(loadTypes)
</script>

<style scoped>
.tip { margin-left: 8px; color: var(--text-lo); font-size: 12px; }
</style>
