<template>
  <div class="sf-page">
    <!-- 状态汇总卡 -->
    <div class="status-bar">
      <div
        v-for="s in statusOptions"
        :key="s.value"
        class="sbar-item"
        :class="{ active: filters.status === s.value }"
        @click="quickFilter(s.value)"
      >
        <span class="sbar-num">{{ stats[s.value] ?? 0 }}</span>
        <span class="sbar-label">{{ s.label }}</span>
      </div>
    </div>

    <div class="sf-panel">
      <div class="sf-panel-hd">
        <div class="sf-toolbar-left">
          <el-select v-model="filters.status" placeholder="全部状态" clearable style="width:130px" @change="loadOrders">
            <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
          <el-input v-model="filters.keyword" placeholder="订单号 / 商品 / 用户" style="width:220px"
            @keyup.enter="loadOrders" clearable @clear="loadOrders">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-button type="primary" @click="loadOrders">搜索</el-button>
        </div>
      </div>

      <el-table :data="orders" v-loading="loading" style="width:100%">
        <el-table-column prop="orderNo" label="订单号" width="180" />
        <el-table-column label="商品" min-width="140">
          <template #default="{ row }">{{ row.product?.name ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="用户" width="120">
          <template #default="{ row }">{{ row.user?.nickname ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="实付" width="100">
          <template #default="{ row }">¥{{ Number(row.paidPrice).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="tagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="140">
          <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'PAID'"
              type="success" size="small"
              @click.stop="handleComplete(row)"
            >确认完成</el-button>
            <el-button
              v-if="row.status !== 'COMPLETED' && row.status !== 'CANCELLED'"
              type="danger" size="small" plain
              @click.stop="openCancel(row)"
            >取消</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="filters.page"
          :page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="loadOrders"
        />
      </div>
    </div>

    <!-- 取消弹窗 -->
    <el-dialog v-model="cancelDialog" title="取消订单" width="400px">
      <el-input v-model="cancelReason" placeholder="取消原因（可选）" />
      <template #footer>
        <el-button @click="cancelDialog = false">关闭</el-button>
        <el-button type="danger" :loading="cancelling" @click="confirmCancel">确认取消</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from '../../api'

const statusOptions = [
  { value: 'CREATED',   label: '待支付' },
  { value: 'PAID',      label: '已支付' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'CANCELLED', label: '已取消' },
]

function statusLabel(s: string) {
  const m: Record<string, string> = { CREATED: '待支付', PAID: '已支付', COMPLETED: '已完成', CANCELLED: '已取消' }
  return m[s] ?? s
}
function tagType(s: string) {
  const m: Record<string, string> = { CREATED: 'warning', PAID: '', COMPLETED: 'success', CANCELLED: 'info' }
  return (m[s] ?? 'info') as any
}
function fmtDate(d: string) {
  return new Date(d).toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' })
}

const loading = ref(false)
const orders = ref<any[]>([])
const total = ref(0)
const pageSize = 20
const stats = ref<Record<string, number>>({})

const filters = reactive({ status: '', keyword: '', page: 1 })

const cancelDialog = ref(false)
const cancelReason = ref('')
const cancelling = ref(false)
const selectedOrder = ref<any>(null)

async function loadStats() {
  try {
    const res: any = await api.getProductOrderStats()
    stats.value = res.data ?? {}
  } catch {}
}

async function loadOrders() {
  loading.value = true
  try {
    const res: any = await api.getProductOrders({
      page: filters.page,
      pageSize,
      status: filters.status || undefined,
      keyword: filters.keyword || undefined,
    })
    orders.value = res.data.list
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

function quickFilter(v: string) {
  filters.status = filters.status === v ? '' : v
  filters.page = 1
  loadOrders()
}

async function handleComplete(row: any) {
  try {
    await api.completeProductOrder(row.id)
    ElMessage.success('订单已完成')
    loadOrders(); loadStats()
  } catch (err: any) {
    ElMessage.error(err?.message ?? '操作失败')
  }
}

function openCancel(row: any) {
  selectedOrder.value = row
  cancelReason.value = ''
  cancelDialog.value = true
}

async function confirmCancel() {
  if (!selectedOrder.value) return
  cancelling.value = true
  try {
    await api.cancelProductOrder(selectedOrder.value.id, cancelReason.value || undefined)
    ElMessage.success('订单已取消')
    cancelDialog.value = false
    loadOrders(); loadStats()
  } catch (err: any) {
    ElMessage.error(err?.message ?? '操作失败')
  } finally {
    cancelling.value = false
  }
}

onMounted(() => { loadOrders(); loadStats() })
</script>

<style scoped>
.sf-page { display: flex; flex-direction: column; gap: 16px; }
.status-bar { display: flex; gap: 12px; flex-wrap: wrap; }
.sbar-item {
  flex: 1; min-width: 100px; padding: 14px 16px; border-radius: 10px;
  border: 1px solid var(--border); background: var(--bg-panel);
  cursor: pointer; transition: all 0.15s; text-align: center;
}
.sbar-item:hover, .sbar-item.active { border-color: var(--accent); background: var(--accent-dim); }
.sbar-num { display: block; font-size: 22px; font-weight: 800; color: var(--accent); margin-bottom: 4px; }
.sbar-label { font-size: 12px; color: var(--text-lo); }
.sf-panel-hd { padding: 16px; border-bottom: 1px solid var(--border); }
.sf-toolbar-left { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.pagination { padding: 12px 16px; display: flex; justify-content: flex-end; }
</style>
