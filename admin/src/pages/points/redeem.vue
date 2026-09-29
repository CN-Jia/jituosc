<template>
  <div class="sf-page">
    <div class="sf-panel">
      <div class="sf-panel-hd">
        <div class="sf-toolbar-left">
          兑换订单审核
        </div>
        <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width:130px" @change="loadOrders">
          <el-option label="待审核" value="PENDING" />
          <el-option label="已完成" value="COMPLETED" />
          <el-option label="已拒绝" value="REJECTED" />
        </el-select>
      </div>

      <el-table :data="orders" v-loading="loading" style="width:100%">
        <el-table-column prop="user.nickname" label="用户" width="120" />
        <el-table-column prop="user.username" label="用户名" width="120" />
        <el-table-column prop="shopItem.name" label="商品" min-width="160" />
        <el-table-column label="类型" width="90">
          <template #default="{ row }">
            <el-tag :type="row.shopItem?.type === 'COUPON' ? 'warning' : 'primary'" size="small">
              {{ row.shopItem?.type === 'COUPON' ? '折扣券' : '套餐' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="消耗积分" width="90">
          <template #default="{ row }">
            <span style="color:var(--purple);font-weight:700">{{ row.pointsCost }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="adminNote" label="备注" min-width="120" show-overflow-tooltip />
        <el-table-column label="申请时间" width="130">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'PENDING'">
              <el-button type="success" size="small" @click="openApprove(row)">通过</el-button>
              <el-button type="danger" size="small" @click="openReject(row)">拒绝</el-button>
            </template>
            <span v-else class="handled">已处理</span>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="total > pageSize" class="sf-pagination">
        <el-pagination background layout="prev, pager, next"
          :total="total" :page-size="pageSize" v-model:current-page="currentPage" @current-change="loadOrders" />
      </div>
    </div>

    <el-dialog v-model="approveDialog" title="审核通过" width="420px">
      <p style="margin-bottom:12px;color:var(--text-2)">确认通过该兑换申请？积分将自动扣减。</p>
      <el-input v-model="approveNote" type="textarea" :rows="3" placeholder="备注（可选）" />
      <template #footer>
        <el-button @click="approveDialog = false">取消</el-button>
        <el-button type="success" :loading="operating" @click="submitApprove">确认通过</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="rejectDialog" title="填写拒绝原因" width="420px">
      <el-input v-model="rejectNote" type="textarea" :rows="4" placeholder="请填写拒绝原因（必填）" />
      <template #footer>
        <el-button @click="rejectDialog = false">取消</el-button>
        <el-button type="danger" :loading="operating" @click="submitReject">确认拒绝</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from '../../api'

const orders = ref<any[]>([])
const loading = ref(false)
const total = ref(0)
const currentPage = ref(1)
const pageSize = 20
const statusFilter = ref('')
const operating = ref(false)
const approveDialog = ref(false)
const approveTarget = ref<any>(null)
const approveNote = ref('')
const rejectDialog = ref(false)
const rejectTarget = ref<any>(null)
const rejectNote = ref('')

const statusLabel = (s: string) => ({ PENDING: '待审核', COMPLETED: '已完成', REJECTED: '已拒绝' } as any)[s] ?? s
const statusType  = (s: string) => ({ PENDING: 'warning', COMPLETED: 'success', REJECTED: 'danger' } as any)[s] ?? 'info'
const formatDate  = (d: string) => new Date(d).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

async function loadOrders() {
  loading.value = true
  try {
    const params: any = { page: currentPage.value, pageSize }
    if (statusFilter.value) params.status = statusFilter.value
    const res: any = await api.getRedeemOrders(params)
    orders.value = res.data.list
    total.value = res.data.total
  } finally { loading.value = false }
}

function openApprove(row: any) { approveTarget.value = row; approveNote.value = ''; approveDialog.value = true }

async function submitApprove() {
  if (!approveTarget.value) return
  operating.value = true
  try {
    await api.approveRedeem(approveTarget.value.id, approveNote.value || undefined)
    ElMessage.success('已通过，积分已扣减')
    approveDialog.value = false
    loadOrders()
  } catch (err: any) {
    ElMessage.error(err?.message ?? '操作失败')
  } finally { operating.value = false }
}

function openReject(row: any) { rejectTarget.value = row; rejectNote.value = ''; rejectDialog.value = true }

async function submitReject() {
  if (!rejectNote.value.trim()) return ElMessage.warning('请填写拒绝原因')
  operating.value = true
  try {
    await api.rejectRedeem(rejectTarget.value.id, rejectNote.value.trim())
    ElMessage.success('已拒绝，积分已解冻')
    rejectDialog.value = false
    loadOrders()
  } catch (err: any) {
    ElMessage.error(err?.message ?? '操作失败')
  } finally { operating.value = false }
}

onMounted(loadOrders)
</script>

<style scoped>
.handled { font-size: 12px; color: var(--text-lo); }
</style>
