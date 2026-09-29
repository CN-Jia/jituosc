<template>
  <div class="config-page">
    <div class="config-card card">
      <h3 class="card-title">收款码配置</h3>
      <p class="card-sub">配置微信和支付宝的收款二维码，用户支付时将看到这些图片</p>

      <div class="qr-grid">
        <!-- 微信 -->
        <div class="qr-item">
          <div class="qr-label">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M7.5 4C4.46 4 2 6.24 2 9c0 1.46.65 2.77 1.69 3.7L3 15l2.3-1.15A6.3 6.3 0 0 0 7.5 14c3.04 0 5.5-2.24 5.5-5S10.54 4 7.5 4z"/></svg>
            微信收款码
          </div>
          <div class="qr-preview-wrap">
            <img v-if="form.wechatUrl" :src="form.wechatUrl" class="qr-preview" alt="微信收款码" @error="form.wechatUrl = ''" />
            <div v-else class="qr-placeholder">未配置</div>
          </div>
          <el-input v-model="form.wechatUrl" placeholder="输入微信收款码图片 URL" clearable>
            <template #prepend>URL</template>
          </el-input>
        </div>

        <!-- 支付宝 -->
        <div class="qr-item">
          <div class="qr-label">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm.5 11.5H8v-5h2.5v5zm0-6H8V6h2.5v1.5z"/></svg>
            支付宝收款码
          </div>
          <div class="qr-preview-wrap">
            <img v-if="form.alipayUrl" :src="form.alipayUrl" class="qr-preview" alt="支付宝收款码" @error="form.alipayUrl = ''" />
            <div v-else class="qr-placeholder">未配置</div>
          </div>
          <el-input v-model="form.alipayUrl" placeholder="输入支付宝收款码图片 URL" clearable>
            <template #prepend>URL</template>
          </el-input>
        </div>
      </div>

      <div class="config-tip">
        <el-icon><InfoFilled /></el-icon>
        图片 URL 可使用图床链接（如微信图片直链、Imgur 等）。建议图片尺寸 300×300 以上的正方形二维码图片。
      </div>

      <div style="display:flex;justify-content:flex-end;margin-top:20px">
        <el-button type="primary" :loading="saving" @click="handleSave" size="large">保存配置</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from '../../api'

const saving = ref(false)
const form = reactive({ wechatUrl: '', alipayUrl: '' })

onMounted(async () => {
  try {
    const res: any = await api.getPaymentConfig()
    form.wechatUrl = res.data?.wechatUrl ?? ''
    form.alipayUrl = res.data?.alipayUrl ?? ''
  } catch {}
})

async function handleSave() {
  saving.value = true
  try {
    await api.updatePaymentConfig({ wechatUrl: form.wechatUrl || undefined, alipayUrl: form.alipayUrl || undefined })
    ElMessage.success('收款码配置已保存')
  } catch (err: any) {
    ElMessage.error(err?.message ?? '保存失败')
  } finally { saving.value = false }
}
</script>

<style scoped>
.config-page { max-width: 720px; }
.config-card { padding: 28px; }
.card-title { font-size: 18px; font-weight: 700; color: var(--text-hi); margin-bottom: 6px; }
.card-sub { font-size: 13px; color: var(--text-lo); margin-bottom: 24px; }

.qr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 20px; }
.qr-item { display: flex; flex-direction: column; gap: 10px; }
.qr-label { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; color: var(--text-md); }
.qr-preview-wrap { width: 100%; aspect-ratio: 1; max-width: 180px; margin: 0 auto; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--bg-hover); }
.qr-preview { width: 100%; height: 100%; object-fit: contain; }
.qr-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 13px; color: var(--text-lo); }

.config-tip { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: var(--text-lo); line-height: 1.6; background: var(--bg-hover); border-radius: 8px; padding: 10px 12px; }

@media (max-width: 640px) {
  .qr-grid { grid-template-columns: 1fr; }
}
</style>
