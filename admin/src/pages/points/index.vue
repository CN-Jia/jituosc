<template>
  <div class="sf-page">
    <!-- 积分规则 -->
    <div class="sf-panel">
      <div class="sf-panel-hd">积分规则配置</div>
      <el-table :data="rules" v-loading="rulesLoading" style="width:100%">
        <el-table-column label="触发事件" min-width="220">
          <template #default="{ row }">{{ eventLabel(row.eventType) }}</template>
        </el-table-column>
        <el-table-column label="奖励积分" width="140">
          <template #default="{ row }">
            <el-input-number v-model="row.points" :min="1" :max="9999" size="small" style="width:110px" />
          </template>
        </el-table-column>
        <el-table-column label="启用" width="90">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="saveRule(row)">保存</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 用户积分汇总 -->
    <div class="sf-panel">
      <div class="sf-panel-hd">
        <div class="sf-toolbar-left">
          用户积分汇总
        </div>
        <el-input v-model="keyword" placeholder="搜索昵称/用户名" clearable style="width:200px" @change="loadUsers" />
      </div>
      <el-table :data="users" v-loading="usersLoading" style="width:100%">
        <el-table-column prop="nickname" label="昵称" width="130" />
        <el-table-column prop="username" label="用户名" width="130" />
        <el-table-column label="可用积分" width="110">
          <template #default="{ row }">
            <span class="pts-val cyan">{{ row.totalPoints }}</span>
          </template>
        </el-table-column>
        <el-table-column label="冻结积分" width="100">
          <template #default="{ row }">
            <span class="pts-val orange">{{ row.frozenPoints }}</span>
          </template>
        </el-table-column>
        <el-table-column label="累计获得" width="100">
          <template #default="{ row }">
            <span class="pts-val purple">{{ row.lifetimeEarned }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90">
          <template #default="{ row }">
            <el-button size="small" @click="openAdjust(row)">调整</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="usersTotal > pageSize" class="sf-pagination">
        <el-pagination background layout="prev, pager, next"
          :total="usersTotal" :page-size="pageSize" v-model:current-page="currentPage" @current-change="loadUsers" />
      </div>
    </div>

    <!-- 手动调整积分 -->
    <el-dialog v-model="adjustDialog" title="手动调整积分" width="380px">
      <div class="adj-info">
        <span class="adj-name">{{ adjustTarget?.nickname }}</span>
        <span class="adj-sub">{{ adjustTarget?.username }}</span>
        <span class="adj-pts">当前可用：<strong class="cyan">{{ adjustTarget?.totalPoints }}</strong> 积分</span>
      </div>
      <el-form label-position="top" style="margin-top:16px">
        <el-form-item label="调整量（正数加积分，负数扣积分）">
          <el-input-number v-model="adjustDelta" :min="-99999" :max="99999" style="width:100%" />
        </el-form-item>
        <el-form-item label="备注（可选）">
          <el-input v-model="adjustRemark" placeholder="如：活动奖励" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustDialog = false">取消</el-button>
        <el-button type="primary" :loading="adjusting" @click="submitAdjust">确认调整</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from '../../api'

const EVENT_LABELS: Record<string, string> = {
  INVITE_REGISTER: '邀请注册奖励',
  INVITE_FIRST_ORDER: '拉新首购奖励（给邀请者）',
  NEW_USER_FIRST_ORDER: '新用户首购奖励',
  ADMIN_ADJUST: '管理员手动调整',
}
const eventLabel = (t: string) => EVENT_LABELS[t] ?? t

const rules = ref<any[]>([])
const rulesLoading = ref(false)
const users = ref<any[]>([])
const usersLoading = ref(false)
const usersTotal = ref(0)
const currentPage = ref(1)
const pageSize = 20
const keyword = ref('')

const adjustDialog = ref(false)
const adjustTarget = ref<any>(null)
const adjustDelta = ref(0)
const adjustRemark = ref('')
const adjusting = ref(false)

async function loadRules() {
  rulesLoading.value = true
  try {
    const res: any = await api.getPointRules()
    rules.value = res.data.rules
    const existing = new Set(rules.value.map((r: any) => r.eventType))
    const defaults = [
      { eventType: 'INVITE_REGISTER', points: 50, enabled: true },
      { eventType: 'INVITE_FIRST_ORDER', points: 100, enabled: true },
      { eventType: 'NEW_USER_FIRST_ORDER', points: 30, enabled: true },
    ]
    defaults.forEach(d => { if (!existing.has(d.eventType)) rules.value.push(d) })
  } finally { rulesLoading.value = false }
}

async function saveRule(row: any) {
  try {
    await api.updatePointRule(row.eventType, { points: row.points, enabled: row.enabled })
    ElMessage.success('规则已保存')
  } catch (e: any) { ElMessage.error(e.message ?? '保存失败') }
}

async function loadUsers() {
  usersLoading.value = true
  try {
    const res: any = await api.getPointUsers({ page: currentPage.value, pageSize, keyword: keyword.value || undefined })
    users.value = res.data.list
    usersTotal.value = res.data.total
  } finally { usersLoading.value = false }
}

function openAdjust(row: any) {
  adjustTarget.value = row; adjustDelta.value = 0; adjustRemark.value = ''; adjustDialog.value = true
}

async function submitAdjust() {
  if (!adjustTarget.value || adjustDelta.value === 0) return
  adjusting.value = true
  try {
    await api.adjustPoints(adjustTarget.value.userId, adjustDelta.value, adjustRemark.value || undefined)
    ElMessage.success('积分调整成功')
    adjustDialog.value = false
    loadUsers()
  } catch (err: any) {
    ElMessage.error(err?.message ?? '调整失败')
  } finally { adjusting.value = false }
}

onMounted(() => { loadRules(); loadUsers() })
</script>

<style scoped>
.pts-val { font-weight: 700; font-variant-numeric: tabular-nums; font-size: 14px; }
.pts-val.cyan   { color: var(--accent); }
.pts-val.orange { color: var(--warning); }
.pts-val.purple { color: var(--purple); }

.adj-info { display: flex; flex-direction: column; gap: 4px; background: var(--accent-dim); border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; }
.adj-name { font-size: 15px; font-weight: 600; color: var(--text-hi); }
.adj-sub  { font-size: 12px; color: var(--text-lo); }
.adj-pts  { font-size: 13px; color: var(--text-md); margin-top: 4px; }
.cyan { color: var(--accent); }
</style>
