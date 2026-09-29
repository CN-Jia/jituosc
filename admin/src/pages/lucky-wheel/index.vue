<template>
  <div class="sf-page">
    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ stats.totalSpins }}</div>
        <div class="stat-label">总抽奖次数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.totalUsers }}</div>
        <div class="stat-label">参与用户数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.redeemedCount }}</div>
        <div class="stat-label">已兑换奖品</div>
      </div>
    </div>

    <!-- 标签页 -->
    <el-tabs v-model="activeTab" type="border-card">
      <!-- 奖品管理 -->
      <el-tab-pane label="奖品配置" name="prizes">
        <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
          <el-button type="primary" @click="openAddPrize">+ 新增奖品</el-button>
          <el-text type="info" size="small">权重越高，中奖概率越大</el-text>
        </div>
        <el-table :data="prizes" v-loading="prizesLoading" style="width:100%">
          <el-table-column label="图标" width="60">
            <template #default="{ row }">{{ row.icon }}</template>
          </el-table-column>
          <el-table-column prop="label" label="奖品名称" min-width="150" />
          <el-table-column label="类型" width="120">
            <template #default="{ row }">
              <el-tag :type="prizeTypeTag(row.type)" size="small">{{ prizeTypeLabel(row.type) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="价值" width="100">
            <template #default="{ row }">{{ row.value ? `¥${row.value}` : '—' }}</template>
          </el-table-column>
          <el-table-column label="权重" width="80">
            <template #default="{ row }">
              <el-tag type="warning" size="small">{{ row.weight }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="库存" width="100">
            <template #default="{ row }">
              {{ row.totalStock === -1 ? '无限' : `${row.remainStock}/${row.totalStock}` }}
            </template>
          </el-table-column>
          <el-table-column label="已中奖" width="80">
            <template #default="{ row }">{{ row._count?.spinResults ?? 0 }}</template>
          </el-table-column>
          <el-table-column label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="row.isActive ? 'success' : 'info'" size="small">
                {{ row.isActive ? '启用' : '禁用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="openEditPrize(row)">编辑</el-button>
              <el-button size="small" type="danger" @click="handleDeletePrize(row)" :disabled="row._count?.spinResults > 0">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 抽奖记录 -->
      <el-tab-pane label="抽奖记录" name="results">
        <el-table :data="results" v-loading="resultsLoading" style="width:100%">
          <el-table-column label="用户" width="120">
            <template #default="{ row }">{{ row.nickname }}</template>
          </el-table-column>
          <el-table-column label="奖品" min-width="150">
            <template #default="{ row }">{{ row.prizeLabel }}</template>
          </el-table-column>
          <el-table-column label="类型" width="100">
            <template #default="{ row }">
              <el-tag :type="prizeTypeTag(row.prizeType)" size="small">{{ prizeTypeLabel(row.prizeType) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="兑换码" width="140">
            <template #default="{ row }">
              <span v-if="row.redeemCode" class="redeem-code">{{ row.redeemCode }}</span>
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag v-if="row.isRedeemed" type="success" size="small">已兑换</el-tag>
              <el-tag v-else-if="row.redeemCode" type="warning" size="small">待兑换</el-tag>
              <el-tag v-else type="info" size="small">—</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="时间" width="160">
            <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="row.redeemCode && !row.isRedeemed"
                type="success"
                size="small"
                @click="handleRedeem(row)"
              >核销</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div v-if="resultsTotal > resultsPageSize" class="sf-pagination">
          <el-pagination
            background
            layout="prev, pager, next"
            :total="resultsTotal"
            :page-size="resultsPageSize"
            :current-page="resultsPage"
            @current-change="p => { resultsPage = p; loadResults() }"
          />
        </div>
      </el-tab-pane>

      <!-- 发放抽奖次数 -->
      <el-tab-pane label="发放抽奖次数" name="grant">
        <el-form :inline="true" style="margin-bottom: 20px;">
          <el-form-item label="用户ID">
            <el-input v-model="grantForm.userId" placeholder="输入用户ID" style="width: 300px" />
          </el-form-item>
          <el-form-item label="次数">
            <el-input-number v-model="grantForm.amount" :min="1" :max="10" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="grantLoading" @click="handleGrantSpins">发放</el-button>
          </el-form-item>
        </el-form>

        <el-divider />

        <h4 style="margin-bottom: 12px;">查看用户抽奖详情</h4>
        <el-form :inline="true" style="margin-bottom: 16px;">
          <el-form-item label="用户ID">
            <el-input v-model="searchUserId" placeholder="输入用户ID" style="width: 300px" />
          </el-form-item>
          <el-form-item>
            <el-button @click="loadUserDetail" :loading="userDetailLoading">查询</el-button>
          </el-form-item>
        </el-form>

        <template v-if="userDetail">
          <el-descriptions :column="2" border style="margin-bottom: 16px;">
            <el-descriptions-item label="用户">{{ userDetail.user.nickname }} ({{ userDetail.user.username }})</el-descriptions-item>
            <el-descriptions-item label="邀请人数">{{ userDetail.inviteCount }}</el-descriptions-item>
            <el-descriptions-item label="基础次数">{{ Math.min(1 + userDetail.inviteCount, 3) }}</el-descriptions-item>
            <el-descriptions-item label="额外次数">{{ userDetail.user.extraSpins }}</el-descriptions-item>
            <el-descriptions-item label="总可用次数">{{ Math.min(1 + userDetail.inviteCount, 3) + userDetail.user.extraSpins }}</el-descriptions-item>
            <el-descriptions-item label="已使用">{{ userDetail.spinResults.length }}</el-descriptions-item>
          </el-descriptions>

          <el-table :data="userDetail.spinResults" style="width: 100%;" v-if="userDetail.spinResults.length > 0">
            <el-table-column label="轮次" width="80" prop="spinRound" />
            <el-table-column label="奖品" min-width="150" prop="prizeLabel" />
            <el-table-column label="类型" width="120">
              <template #default="{ row }">
                <el-tag :type="prizeTypeTag(row.prizeType)" size="small">{{ prizeTypeLabel(row.prizeType) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="兑换码" width="140">
              <template #default="{ row }">
                <span v-if="row.redeemCode" class="redeem-code">{{ row.redeemCode }}</span>
                <span v-else>—</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.isRedeemed" type="success" size="small">已兑换</el-tag>
                <el-tag v-else-if="row.redeemCode" type="warning" size="small">待兑换</el-tag>
                <el-tag v-else type="info" size="small">—</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="时间" width="160">
              <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无抽奖记录" />
        </template>
      </el-tab-pane>

      <!-- 活动浮窗配置 -->
      <el-tab-pane label="活动浮窗" name="popup">
        <el-form :model="popupForm" label-width="120px" style="max-width:600px">
          <el-form-item label="启用浮窗">
            <el-switch v-model="popupForm.enabled" />
          </el-form-item>
          <el-form-item label="标题">
            <el-input v-model="popupForm.title" placeholder="🎰 幸运转盘 限时活动" />
          </el-form-item>
          <el-form-item label="描述">
            <el-input v-model="popupForm.description" type="textarea" :rows="3" placeholder="活动描述" />
          </el-form-item>
          <el-form-item label="按钮文案">
            <el-input v-model="popupForm.buttonText" placeholder="✨ 立即抽奖 ✨" />
          </el-form-item>
          <el-form-item label="跳转链接">
            <el-input v-model="popupForm.linkUrl" placeholder="/lucky-wheel" />
          </el-form-item>
          <el-form-item label="图片URL">
            <el-input v-model="popupForm.imageUrl" placeholder="https://...（可选）" />
          </el-form-item>
          <el-form-item label="显示条件">
            <el-select v-model="popupForm.showCondition" style="width:100%">
              <el-option label="所有用户" value="all" />
              <el-option label="仅新用户（7天内注册）" value="new_user" />
              <el-option label="有可用抽奖次数" value="has_spins" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="popupSaving" @click="savePopup">保存配置</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>
    </el-tabs>

    <!-- 新增/编辑奖品弹窗 -->
    <el-dialog v-model="prizeDialogVisible" :title="isEditing ? '编辑奖品' : '新增奖品'" width="500px">
      <el-form :model="prizeForm" label-width="100px">
        <el-form-item label="奖品名称">
          <el-input v-model="prizeForm.label" placeholder="如：🏆 28.88元现金大奖" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="prizeForm.type" style="width: 100%;" :disabled="isEditing">
            <el-option label="现金兑换" value="CASH_REDEEM" />
            <el-option label="折扣券" value="ORDER_DISCOUNT" />
            <el-option label="谢谢惠顾" value="NONE" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="prizeForm.type !== 'NONE'" label="价值(元)">
          <el-input-number v-model="prizeForm.value" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="权重">
          <el-input-number v-model="prizeForm.weight" :min="1" :max="100" />
          <span style="margin-left: 8px; color: var(--el-text-color-secondary); font-size: 12px;">越高越容易中奖</span>
        </el-form-item>
        <el-form-item v-if="prizeForm.totalStock !== -1" label="总库存">
          <el-input-number v-model="prizeForm.totalStock" :min="0" />
        </el-form-item>
        <el-form-item v-if="prizeForm.totalStock !== -1" label="剩余库存">
          <el-input-number v-model="prizeForm.remainStock" :min="0" />
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="prizeForm.icon" style="width:80px" />
        </el-form-item>
        <el-form-item label="颜色">
          <el-input v-model="prizeForm.color" type="color" style="width:80px" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="prizeForm.sortOrder" :min="0" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="prizeForm.isActive" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="prizeDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="prizeSaving" @click="savePrize">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../../api'

const activeTab = ref('prizes')

// 统计
const stats = ref({ totalSpins: 0, totalUsers: 0, redeemedCount: 0 })

// 奖品
const prizes = ref<any[]>([])
const prizesLoading = ref(false)
const prizeDialogVisible = ref(false)
const prizeSaving = ref(false)
const isEditing = ref(false)
const editPrizeId = ref('')
const prizeForm = reactive({
  label: '',
  type: 'ORDER_DISCOUNT' as string,
  value: 0,
  weight: 1,
  totalStock: -1,
  remainStock: -1,
  icon: '🎯',
  color: '#2D3748',
  sortOrder: 0,
  isActive: true,
})

// 记录
const results = ref<any[]>([])
const resultsLoading = ref(false)
const resultsTotal = ref(0)
const resultsPage = ref(1)
const resultsPageSize = 20

// 发放次数
const grantForm = reactive({ userId: '', amount: 1 })
const grantLoading = ref(false)

// 用户详情
const searchUserId = ref('')
const userDetail = ref<any>(null)
const userDetailLoading = ref(false)

// 浮窗
const popupForm = reactive({
  enabled: false,
  title: '',
  description: '',
  buttonText: '',
  linkUrl: '',
  imageUrl: '',
  showCondition: 'all',
})
const popupSaving = ref(false)

const prizeTypeLabel = (t: string) => ({ CASH_REDEEM: '现金兑换', ORDER_DISCOUNT: '折扣券', NONE: '谢谢惠顾' } as any)[t] ?? t
const prizeTypeTag = (t: string) => ({ CASH_REDEEM: 'danger', ORDER_DISCOUNT: 'warning', NONE: 'info' } as any)[t] ?? ''
const fmtDate = (d: string) => new Date(d).toLocaleString('zh-CN')

// 加载统计
async function loadStats() {
  try {
    const res: any = await api.getWheelStats()
    stats.value = res.data
  } catch {}
}

// 加载奖品
async function loadPrizes() {
  prizesLoading.value = true
  try {
    const res: any = await api.getWheelPrizes()
    prizes.value = res.data
  } finally { prizesLoading.value = false }
}

// 新增奖品
function openAddPrize() {
  isEditing.value = false
  editPrizeId.value = ''
  Object.assign(prizeForm, {
    label: '', type: 'ORDER_DISCOUNT', value: 0, weight: 1,
    totalStock: -1, remainStock: -1, icon: '🎯', color: '#2D3748',
    sortOrder: prizes.value.length, isActive: true,
  })
  prizeDialogVisible.value = true
}

// 编辑奖品
function openEditPrize(row: any) {
  isEditing.value = true
  editPrizeId.value = row.id
  Object.assign(prizeForm, {
    label: row.label,
    type: row.type,
    value: row.value ?? 0,
    weight: row.weight ?? 1,
    totalStock: row.totalStock,
    remainStock: row.remainStock,
    icon: row.icon,
    color: row.color,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  })
  prizeDialogVisible.value = true
}

// 保存奖品（新增/编辑）
async function savePrize() {
  if (!prizeForm.label.trim()) {
    ElMessage.warning('请填写奖品名称')
    return
  }
  prizeSaving.value = true
  try {
    if (isEditing.value) {
      await api.updateWheelPrize(editPrizeId.value, prizeForm)
      ElMessage.success('保存成功')
    } else {
      await api.createWheelPrize(prizeForm)
      ElMessage.success('新增成功')
    }
    prizeDialogVisible.value = false
    loadPrizes()
  } catch (err: any) {
    ElMessage.error(err?.message ?? '保存失败')
  } finally { prizeSaving.value = false }
}

// 删除奖品
async function handleDeletePrize(row: any) {
  await ElMessageBox.confirm(
    `确认删除奖品「${row.label}」？此操作不可撤销。`,
    '删除确认',
    { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
  )
  try {
    await api.deleteWheelPrize(row.id)
    ElMessage.success('删除成功')
    loadPrizes()
  } catch (err: any) {
    ElMessage.error(err?.message ?? '删除失败')
  }
}

// 加载记录
async function loadResults() {
  resultsLoading.value = true
  try {
    const res: any = await api.getWheelResults({ page: resultsPage.value, pageSize: resultsPageSize })
    results.value = res.data.list
    resultsTotal.value = res.data.total
  } finally { resultsLoading.value = false }
}

// 核销兑换码
async function handleRedeem(row: any) {
  await ElMessageBox.confirm(
    `确认核销兑换码 ${row.redeemCode}？\n用户: ${row.nickname}\n奖品: ${row.prizeLabel}`,
    '核销确认',
    { type: 'warning' }
  )
  try {
    await api.redeemWheelCode(row.id)
    ElMessage.success('核销成功')
    loadResults()
    loadStats()
  } catch (err: any) {
    ElMessage.error(err?.message ?? '核销失败')
  }
}

// 发放额外抽奖次数
async function handleGrantSpins() {
  if (!grantForm.userId.trim()) {
    ElMessage.warning('请输入用户ID')
    return
  }
  grantLoading.value = true
  try {
    const res: any = await api.grantWheelSpins(grantForm.userId, grantForm.amount)
    ElMessage.success(`已发放 ${grantForm.amount} 次给 ${res.data.nickname}，当前额外次数: ${res.data.extraSpins}`)
    grantForm.userId = ''
    grantForm.amount = 1
  } catch (err: any) {
    ElMessage.error(err?.message ?? '发放失败')
  } finally { grantLoading.value = false }
}

// 查看用户详情
async function loadUserDetail() {
  if (!searchUserId.value.trim()) {
    ElMessage.warning('请输入用户ID')
    return
  }
  userDetailLoading.value = true
  try {
    const res: any = await api.getWheelUserDetail(searchUserId.value)
    userDetail.value = res.data
  } catch (err: any) {
    ElMessage.error(err?.message ?? '查询失败')
    userDetail.value = null
  } finally { userDetailLoading.value = false }
}

// 加载浮窗配置
async function loadPopup() {
  try {
    const res: any = await api.getActivityPopup()
    Object.assign(popupForm, res.data)
  } catch {}
}

// 保存浮窗配置
async function savePopup() {
  popupSaving.value = true
  try {
    await api.updateActivityPopup(popupForm)
    ElMessage.success('浮窗配置已保存')
  } catch (err: any) {
    ElMessage.error(err?.message ?? '保存失败')
  } finally { popupSaving.value = false }
}

// 监听标签页切换加载数据
watch(activeTab, (tab) => {
  if (tab === 'results' && results.value.length === 0) loadResults()
  if (tab === 'popup') loadPopup()
})

onMounted(() => {
  loadStats()
  loadPrizes()
})
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  background: var(--bg-card, #fff);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 12px;
  padding: 20px;
  text-align: center;
}

.stat-value {
  font-size: 32px;
  font-weight: 800;
  color: #00d4ff;
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 13px;
  color: var(--text-3, #94a3b8);
  margin-top: 4px;
}

.redeem-code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  color: #00d4ff;
  background: rgba(0, 212, 255, 0.08);
  padding: 2px 6px;
  border-radius: 4px;
}

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
