<template>
  <div class="sf-page">
    <div class="sf-panel">
      <div class="sf-panel-hd">
        积分商城商品管理
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon> 新建商品
        </el-button>
      </div>

      <el-table :data="items" v-loading="loading" style="width:100%">
        <el-table-column prop="name" label="商品名称" min-width="160" />
        <el-table-column label="类型" width="120">
          <template #default="{ row }">
            <el-tag v-if="!row.discountAmt || Number(row.discountAmt) === 0" type="success" size="small">免费兑换</el-tag>
            <el-tag v-else type="warning" size="small">折扣服务 −¥{{ row.discountAmt }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="pointsCost" label="所需积分" width="110" />
        <el-table-column label="折扣金额" width="110">
          <template #default="{ row }">
            <span v-if="!row.discountAmt || Number(row.discountAmt) === 0" style="color:#52c41a;font-weight:600">免费</span>
            <span v-else>−¥{{ row.discountAmt }}</span>
          </template>
        </el-table-column>
        <el-table-column label="库存" width="80">
          <template #default="{ row }">{{ row.stock === -1 ? '∞' : row.stock }}</template>
        </el-table-column>
        <el-table-column label="上架" width="80">
          <template #default="{ row }">
            <el-switch v-model="row.isActive" @change="toggleActive(row)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialog" :title="editing ? '编辑商品' : '新建商品'" width="500px">
      <el-form :model="form" label-position="top">
        <el-form-item label="商品名称">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="所需积分">
          <el-input-number v-model="form.pointsCost" :min="1" style="width:100%" />
        </el-form-item>
        <el-form-item>
          <template #label>
            折扣金额（元）
            <el-tooltip content="填 0 = 兑换后下单完全免费；填具体金额 = 管理员报价后自动扣减该金额" placement="top">
              <el-icon style="cursor:help;margin-left:4px"><QuestionFilled /></el-icon>
            </el-tooltip>
          </template>
          <el-input-number v-model="form.discountAmt" :min="0" :precision="2" style="width:100%" placeholder="0 = 免费兑换" />
          <div style="font-size:12px;color:#909399;margin-top:4px">
            <span v-if="!form.discountAmt || form.discountAmt === 0">✅ 用户兑换后提交订单 → 直接免费，无需付款</span>
            <span v-else>🏷️ 用户兑换后提交订单 → 管理员报价时自动扣减 ¥{{ form.discountAmt }}</span>
          </div>
        </el-form-item>
        <el-form-item label="库存（-1 = 无限）">
          <el-input-number v-model="form.stock" :min="-1" style="width:100%" />
        </el-form-item>
        <el-form-item label="商品描述">
          <el-input v-model="form.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="封面图 URL">
          <el-input v-model="form.coverUrl" placeholder="https://..." />
        </el-form-item>
        <el-form-item label="排序（数字越小越靠前）">
          <el-input-number v-model="form.sortOrder" style="width:100%" />
        </el-form-item>
        <el-form-item label="是否上架">
          <el-switch v-model="form.isActive" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../../api'

const items = ref<any[]>([])
const loading = ref(false)
const dialog = ref(false)
const editing = ref<any>(null)
const saving = ref(false)

const defaultForm = () => ({ name: '', type: 'SERVICE' as const, pointsCost: 100, discountAmt: 0 as number, stock: -1, description: '', coverUrl: '', sortOrder: 0, isActive: true })
const form = ref(defaultForm())

async function loadItems() {
  loading.value = true
  try {
    const res: any = await api.getAdminShopItems()
    items.value = res.data.list
  } finally { loading.value = false }
}

function openCreate() { editing.value = null; form.value = defaultForm(); dialog.value = true }
function openEdit(row: any) { editing.value = row; form.value = { ...row }; dialog.value = true }

async function handleSave() {
  if (!form.value.name) return ElMessage.warning('请填写商品名称')
  saving.value = true
  try {
    const data = { ...form.value, type: 'SERVICE' as const }
    editing.value ? await api.updateShopItem(editing.value.id, data) : await api.createShopItem(data)
    ElMessage.success(editing.value ? '更新成功' : '创建成功')
    dialog.value = false
    loadItems()
  } catch (err: any) {
    ElMessage.error(err?.message ?? '保存失败')
  } finally { saving.value = false }
}

async function toggleActive(row: any) {
  try {
    await api.updateShopItem(row.id, { isActive: row.isActive })
    ElMessage.success(row.isActive ? '已上架' : '已下架')
  } catch { row.isActive = !row.isActive; ElMessage.error('操作失败') }
}

async function handleDelete(row: any) {
  await ElMessageBox.confirm(`确定删除商品「${row.name}」？`, '确认删除', { type: 'warning' })
  try {
    await api.deleteShopItem(row.id)
    ElMessage.success('删除成功')
    loadItems()
  } catch (err: any) { ElMessage.error(err?.message ?? '删除失败') }
}

onMounted(loadItems)
</script>
