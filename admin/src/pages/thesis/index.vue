<template>
  <div class="thesis-admin">
    <div class="page-head">
      <h2 class="page-title">毕设进度管理</h2>
      <p class="page-desc">题目录入、进度追踪、活动与漂浮字管理</p>
    </div>

    <el-tabs v-model="activeTab" class="tabs">
      <!-- ── 题目管理 ── -->
      <el-tab-pane label="题目管理" name="projects">
        <div class="toolbar">
          <el-button type="primary" @click="openProjectDialog()">+ 新增题目</el-button>
        </div>
        <el-table :data="projects" v-loading="loadingProjects" stripe>
          <el-table-column prop="title" label="题目" min-width="220" show-overflow-tooltip />
          <el-table-column prop="studentName" label="学生" width="110" />
          <el-table-column prop="studentNo" label="学号" width="130" />
          <el-table-column prop="advisor" label="导师" width="110" />
          <el-table-column label="验证码" width="110">
            <template #default="{ row }">
              <span class="code-tag">{{ row.uniqueCode }}</span>
            </template>
          </el-table-column>
          <el-table-column label="进度" width="80">
            <template #default="{ row }">{{ row._count?.progresses ?? 0 }}</template>
          </el-table-column>
          <el-table-column label="操作" width="230" fixed="right">
            <template #default="{ row }">
              <el-button size="small" type="primary" @click="openProgress(row)">进度</el-button>
              <el-button size="small" @click="openProjectDialog(row)">编辑</el-button>
              <el-button size="small" type="danger" @click="removeProject(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- ── 活动管理 ── -->
      <el-tab-pane label="活动管理" name="activities">
        <div class="toolbar">
          <el-button type="primary" @click="openActivityDialog()">+ 新增活动</el-button>
        </div>
        <el-table :data="activities" v-loading="loadingActivities" stripe>
          <el-table-column prop="title" label="标题" min-width="200" />
          <el-table-column prop="content" label="内容" min-width="260" show-overflow-tooltip />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.published ? 'success' : 'info'" size="small">
                {{ row.published ? '已发布' : '已隐藏' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="openActivityDialog(row)">编辑</el-button>
              <el-button size="small" type="danger" @click="removeActivity(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- ── 漂浮字 ── -->
      <el-tab-pane label="漂浮字" name="notice">
        <el-form label-width="90px" class="notice-form">
          <el-form-item label="启用">
            <el-switch v-model="notice.enabled" />
          </el-form-item>
          <el-form-item label="漂浮字">
            <el-input v-model="notice.text" type="textarea" :rows="3" placeholder="首页顶部滚动显示的公告文字" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="savingNotice" @click="saveNotice">保存</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>
    </el-tabs>

    <!-- 题目编辑弹窗 -->
    <el-dialog v-model="projectDialog" :title="projectForm.id ? '编辑题目' : '新增题目'" width="480px">
      <el-form :model="projectForm" label-width="90px">
        <el-form-item label="题目" required>
          <el-input v-model="projectForm.title" placeholder="毕业设计题目（唯一）" />
        </el-form-item>
        <el-form-item label="学生姓名" required>
          <el-input v-model="projectForm.studentName" />
        </el-form-item>
        <el-form-item label="学号">
          <el-input v-model="projectForm.studentNo" />
        </el-form-item>
        <el-form-item label="导师">
          <el-input v-model="projectForm.advisor" />
        </el-form-item>
        <el-form-item label="专业">
          <el-input v-model="projectForm.major" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="projectDialog = false">取消</el-button>
        <el-button type="primary" :loading="savingProject" @click="saveProject">保存</el-button>
      </template>
    </el-dialog>

    <!-- 进度管理抽屉 -->
    <el-drawer v-model="progressDrawer" :title="`进度管理 · ${currentProject?.title ?? ''}`" size="640px">
      <div class="progress-add">
        <h4 class="sub-title">新增进度</h4>
        <el-form :model="progressForm" label-width="80px" inline>
          <el-form-item label="标题">
            <el-input v-model="progressForm.title" placeholder="进度标题" style="width: 200px" />
          </el-form-item>
          <el-form-item label="百分比">
            <el-input-number v-model="progressForm.percent" :min="0" :max="100" />
          </el-form-item>
        </el-form>
        <el-form :model="progressForm" label-width="80px">
          <el-form-item label="内容">
            <el-input v-model="progressForm.content" type="textarea" :rows="2" placeholder="进度说明（可选）" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" size="small" :loading="addingProgress" @click="addProgress">添加进度</el-button>
          </el-form-item>
        </el-form>
      </div>

      <h4 class="sub-title">进度记录</h4>
      <el-empty v-if="!currentProject?.progresses?.length" description="暂无进度记录" />
      <div v-for="p in currentProject?.progresses ?? []" :key="p.id" class="progress-item">
        <div class="pi-head">
          <span class="pi-title">{{ p.title }}</span>
          <span class="pi-percent">{{ p.percent }}%</span>
          <el-button size="small" type="danger" text @click="removeProgress(p)">删除</el-button>
        </div>
        <div v-if="p.content" class="pi-content">{{ p.content }}</div>
        <div class="pi-date">{{ fmtDate(p.createdAt) }}</div>
        <div class="pi-images">
          <div v-for="img in p.images" :key="img.id" class="pi-img">
            <img :src="img.url" alt="" />
            <button class="pi-img-del" @click="removeImage(img)">×</button>
          </div>
          <el-upload
            :show-file-list="false"
            :http-request="(opt: any) => doUpload(p.id, opt)"
            accept="image/*"
          >
            <div class="pi-upload">+ 截图</div>
          </el-upload>
        </div>
      </div>
    </el-drawer>

    <!-- 活动编辑弹窗 -->
    <el-dialog v-model="activityDialog" :title="activityForm.id ? '编辑活动' : '新增活动'" width="520px">
      <el-form :model="activityForm" label-width="80px">
        <el-form-item label="标题" required>
          <el-input v-model="activityForm.title" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="activityForm.content" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="发布">
          <el-switch v-model="activityForm.published" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="activityDialog = false">取消</el-button>
        <el-button type="primary" :loading="savingActivity" @click="saveActivity">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../../api'

const activeTab = ref('projects')

// ── 题目 ──
const projects = ref<any[]>([])
const loadingProjects = ref(false)
const projectDialog = ref(false)
const savingProject = ref(false)
const projectForm = reactive<any>({ id: null, title: '', studentName: '', studentNo: '', advisor: '', major: '' })

async function loadProjects() {
  loadingProjects.value = true
  try {
    const res: any = await api.getThesisProjects()
    projects.value = res.projects ?? []
  } finally {
    loadingProjects.value = false
  }
}

function openProjectDialog(row?: any) {
  if (row) {
    Object.assign(projectForm, {
      id: row.id, title: row.title, studentName: row.studentName,
      studentNo: row.studentNo ?? '', advisor: row.advisor ?? '', major: row.major ?? '',
    })
  } else {
    Object.assign(projectForm, { id: null, title: '', studentName: '', studentNo: '', advisor: '', major: '' })
  }
  projectDialog.value = true
}

async function saveProject() {
  if (!projectForm.title || !projectForm.studentName) {
    ElMessage.warning('题目和姓名不能为空')
    return
  }
  savingProject.value = true
  try {
    if (projectForm.id) {
      await api.updateThesisProject(projectForm.id, projectForm)
    } else {
      await api.createThesisProject(projectForm)
    }
    ElMessage.success('保存成功')
    projectDialog.value = false
    await loadProjects()
  } catch (e: any) {
    ElMessage.error(e?.message ?? '保存失败')
  } finally {
    savingProject.value = false
  }
}

async function removeProject(row: any) {
  await ElMessageBox.confirm(`确定删除题目「${row.title}」？其进度记录会一并删除`, '提示', { type: 'warning' })
  await api.deleteThesisProject(row.id)
  ElMessage.success('已删除')
  await loadProjects()
}

// ── 进度 ──
const progressDrawer = ref(false)
const currentProject = ref<any>(null)
const progressForm = reactive<any>({ title: '', percent: 0, content: '' })
const addingProgress = ref(false)

async function openProgress(row: any) {
  const res: any = await api.getThesisProject(row.id)
  currentProject.value = res.project
  Object.assign(progressForm, { title: '', percent: 0, content: '' })
  progressDrawer.value = true
}

async function addProgress() {
  if (!progressForm.title) { ElMessage.warning('进度标题不能为空'); return }
  addingProgress.value = true
  try {
    await api.addThesisProgress(currentProject.value.id, progressForm)
    ElMessage.success('已添加')
    await refreshProgress()
  } catch (e: any) {
    ElMessage.error(e?.message ?? '添加失败')
  } finally {
    addingProgress.value = false
  }
}

async function refreshProgress() {
  const res: any = await api.getThesisProject(currentProject.value.id)
  currentProject.value = res.project
  Object.assign(progressForm, { title: '', percent: 0, content: '' })
}

async function removeProgress(p: any) {
  await ElMessageBox.confirm(`确定删除进度「${p.title}」？`, '提示', { type: 'warning' })
  await api.deleteThesisProgress(p.id)
  ElMessage.success('已删除')
  await refreshProgress()
}

async function doUpload(progressId: number, opt: any) {
  try {
    await api.uploadThesisImage(progressId, opt.file)
    ElMessage.success('上传成功')
    await refreshProgress()
  } catch (e: any) {
    ElMessage.error(e?.message ?? '上传失败')
  }
}

async function removeImage(img: any) {
  await api.deleteThesisImage(img.id)
  ElMessage.success('已删除')
  await refreshProgress()
}

// ── 活动 ──
const activities = ref<any[]>([])
const loadingActivities = ref(false)
const activityDialog = ref(false)
const savingActivity = ref(false)
const activityForm = reactive<any>({ id: null, title: '', content: '', published: true })

async function loadActivities() {
  loadingActivities.value = true
  try {
    const res: any = await api.getThesisActivities()
    activities.value = res.activities ?? []
  } finally {
    loadingActivities.value = false
  }
}

function openActivityDialog(row?: any) {
  if (row) {
    Object.assign(activityForm, { id: row.id, title: row.title, content: row.content ?? '', published: row.published })
  } else {
    Object.assign(activityForm, { id: null, title: '', content: '', published: true })
  }
  activityDialog.value = true
}

async function saveActivity() {
  if (!activityForm.title) { ElMessage.warning('活动标题不能为空'); return }
  savingActivity.value = true
  try {
    if (activityForm.id) {
      await api.updateThesisActivity(activityForm.id, activityForm)
    } else {
      await api.createThesisActivity(activityForm)
    }
    ElMessage.success('保存成功')
    activityDialog.value = false
    await loadActivities()
  } catch (e: any) {
    ElMessage.error(e?.message ?? '保存失败')
  } finally {
    savingActivity.value = false
  }
}

async function removeActivity(row: any) {
  await ElMessageBox.confirm(`确定删除活动「${row.title}」？`, '提示', { type: 'warning' })
  await api.deleteThesisActivity(row.id)
  ElMessage.success('已删除')
  await loadActivities()
}

// ── 漂浮字 ──
const notice = reactive<any>({ text: '', enabled: true })
const savingNotice = ref(false)

async function loadNotice() {
  const res: any = await api.getThesisNotice()
  if (res.notice) {
    notice.text = res.notice.text ?? ''
    notice.enabled = res.notice.enabled ?? true
  }
}

async function saveNotice() {
  savingNotice.value = true
  try {
    await api.updateThesisNotice({ text: notice.text, enabled: notice.enabled })
    ElMessage.success('已保存')
  } catch (e: any) {
    ElMessage.error(e?.message ?? '保存失败')
  } finally {
    savingNotice.value = false
  }
}

function fmtDate(s: string) {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

onMounted(() => {
  loadProjects()
  loadActivities()
  loadNotice()
})
</script>

<style scoped>
.thesis-admin { padding: 4px; }
.page-head { margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
.page-desc { font-size: 12px; color: var(--el-text-color-secondary); margin: 0; }
.toolbar { margin-bottom: 12px; }
.code-tag {
  font-family: monospace; font-weight: 700; letter-spacing: 1px;
  color: #ff7a59; background: rgba(255, 122, 89, 0.12);
  padding: 2px 8px; border-radius: 4px;
}
.notice-form { max-width: 620px; }
.sub-title { font-size: 14px; font-weight: 600; margin: 16px 0 10px; }
.progress-add { padding-bottom: 8px; border-bottom: 1px solid var(--el-border-color-lighter); margin-bottom: 12px; }
.progress-item { border: 1px solid var(--el-border-color-lighter); border-radius: 8px; padding: 12px; margin-bottom: 10px; }
.pi-head { display: flex; align-items: center; gap: 10px; }
.pi-title { font-weight: 600; flex: 1; }
.pi-percent { color: #ff7a59; font-weight: 700; }
.pi-content { font-size: 13px; color: var(--el-text-color-regular); white-space: pre-wrap; margin: 6px 0; }
.pi-date { font-size: 12px; color: var(--el-text-color-secondary); margin-bottom: 8px; }
.pi-images { display: flex; flex-wrap: wrap; gap: 8px; }
.pi-img { position: relative; width: 96px; height: 72px; border-radius: 6px; overflow: hidden; background: var(--el-fill-color-light); }
.pi-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pi-img-del {
  position: absolute; top: 2px; right: 2px; width: 18px; height: 18px; line-height: 1;
  border: none; border-radius: 50%; background: rgba(0, 0, 0, 0.6); color: #fff; cursor: pointer; font-size: 13px;
}
.pi-upload {
  width: 96px; height: 72px; display: flex; align-items: center; justify-content: center;
  border: 1px dashed var(--el-border-color); border-radius: 6px;
  font-size: 12px; color: var(--el-text-color-secondary); cursor: pointer;
}
.pi-upload:hover { border-color: #ff7a59; color: #ff7a59; }
</style>
