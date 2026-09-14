import axios from 'axios'
import { useUserStore } from '../store/user'
import router from '../router'

const http = axios.create({ baseURL: '/api', timeout: 30000 })

http.interceptors.request.use((config) => {
  const store = useUserStore()
  if (store.token) config.headers.Authorization = `Bearer ${store.token}`
  return config
})

const FRIENDLY_ERRORS: Record<string, string> = {
  ORDER_STATUS_INVALID: '订单状态不允许此操作',
}

http.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      useUserStore().logout()
      router.push('/login')
    }
    const apiError = err.response?.data?.error
    if (apiError?.code && FRIENDLY_ERRORS[apiError.code]) {
      return Promise.reject({ ...apiError, message: FRIENDLY_ERRORS[apiError.code] })
    }
    return Promise.reject(apiError ?? err)
  }
)

export const api = {
  // 认证
  sendCode: (email: string) => http.post('/auth/send-code', { email }),
  register: (data: any) => http.post('/auth/register', data),
  login: (identifier: string, password: string) => http.post('/auth/login', { identifier, password }),
  getMe: () => http.get('/auth/me'),
  updateProfile: (data: any) => http.put('/auth/profile', data),
  changePassword: (oldPassword: string, newPassword: string) => http.put('/auth/password', { oldPassword, newPassword }),
  forgotPassword: (email: string) => http.post('/auth/forgot-password', { email }),
  resetPassword: (email: string, code: string, newPassword: string) => http.post('/auth/reset-password', { email, code, newPassword }),
  resendVerification: () => http.post('/auth/resend-verification'),
  verifyEmail: (code: string) => http.post('/auth/verify-email', { code }),

  // 健康/运行时长
  getHealth: () => http.get('/health', { baseURL: '' }),

  // 公开数据
  getConfig: () => http.get('/config'),
  getOrderTypes: () => http.get('/order-types'),
  getActivities: () => http.get('/activities'),
  getCarousel: () => http.get('/carousel'),

  // 论坛
  getPosts: (params?: any) => http.get('/posts', { params }),
  getPost: (id: string) => http.get(`/posts/${id}`),
  createPost: (data: any) => http.post('/posts', data),
  createComment: (postId: string, content: string) => http.post(`/posts/${postId}/comments`, { content }),
  deleteMyComment: (postId: string, commentId: string) => http.delete(`/posts/${postId}/comments/${commentId}`),

  // 需求订单
  createOrder: (data: any) => http.post('/orders', data),
  getMyOrders: () => http.get('/orders/my'),
  getOrder: (id: string) => http.get(`/orders/${id}`),

  // 积分/邀请
  getInviteInfo: () => http.get('/points/invite'),
  getInvitees: () => http.get('/points/invitees'),
  getPointBalance: () => http.get('/points/balance'),
  getPointLogs: (params?: any) => http.get('/points/logs', { params }),
  getMyCoupons: () => http.get('/coupons/my'),

  // 积分商城
  getShopItems: (params?: any) => http.get('/shop/items', { params }),
  submitRedeem: (shopItemId: string) => http.post('/shop/redeem', { shopItemId }),
  getMyRedeems: () => http.get('/shop/redeem/my'),
  getAvailableRedeems: () => http.get('/redeem/available'),

  // 幸运转盘
  getLuckyWheelInfo: () => http.get('/lucky-wheel/info'),
  spinLuckyWheel: () => http.post('/lucky-wheel/spin'),
  getActivityPopup: () => http.get('/activity-popup'),

  // 毕设进度查询
  getThesisNotice: () => http.get('/thesis/site-notice'),
  getThesisActivities: () => http.get('/thesis/activities'),
  queryThesisProject: (data: { title: string; code: string }) => http.post('/thesis/projects/query', data),
}
