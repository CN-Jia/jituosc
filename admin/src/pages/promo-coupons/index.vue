<template>
  <div class="sf-page">
    <div class="page-toolbar">
      <el-button type="primary" :icon="Plus" @click="openForm">新增优惠码</el-button>
    </div>

    <div class="sf-panel">
      <el-table :data="coupons" v-loading="loading" style="width:100%">
        <el-table-column prop="code" label="优惠码" width="160" />
        <el-table-column label="折扣" width="120">
          <template #default="{ row }">
            {{ row.discountType === 'FIXED' ? `¥${Number(row.discountValue).toFixed(2)}` : `${Number(row.discountValue)}%` }}
          </template>
        </el-table-column>
        <el-table-column label="有效期" min-width="200">
          <template #default="{ row }">
            {{ fmtDate(row.validFrom) }} ~ {{ fmtDate(row.validTo) }}
          </template>
        </el-table-column>
        <el-table-column label="使用" width="80">
          <template #default="{ row }">{{ row.usedCount }} / {{ row.maxUses }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="couponStatus(row).type" size="small">{{ couponStatus(row).label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.isActive" size="small" plain @click="handleDeactivate(row)">停用</el-button>
            <el-button v-else size="small" type="success" plain @click="handleActivate(row)">启用</el-button>
            <el-tooltip :content="row.usedCount > 0 ? '已有使用记录，无法删除' : ''" :disabled="row.usedCount === 0">
              <el-button size="small" type="danger" plain @click="handleDelete(row)" :disabled="row.usedCount > 0">删除</el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="total, prev, pager, next" @current-change="loadCoupons" />
      </div>
    </div>

    <el-dialog v-model="formDialog" title="新增优惠码" width="480px" destroy-on-close>
      <el-form :model="formData" label-width="90px">
        <el-form-item label="优惠码" required>
          <el-input v-model="formData.code" placeholder="如 SUMMER20（自动转大写）" />
        </el-form-item>
        <el-form-item label="折扣类型" required>
          <el-radio-group v-model="formData.discountType">
            <el-radio value="FIXED">固定金额</el-radio>
            <el-radio value="PERCENTAGE">百分比折扣</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="formData.discountType === 'FIXED' ? '折扣金额' : '折扣比例'" required>
          <el-input-number v-model="formData.discountValue" :min="0.01" :max="formData.discountType === 'PERCENTAGE' ? 99 : 9999" :step="formData.discountType === 'PERCENTAGE' ? 5 : 10" :precision="formData.discountType === 'PERCENTAGE' ? 0 : 2" style="width:100%" />
          <span style="margin-left:8px;color:var(--text-3)">{{ formData.discountType === 'FIXED' ? '元' : '%' }}</span>
        </el-form-item>
        <el-form-item label="有效期" required>
          <el-date-picker
            v-model="formData.dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            style="width:100%"
          />
        </el-form-item>
        <el-form-item label="使用次数">
          <el-input-number v-model="formData.maxUses" :min="1" style="width:120px" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">创建</el-button>
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
const coupons = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const formDialog = ref(false)
const saving = ref(false)
const formData = reactive({ code: '', discountType: 'PERCENTAGE' as 'FIXED' | 'PERCENTAGE', discountValue: 20, dateRange: null as any, maxUses: 1 })

function couponStatus(row: any) {
  const now = new Date()
  if (!row.isActive) return { type: 'info', label: '已停用' }
  if (now > new Date(row.validTo)) return { type: 'danger', label: '已过期' }
  if (row.usedCount >= row.maxUses) return { type: 'warning', label: '已用完' }
  return { type: 'success', label: '有效' }
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' })
}

async function loadCoupons() {
  loading.value = true
  try {
    const res: any = await api.getPromoCoupons({ page: page.value, pageSize })
    coupons.value = res.data.list
    total.value = res.data.total
  } finally { loading.value = false }
}

function openForm() {
  Object.assign(formData, { code: '', discountType: 'PERCENTAGE', discountValue: 20, dateRange: null, maxUses: 1 })
  formDialog.value = true
}

async function handleSave() {
  if (!formData.code.trim()) return ElMessage.error('请填写优惠码')
  if (!formData.dateRange?.[0]) return ElMessage.error('请选择有效期')
  saving.value = true
  try {
    await api.createPromoCoupon({
      code: formData.code.toUpperCase(),
      discountType: formData.discountType,
      discountValue: formData.discountValue,
      validFrom: new Date(formData.dateRange[0]).toISOString(),
      validTo: new Date(formData.dateRange[1]).toISOString(),
      maxUses: formData.maxUses,
    })
    ElMessage.success('优惠码创建成功')
    formDialog.value = false
    loadCoupons()
  } catch (err: any) {
    ElMessage.error(err?.message ?? '创建失败')
  } finally { saving.value = false }
}

async function handleDeactivate(row: any) {
  try { await api.deactivatePromoCoupon(row.id); row.isActive = false } catch (err: any) { ElMessage.error(err?.message ?? '操作失败') }
}
async function handleActivate(row: any) {
  try { await api.activatePromoCoupon(row.id); row.isActive = true } catch (err: any) { ElMessage.error(err?.message ?? '操作失败') }
}
async function handleDelete(row: any) {
  await ElMessageBox.confirm(`确定删除优惠码 "${row.code}" 吗？`, '确认删除', { type: 'warning' })
  try { await api.deletePromoCoupon(row.id); ElMessage.success('删除成功'); loadCoupons() } catch (err: any) { ElMessage.error(err?.message ?? '删除失败') }
}

onMounted(loadCoupons)
</script>

<style scoped>
.sf-page { display: flex; flex-direction: column; gap: 16px; }
.page-toolbar { display: flex; justify-content: flex-end; }
.sf-panel { background: var(--bg-card, #fff); border: 1px solid var(--border, #e2e8f0); border-radius: 12px; overflow: hidden; }
.pagination { padding: 12px 16px; display: flex; justify-content: flex-end; }
</style>
