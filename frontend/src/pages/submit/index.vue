<template>
  <div class="submit-page">
    <div class="page-banner">
      <div class="page-banner-inner">
        <h1 class="page-banner-title">提交需求</h1>
        <p class="page-banner-sub">填写完整信息，管理员 1-2 小时内回复</p>
      </div>
    </div>
    <div class="submit-inner">
      <!-- 左侧表单 -->
      <div class="form-panel">
        <div class="form-header">
          <h1 class="form-title">提交需求</h1>
          <p class="form-sub">请填写完整信息，方便管理员快速处理</p>
        </div>

        <div class="form-body">
          <div class="field-group">
            <div class="field">
              <label>课程名称 <span class="req">*</span></label>
              <input v-model="form.courseName" class="input" placeholder="如：高等数学、毕业设计" />
            </div>
            <div class="field">
              <label>需求类型 <span class="req">*</span></label>
              <select v-model="form.orderTypeId" class="input">
                <option value="">请选择需求类型</option>
                <option v-for="t in orderTypes" :key="t.id" :value="t.id">{{ t.name }}（{{ t.price }}）</option>
              </select>
            </div>
          </div>

          <!-- 参考价格提示 -->
          <Transition name="slide">
            <div v-if="selectedType" class="price-tip">
              <span class="price-tip-label">💰 参考价格</span>
              <strong>{{ selectedType.price }}</strong>
              <span v-if="selectedType.description" class="price-tip-desc"> · {{ selectedType.description }}</span>
            </div>
          </Transition>

          <div class="field-group">
            <div class="field">
              <label>年级 <span class="req">*</span></label>
              <select v-model="form.grade" class="input">
                <option value="">请选择年级</option>
                <option value="FRESHMAN">大一</option>
                <option value="SOPHOMORE">大二</option>
                <option value="JUNIOR">大三</option>
              </select>
            </div>
            <div class="field">
              <label>作业截止日期 <span class="req">*</span></label>
              <input v-model="form.deadline" class="input" type="date" :min="today" />
            </div>
          </div>

          <div class="field">
            <label>联系微信号 <span class="req">*</span></label>
            <input v-model="form.contactWechat" class="input" placeholder="管理员将通过此微信与您联系" />
          </div>

          <!-- 服务套餐选择 -->
          <div class="field" v-if="availableServices.length > 0">
            <label>🎓 使用服务套餐 <span class="opt">（可选）</span></label>
            <select v-model="form.redeemItemId" class="input">
              <option value="">不使用服务套餐</option>
              <option v-for="s in availableServices" :key="s.id" :value="s.id">
                {{ s.name }}
                {{ (!s.discountAmt || Number(s.discountAmt) === 0) ? '（免费）' : `（抵扣 ¥${s.discountAmt}）` }}
                <template v-if="s.expiresAt">· {{ formatDate(s.expiresAt) }}到期</template>
              </option>
            </select>
            <p class="field-hint">
              <template v-if="selectedService">
                <template v-if="!selectedService.discountAmt || Number(selectedService.discountAmt) === 0">
                  🎁 使用后本订单<strong>完全免费</strong>，无需付款
                </template>
                <template v-else>
                  🏷️ 管理员报价后自动扣减 ¥{{ selectedService.discountAmt }}
                </template>
              </template>
              <template v-else>可选择积分兑换的服务套餐</template>
            </p>
          </div>
        </div>

        <div class="notice-bar">
          <span class="notice-icon">📌</span>
          <span>提交后请添加管理员微信
            <strong class="wechat-id" @click="copyWechat">{{ adminWechat }}</strong>
            并备注订单号
          </span>
        </div>

        <button class="submit-btn" @click="doSubmit" :disabled="submitting">
          <span v-if="submitting" class="btn-spinner"></span>
          {{ submitting ? '提交中...' : '确认提交' }}
        </button>
      </div>

      <!-- 右侧信息栏 -->
      <aside class="info-panel">
        <div class="info-card">
          <h3 class="info-card-title">📋 流程说明</h3>
          <div class="flow-steps">
            <div class="flow-step">
              <div class="flow-num">1</div>
              <div class="flow-text">
                <div class="flow-step-title">填写需求信息</div>
                <div class="flow-step-desc">选择课程类型和截止日期</div>
              </div>
            </div>
            <div class="flow-line"></div>
            <div class="flow-step">
              <div class="flow-num">2</div>
              <div class="flow-text">
                <div class="flow-step-title">添加管理员微信</div>
                <div class="flow-step-desc">备注订单号，方便快速沟通</div>
              </div>
            </div>
            <div class="flow-line"></div>
            <div class="flow-step">
              <div class="flow-num">3</div>
              <div class="flow-text">
                <div class="flow-step-title">确认报价开始处理</div>
                <div class="flow-step-desc">管理员1-2小时内回复</div>
              </div>
            </div>
          </div>
        </div>

        <div class="info-card contact-info">
          <h3 class="info-card-title">💬 管理员联系方式</h3>
          <div class="wechat-box" @click="copyWechat">
            <div class="wechat-label">微信号</div>
            <div class="wechat-val">{{ adminWechat }}</div>
            <div class="wechat-copy">点击复制</div>
          </div>
        </div>

        <div v-if="orderTypes.length" class="info-card">
          <h3 class="info-card-title">💰 价格参考</h3>
          <div v-for="t in orderTypes" :key="t.id" class="mini-price">
            <span>{{ t.name }}</span>
            <span class="mini-price-val">{{ t.price }}</span>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api } from '../../api'

