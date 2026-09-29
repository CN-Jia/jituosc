<template>
  <div class="sf-page">
    <div class="sf-panel">
      <div class="sf-panel-hd">
        <div class="sf-toolbar-left">
          <el-input v-model="keyword" placeholder="搜索昵称 / 用户名 / 邮箱" style="width:260px" clearable @keyup.enter="load">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-button type="primary" @click="load">搜索</el-button>
        </div>
        <span class="hd-total">共 {{ total }} 名用户</span>
      </div>

      <el-table :data="list" v-loading="loading" style="width:100%">
        <el-table-column label="用户ID" width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <el-text size="small" class="uid-text" @click="copyId(row.id)" style="cursor:pointer;font-family:monospace;">{{ row.id }}</el-text>
          </template>
        </el-table-column>
        <el-table-column label="用户名" prop="username" width="130" />
        <el-table-column label="昵称" prop="nickname" width="120" />
        <el-table-column label="邮箱" prop="email" min-width="180" show-overflow-tooltip />
        <el-table-column label="手机" prop="phone" width="130" />
        <el-table-column label="年级" width="80">
          <template #default="{ row }">{{ gradeLabel(row.grade) }}</template>
        </el-table-column>
        <el-table-column label="订单数" width="75">
          <template #default="{ row }">{{ row._count?.orders ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="邮箱验证" width="90">
          <template #default="{ row }">
            <el-tag :type="row.emailVerified ? 'success' : 'warning'" size="small">
              {{ row.emailVerified ? '已验证' : '未验证' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="75">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'danger'" size="small">
              {{ row.isActive ? '正常' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="注册时间" width="130">
          <template #default="{ row }">{{ fmt(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button :type="row.isActive ? 'danger' : 'success'" size="small" plain @click="toggle(row)">
              {{ row.isActive ? '禁用' : '启用' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="total > pageSize" class="sf-pagination">
        <el-pagination background layout="prev, pager, next"
          :total="total" :page-size="pageSize" :current-page="page"
          @current-change="p => { page = p; load() }" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

function copyId(id: string) {
  navigator.clipboard.writeText(id).then(() => ElMessage.success('已复制用户ID'))
}
import { api } from '../../api'
import { format } from 'date-fns'

const list = ref<any[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = 20
const keyword = ref('')

const gradeLabel = (g: string) => ({ FRESHMAN: '大一', SOPHOMORE: '大二', JUNIOR: '大三' } as any)[g] ?? '—'
const fmt = (d: string) => format(new Date(d), 'MM-dd HH:mm')

async function load() {
  loading.value = true
  try {
    const res: any = await api.getUsers({ page: page.value, pageSize, keyword: keyword.value || undefined })
    list.value = res.data.list
    total.value = res.data.total
  } finally { loading.value = false }
}

async function toggle(row: any) {
  const action = row.isActive ? '禁用' : '启用'
  await ElMessageBox.confirm(`确定${action}用户「${row.nickname}」？`, '确认操作', { type: 'warning' })
  try {
    await api.toggleUser(row.id, !row.isActive)
    ElMessage.success(`已${action}该用户`)
    load()
  } catch (e: any) { ElMessage.error(e.message ?? '操作失败') }
}

onMounted(load)
</script>

<style scoped>
.hd-total { font-size: 12px; color: var(--text-lo); }
</style>
