<template>
  <div class="sf-page">
    <!-- 状态汇总 -->
    <div class="status-bar">
      <div v-for="s in statusOptions" :key="s.value" class="sbar-item"
        :class="{ active: filters.status === s.value }" :style="{ '--sc': s.color }"
        @click="quickFilter(s.value)">
        <span class="sbar-num">{{ orderStats[s.value] ?? 0 }}</span>
        <span class="sbar-label">{{ s.label }}</span>
      </div>
    </div>

    <!-- 列表 -->
    <div class="sf-panel">
      <div class="sf-panel-hd">
        <div class="sf-toolbar-left">
          <el-select v-model="filters.status" placeholder="全部状态" clearable style="width:120px" @change="loadOrders">
            <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
          <el-input v-model="filters.keyword" placeholder="订单号 / 课程 / 微信" style="width:220px"
            @keyup.enter="loadOrders" clearable @clear="loadOrders">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-button type="primary" @click="loadOrders">搜索</el-button>
        </div>
        <span class="hd-total">共 {{ total }} 条</span>
      </div>

      <el-table :data="orders" v-loading="loading" style="width:100%" @row-click="openDetail" highlight-current-row>
        <el-table-column prop="orderNo" label="订单号" width="170" />
        <el-table-column prop="courseName" label="课程名称" min-width="150" show-overflow-tooltip />
        <el-table-column label="需求类型" width="120">
          <template #default="{ row }">{{ row.orderType?.name ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="报价" width="100">
          <template #default="{ row }">
            <span v-if="row.quotedPrice" style="font-weight:700;color:var(--el-color-primary)">{{ row.quotedPrice }}</span>
            <span v-else style="color:var(--text-lo)">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="contactWechat" label="联系微信" width="120" show-overflow-tooltip />
        <el-table-column label="截止日期" width="110">
          <template #default="{ row }">{{ fmtDate(row.deadline) }}</template>
        </el-table-column>
        <el-table-column label="创建时间" width="110">
          <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
        </el-table-column>
      </el-table>

      <div class="sf-pagination">
        <el-pagination v-model:current-page="filters.page" v-model:page-size="filters.pageSize"
          :total="total" layout="total, prev, pager, next" @current-change="loadOrders" />
      </div>
    </div>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="订单详情" width="680px" destroy-on-close append-to-body>
      <template v-if="current">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="订单号">{{ current.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTag(current.status)" size="small">{{ statusLabel(current.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="课程名称">{{ current.courseName }}</el-descriptions-item>
          <el-descriptions-item label="需求类型">{{ current.orderType?.name }}</el-descriptions-item>
          <el-descriptions-item label="年级">{{ gradeLabel(current.grade) }}</el-descriptions-item>
          <el-descriptions-item label="截止日期">{{ fmtDate(current.deadline) }}</el-descriptions-item>
          <el-descriptions-item label="联系微信">{{ current.contactWechat }}</el-descriptions-item>
          <el-descriptions-item label="来源">{{ current.source === 'PC' ? '网页' : '小程序' }}</el-descriptions-item>
          <el-descriptions-item label="报价" :span="2">
            <strong v-if="current.quotedPrice" style="color:var(--el-color-primary);font-size:16px">{{ current.quotedPrice }}</strong>
            <span v-else style="color:var(--text-lo)">未设置</span>
            <el-button size="small" style="margin-left:12px" @click="showQuoteDialog = true">
              {{ current.quotedPrice ? '修改报价' : '设置报价' }}
            </el-button>
          </el-descriptions-item>
          <el-descriptions-item v-if="current.adminNote" label="管理员备注" :span="2">{{ current.adminNote }}</el-descriptions-item>
        </el-descriptions>

        <div class="sec-title">状态变更</div>
        <div class="status-actions">
          <template v-for="next in allowedTransitions(current.status)" :key="next">
            <el-button size="small" :type="statusBtnType(next)" @click="openStatusDialog(next)">{{ statusLabel(next) }}</el-button>
          </template>
          <span v-if="!allowedTransitions(current.status).length" style="color:var(--text-lo);font-size:13px">已是终态</span>
        </div>

        <div class="sec-title">添加备注</div>
        <div style="display:flex;gap:8px">
          <el-input v-model="noteText" placeholder="输入备注内容" @keyup.enter="doAddNote" />
          <el-button type="primary" :loading="noteLoading" @click="doAddNote">添加</el-button>
        </div>

        <div v-if="current.statusHistory?.length" class="sec-title">操作记录</div>
        <el-timeline v-if="current.statusHistory?.length" style="margin-top:8px">
          <el-timeline-item v-for="h in current.statusHistory" :key="h.id" :timestamp="fmtDateTime(h.createdAt)" placement="top">
            <span style="font-weight:600">{{ statusLabel(h.toStatus) }}</span>
            <span v-if="h.remark" style="color:var(--text-lo);margin-left:8px">{{ h.remark }}</span>
            <span style="color:var(--text-lo);margin-left:8px;font-size:12px">by {{ h.operator }}</span>
          </el-timeline-item>
        </el-timeline>
      </template>
    </el-dialog>

    <!-- 状态变更弹窗 -->
    <el-dialog v-model="statusDialogVisible" :title="`变更为「${statusLabel(statusTarget)}」`" width="460px" append-to-body>
      <el-form label-position="top">
        <el-form-item label="备注（可选）">
          <el-input v-model="statusRemark" type="textarea" :rows="2" placeholder="变更原因或说明" />
        </el-form-item>
        <template v-if="statusTarget === 'IN_PROGRESS'">
          <el-form-item label="预计完成日期 *">
            <el-date-picker v-model="estimatedDelivery" type="datetime" placeholder="选择预计完成时间" style="width:100%" />
          </el-form-item>
          <el-form-item label="奖励积分（可选）">
            <el-input-number v-model="rewardPoints" :min="0" :max="9999" placeholder="完成后发放" style="width:100%" />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="statusDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="statusLoading" @click="confirmStatusChange">确认变更</el-button>
      </template>
    </el-dialog>

    <!-- 报价弹窗 -->
    <el-dialog v-model="showQuoteDialog" title="设置报价" width="400px" append-to-body>
      <el-input v-model="quotePrice" placeholder="如：200-500元 或 300元" />
      <template #footer>
        <el-button @click="showQuoteDialog = false">取消</el-button>
        <el-button type="primary" :loading="quoteLoading" @click="doSetQuote">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../../api'

const orders = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const orderStats = ref<Record<string, number>>({})
const filters = reactive({ status: '', keyword: '', page: 1, pageSize: 20 })

const detailVisible = ref(false)
const current = ref<any>(null)
const noteText = ref('')
const noteLoading = ref(false)
const showQuoteDialog = ref(false)
const quotePrice = ref('')
const quoteLoading = ref(false)

const statusDialogVisible = ref(false)
const statusTarget = ref('')
const statusRemark = ref('')
const statusLoading = ref(false)
const estimatedDelivery = ref<Date | null>(null)
const rewardPoints = ref<number>(0)

const statusOptions = [
  { value: 'CREATED', label: '已创建', color: '#60a5fa' },
  { value: 'PENDING', label: '待确认', color: '#f59e0b' },
  { value: 'IN_PROGRESS', label: '进行中', color: '#a855f7' },
  { value: 'COMPLETED', label: '已完成', color: '#10d98a' },
  { value: 'CANCELLED', label: '已取消', color: '#6b7280' },
]

const STATUS_MAP: Record<string, string> = { CREATED: '已创建', PENDING: '待确认', IN_PROGRESS: '进行中', COMPLETED: '已完成', CANCELLED: '已取消' }
const TRANSITIONS: Record<string, string[]> = { CREATED: ['PENDING', 'CANCELLED'], PENDING: ['IN_PROGRESS', 'CANCELLED'], IN_PROGRESS: ['COMPLETED', 'CANCELLED'], COMPLETED: [], CANCELLED: [] }

const statusLabel = (s: string) => STATUS_MAP[s] ?? s
const statusTag = (s: string) => ({ CREATED: 'info', PENDING: 'warning', IN_PROGRESS: '', COMPLETED: 'success', CANCELLED: 'info' } as any)[s] ?? ''
const statusBtnType = (s: string) => ({ PENDING: 'warning', IN_PROGRESS: '', COMPLETED: 'success', CANCELLED: 'danger' } as any)[s] ?? 'info'
const allowedTransitions = (s: string) => TRANSITIONS[s] ?? []
const gradeLabel = (g: string) => ({ FRESHMAN: '大一', SOPHOMORE: '大二', JUNIOR: '大三' } as any)[g] ?? '—'
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('zh-CN') : '—'
const fmtDateTime = (d: string) => d ? new Date(d).toLocaleString('zh-CN') : '—'

function quickFilter(status: string) {
  filters.status = filters.status === status ? '' : status
  filters.page = 1
  loadOrders()
}

async function loadOrders() {
  loading.value = true
  try {
    const res: any = await api.getOrders({ status: filters.status || undefined, keyword: filters.keyword || undefined, page: filters.page, pageSize: filters.pageSize })
    orders.value = res.data.list
    total.value = res.data.total
    if (res.data.stats) orderStats.value = res.data.stats
  } catch (e: any) { ElMessage.error(e.message ?? '加载失败') }
  finally { loading.value = false }
}

async function openDetail(row: any) {
  try {
    const res: any = await api.getOrder(row.id)
    current.value = res.data
    noteText.value = ''
    detailVisible.value = true
  } catch (e: any) { ElMessage.error(e.message ?? '加载详情失败') }
}

function openStatusDialog(status: string) {
  statusTarget.value = status
  statusRemark.value = ''
  estimatedDelivery.value = null
  rewardPoints.value = 0
  statusDialogVisible.value = true
}

async function confirmStatusChange() {
  if (statusTarget.value === 'IN_PROGRESS' && !estimatedDelivery.value) {
    return ElMessage.warning('请选择预计完成日期')
  }
  statusLoading.value = true
  try {
    const extra: any = {}
    if (statusTarget.value === 'IN_PROGRESS') {
      extra.estimatedDelivery = estimatedDelivery.value!.toISOString()
      if (rewardPoints.value > 0) extra.rewardPoints = rewardPoints.value
    }
    await api.updateStatus(
      current.value.id,
      statusTarget.value,
      statusRemark.value || (statusTarget.value === 'CANCELLED' ? '管理员取消' : undefined),
      Object.keys(extra).length ? extra : undefined,
    )
    ElMessage.success(`已变更为 ${statusLabel(statusTarget.value)}`)
    statusDialogVisible.value = false
    openDetail(current.value)
    loadOrders()
  } catch (e: any) { ElMessage.error(e.message ?? '操作失败') }
  finally { statusLoading.value = false }
}

async function doSetQuote() {
  if (!quotePrice.value.trim()) return ElMessage.warning('请输入报价')
  quoteLoading.value = true
  try {
    await api.setQuote(current.value.id, quotePrice.value.trim())
    ElMessage.success('报价已设置')
    showQuoteDialog.value = false
    openDetail(current.value)
    loadOrders()
  } catch (e: any) { ElMessage.error(e.message ?? '操作失败') }
  finally { quoteLoading.value = false }
}

async function doAddNote() {
  if (!noteText.value.trim()) return
  noteLoading.value = true
  try {
    await api.addNote(current.value.id, noteText.value.trim())
    ElMessage.success('备注已添加')
    noteText.value = ''
    openDetail(current.value)
  } catch (e: any) { ElMessage.error(e.message ?? '操作失败') }
  finally { noteLoading.value = false }
}

onMounted(loadOrders)
</script>

<style scoped>
.status-bar { display: flex; gap: 10px; flex-wrap: wrap; }
.sbar-item {
  flex: 1; min-width: 100px; padding: 14px 16px; border-radius: 10px;
  border: 1px solid var(--border); background: var(--bg-panel);
  cursor: pointer; transition: all 0.15s; text-align: center;
}
.sbar-item:hover, .sbar-item.active { border-color: var(--sc); }
.sbar-num { display: block; font-size: 24px; font-weight: 800; color: var(--sc); font-variant-numeric: tabular-nums; }
.sbar-label { font-size: 12px; color: var(--text-lo); margin-top: 4px; display: block; }
.hd-total { font-size: 12px; color: var(--text-lo); }
.sf-panel :deep(.el-table) { cursor: pointer; }
.sec-title { font-size: 14px; font-weight: 600; color: var(--text-hi); margin: 20px 0 10px; padding-top: 16px; border-top: 1px solid var(--border); }
.sec-title:first-of-type { margin-top: 16px; border-top: none; padding-top: 0; }
.status-actions { display: flex; gap: 8px; flex-wrap: wrap; }
</style>
