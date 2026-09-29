<template>
  <div class="sf-page">
    <div class="page-toolbar">
      <el-button type="primary" :icon="Plus" @click="openForm()">新增商品</el-button>
    </div>

    <div class="sf-panel">
      <el-table :data="products" v-loading="loading" style="width:100%">
        <el-table-column label="图片" width="80">
          <template #default="{ row }">
            <img v-if="row.imageUrl" :src="row.imageUrl" style="width:48px;height:36px;object-fit:cover;border-radius:4px;" />
            <div v-else style="width:48px;height:36px;background:var(--bg-hover);border-radius:4px;" />
          </template>
        </el-table-column>
        <el-table-column prop="name" label="商品名称" min-width="160" />
        <el-table-column label="价格" width="100">
          <template #default="{ row }">¥{{ Number(row.price).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-switch :model-value="row.isActive" @change="toggleActive(row)" />
          </template>
        </el-table-column>
        <el-table-column prop="sortOrder" label="排序" width="80" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openForm(row)">编辑</el-button>
            <el-button size="small" type="danger" plain @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="total, prev, pager, next" @current-change="loadProducts" />
      </div>
    </div>

    <el-dialog v-model="formDialog" :title="formData.id ? '编辑商品' : '新增商品'" width="520px" destroy-on-close>
      <el-form :model="formData" label-width="80px">
        <el-form-item label="商品名称" required>
          <el-input v-model="formData.name" placeholder="商品名称" />
        </el-form-item>
        <el-form-item label="价格(元)" required>
          <el-input-number v-model="formData.price" :min="0.01" :precision="2" :step="10" style="width:100%" />
        </el-form-item>
        <el-form-item label="图片URL">
          <el-input v-model="formData.imageUrl" placeholder="https://..." />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="formData.description" type="textarea" :rows="4" placeholder="商品详细描述..." />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="formData.sortOrder" :min="0" style="width:120px" />
        </el-form-item>
        <el-form-item label="上架">
          <el-switch v-model="formData.isActive" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../../api'

const loading = ref(false)
const products = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const formDialog = ref(false)
const saving = ref(false)
const formData = reactive({ id: '', name: '', price: 0, imageUrl: '', description: '', sortOrder: 0, isActive: true })

async function loadProducts() {
  loading.value = true
  try {
    const res: any = await api.getProducts({ page: page.value, pageSize })
    products.value = res.data.list
    total.value = res.data.total
  } finally { loading.value = false }
}

function openForm(row?: any) {
  if (row) {
    Object.assign(formData, { id: row.id, name: row.name, price: Number(row.price), imageUrl: row.imageUrl ?? '', description: row.description ?? '', sortOrder: row.sortOrder, isActive: row.isActive })
  } else {
    Object.assign(formData, { id: '', name: '', price: 0, imageUrl: '', description: '', sortOrder: 0, isActive: true })
  }
  formDialog.value = true
}

async function handleSave() {
  if (!formData.name.trim()) return ElMessage.error('请填写商品名称')
  if (formData.price <= 0) return ElMessage.error('价格必须大于0')
  saving.value = true
  try {
    const payload = { name: formData.name, price: formData.price, imageUrl: formData.imageUrl || undefined, description: formData.description || undefined, sortOrder: formData.sortOrder, isActive: formData.isActive }
    if (formData.id) {
      await api.updateProduct(formData.id, payload)
      ElMessage.success('更新成功')
    } else {
      await api.createProduct(payload)
      ElMessage.success('创建成功')
    }
    formDialog.value = false
    loadProducts()
  } catch (err: any) {
    ElMessage.error(err?.message ?? '操作失败')
  } finally { saving.value = false }
}

async function toggleActive(row: any) {
  const prev = row.isActive
  row.isActive = !prev
  try {
    await api.toggleProduct(row.id)
  } catch (err: any) {
    row.isActive = prev
    ElMessage.error(err?.message ?? '操作失败')
  }
}

async function handleDelete(row: any) {
  await ElMessageBox.confirm(`确定删除商品"${row.name}"吗？有关联订单时将无法删除。`, '确认删除', { type: 'warning' })
  try {
    await api.deleteProduct(row.id)
    ElMessage.success('删除成功')
    loadProducts()
  } catch (err: any) {
    ElMessage.error(err?.message ?? '删除失败')
  }
}

onMounted(loadProducts)
</script>

<style scoped>
.sf-page { display: flex; flex-direction: column; gap: 16px; }
.page-toolbar { display: flex; justify-content: flex-end; }
.sf-panel { background: var(--bg-card, #fff); border: 1px solid var(--border, #e2e8f0); border-radius: 12px; overflow: hidden; }
.pagination { padding: 12px 16px; display: flex; justify-content: flex-end; }
</style>