const router = useRouter()
const route = useRoute()
const orderTypes = ref<any[]>([])
const availableServices = ref<any[]>([])
const availableCoupons = ref<any[]>([])
const today = new Date().toISOString().slice(0, 10)
const submitting = ref(false)
const form = reactive({
  courseName: '',
  orderTypeId: '',
  grade: '',
  deadline: '',
  contactWechat: '',
  redeemItemId: '',
  couponId: '',
})
const selectedType = computed(() => orderTypes.value.find(t => t.id === form.orderTypeId) ?? null)
const selectedService = computed(() => availableServices.value.find(s => s.id === form.redeemItemId) ?? null)
const adminWechat = ref('Jt--04')

function formatDate(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

onMounted(async () => {
  const [typesRes, configRes, servicesRes, couponsRes]: any[] = await Promise.all([
    api.getOrderTypes(),
    api.getConfig(),
    api.getAvailableRedeems().catch(() => ({ data: [] })),
    api.getMyCoupons().catch(() => ({ data: { list: [] } })),
  ])
  orderTypes.value = typesRes.data ?? []
  if (configRes.data?.adminWechatId) adminWechat.value = configRes.data.adminWechatId

  // 过滤出可用的服务套餐
  const allRedeems = servicesRes.data ?? []
  availableServices.value = allRedeems.filter((r: any) => r.type === 'SERVICE')

  // 只展示未使用且未过期的优惠券
  const now = Date.now()
  availableCoupons.value = (couponsRes.data?.list ?? []).filter(
    (c: any) => c.status === 'UNUSED' && new Date(c.expiresAt).getTime() > now,
  )

  // 从首页价格行跳转时预选类型
  const preTypeId = route.query.typeId as string
  if (preTypeId && orderTypes.value.some(t => t.id === preTypeId)) {
    form.orderTypeId = preTypeId
  }
})

function copyWechat() {
  navigator.clipboard.writeText(adminWechat.value).then(() => alert(`✅ 已复制微信号 ${adminWechat.value}`))
}

async function doSubmit() {
  if (!form.courseName.trim()) return alert('请填写课程名称')
  if (!form.orderTypeId) return alert('请选择需求类型')
  if (!form.grade) return alert('请选择年级')
  if (!form.deadline) return alert('请选择截止日期')
  if (!form.contactWechat.trim()) return alert('请填写联系微信号')
  submitting.value = true
  try {
    const payload: any = {
      courseName: form.courseName,
      orderTypeId: form.orderTypeId,
      grade: form.grade,
      deadline: new Date(form.deadline + 'T23:59:59Z').toISOString(),
      contactWechat: form.contactWechat,
      source: 'PC',
    }
    if (form.redeemItemId) payload.redeemItemId = form.redeemItemId
    if (form.couponId) payload.couponId = form.couponId

    const res: any = await api.createOrder(payload)
    const isFree = res.data.quotedPrice === '0'
    router.push(`/result?orderNo=${res.data.orderNo}&adminWechat=${res.data.adminWechatId ?? 'Jt--04'}${isFree ? '&free=1' : ''}`)
  } catch (e: any) {
    alert(e.message ?? '提交失败，请重试')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.page-banner {
  background: linear-gradient(135deg, #060d1f 0%, #0f1f4d 55%, #1e3a5f 100%);
  padding: 40px 32px 36px; text-align: center;
}
.page-banner-inner { max-width: 1100px; margin: 0 auto; }
.page-banner-title { font-size: 28px; font-weight: 900; color: #fff; margin-bottom: 6px; }
.page-banner-sub { font-size: 14px; color: rgba(255,255,255,0.55); }

.submit-page { background: var(--bg); min-height: calc(100vh - var(--nav-h)); }
.submit-inner { max-width: 1100px; margin: 0 auto; padding: 40px 32px 80px; display: grid; grid-template-columns: 1fr 360px; gap: 32px; align-items: start; }
@media (max-width: 900px) { .submit-inner { grid-template-columns: 1fr; } }
@media (max-width: 640px) {
  .page-banner { padding: 28px 20px 24px; }
  .page-banner-title { font-size: 22px; }
  .submit-inner { padding: 16px 14px 80px; }
  .form-panel { padding: 20px 16px; }
  .form-header { margin-bottom: 20px; padding-bottom: 16px; }
  .form-title { font-size: 20px; }
  .info-panel { display: none; }
}

/* ─── 左侧表单面板 ─── */
.form-panel { background: var(--card); border-radius: var(--radius-lg); padding: 40px; box-shadow: var(--shadow); }
.form-header { margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid var(--border); }
.form-title { font-size: 26px; font-weight: 800; color: var(--text-1); margin-bottom: 6px; }
.form-sub { font-size: 14px; color: var(--text-3); }
.form-body { display: flex; flex-direction: column; gap: 20px; margin-bottom: 24px; }
.field-group { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
@media (max-width: 600px) { .field-group { grid-template-columns: 1fr; } }

.field { display: flex; flex-direction: column; gap: 8px; }
.field label { font-size: 13px; font-weight: 600; color: var(--text-2); }
.req { color: var(--danger); }
.opt { font-weight: 400; color: var(--text-3); font-size: 12px; }
.input {
  border: 1.5px solid var(--border); border-radius: var(--radius-sm);
  padding: 10px 14px; font-size: 15px; color: var(--text-1);
  background: var(--white); outline: none;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
  width: 100%;
}
.input:focus {
  border-color: var(--primary); background: var(--white);
  box-shadow: 0 0 0 3px rgba(59,130,246,0.12);
}
.field-hint { font-size: 12px; color: var(--text-3); margin-top: -4px; }

/* 参考价格提示 */
.price-tip {
  background: var(--primary-light); border-radius: var(--radius-sm);
  padding: 12px 16px; font-size: 14px; color: var(--primary);
  display: flex; align-items: center; gap: 8px;
}
.price-tip-label { font-weight: 600; }
.price-tip-desc { color: #5c9af5; font-size: 13px; }
.slide-enter-active, .slide-leave-active { transition: opacity 0.2s, transform 0.2s; }
.slide-enter-from, .slide-leave-to { opacity: 0; transform: translateY(-6px); }

/* 提示栏 */
.notice-bar {
  display: flex; align-items: flex-start; gap: 10px;
  background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.2);
  border-radius: var(--radius-sm); padding: 14px 16px;
  font-size: 14px; color: #fbbf24; margin-bottom: 24px; line-height: 1.6;
}
.notice-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
.wechat-id { color: var(--primary); cursor: pointer; }
.wechat-id:hover { text-decoration: underline; }

.submit-btn {
  width: 100%; background: linear-gradient(135deg, var(--primary), #4096ff);
  color: #fff; border: none; border-radius: var(--radius);
  padding: 16px; font-size: 16px; font-weight: 700;
  box-shadow: 0 6px 24px rgba(22,119,255,0.3);
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: opacity 0.15s, box-shadow 0.15s;
}
.submit-btn:hover:not(:disabled) { box-shadow: 0 10px 32px rgba(22,119,255,0.4); }
.submit-btn:disabled { opacity: 0.6; box-shadow: none; cursor: not-allowed; }
.btn-spinner {
  width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff; border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ─── 右侧信息栏 ─── */
.info-panel { display: flex; flex-direction: column; gap: 16px; }
.info-card { background: var(--card); border-radius: var(--radius-lg); padding: 24px; box-shadow: var(--shadow-sm); }
.info-card-title { font-size: 15px; font-weight: 700; color: var(--text-1); margin-bottom: 18px; }

.flow-steps { display: flex; flex-direction: column; }
.flow-step { display: flex; gap: 14px; align-items: flex-start; }
.flow-num {
  width: 28px; height: 28px; border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), #4096ff);
  color: #fff; font-size: 13px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; box-shadow: 0 3px 10px rgba(22,119,255,0.3);
}
.flow-step-title { font-size: 14px; font-weight: 600; color: var(--text-1); margin-bottom: 2px; }
.flow-step-desc { font-size: 12px; color: var(--text-3); }
.flow-line { width: 1px; height: 20px; background: var(--border); margin: 6px 0 6px 13px; }

.contact-info { background: linear-gradient(135deg, #0c1b4d, #1677ff); }
.contact-info .info-card-title { color: rgba(255,255,255,0.8); }
.wechat-box {
  background: rgba(255,255,255,0.12); border-radius: var(--radius-sm);
  padding: 14px 16px; cursor: pointer;
  display: flex; align-items: center; justify-content: space-between;
  transition: background 0.15s;
}
.wechat-box:hover { background: rgba(255,255,255,0.2); }
.wechat-label { font-size: 12px; color: rgba(255,255,255,0.6); }
.wechat-val { font-size: 18px; font-weight: 800; color: #fff; }
.wechat-copy { font-size: 12px; color: rgba(255,255,255,0.6); background: rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 6px; }

.mini-price { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
.mini-price:last-child { border-bottom: none; padding-bottom: 0; }
.mini-price-val { font-weight: 700; color: var(--primary); }

</style>
