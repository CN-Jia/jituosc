import axios from 'axios'
import { useAdminStore } from '../store/admin'
import router from '../router'

const http = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

http.interceptors.request.use((config) => {
  const store = useAdminStore()
  if (store.token) config.headers.Authorization = `Bearer ${store.token}`
  return config
})

http.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      useAdminStore().logout()
      router.push('/login')
    }
    return Promise.reject(err.response?.data?.error ?? err)
  }
)

export const api = {
  // 认证
  login: (username: string, password: string) =>
    http.post('/auth/admin-login', { username, password }),

  // 统计
  getStats: () => http.get('/admin/stats'),

  // 订单
  getOrders: (params?: Record<string, any>) => http.get('/admin/orders', { params }),
  getOrder: (id: string) => http.get(`/admin/orders/${id}`),
  updateStatus: (id: string, status: string, remark?: string, extra?: { estimatedDelivery?: string; rewardPoints?: number }) =>
    http.patch(`/admin/orders/${id}/status`, { status, remark, ...extra }),
  addNote: (id: string, note: string) => http.post(`/admin/orders/${id}/note`, { note }),
  setQuote: (id: string, price: string) => http.post(`/admin/orders/${id}/quote`, { price }),

  // 需求类型
  getOrderTypes: () => http.get('/admin/order-types'),
  createOrderType: (data: any) => http.post('/admin/order-types', data),
  updateOrderType: (id: string, data: any) => http.put(`/admin/order-types/${id}`, data),
  deleteOrderType: (id: string) => http.delete(`/admin/order-types/${id}`),

  // 活动管理
  getActivities: () => http.get('/admin/activities'),
  createActivity: (data: any) => http.post('/admin/activities', data),
  updateActivity: (id: string, data: any) => http.put(`/admin/activities/${id}`, data),
  deleteActivity: (id: string) => http.delete(`/admin/activities/${id}`),

  // 论坛帖子
  getPosts: (params?: Record<string, any>) => http.get('/admin/posts', { params }),
  createAdminPost: (data: any) => http.post('/admin/posts', data),
  createPost: (data: any) => http.post('/admin/posts', data),
  updatePost: (id: string, data: any) => http.put(`/admin/posts/${id}`, data),
  reviewPost: (id: string, status: 'APPROVED' | 'REJECTED') =>
    http.patch(`/admin/posts/${id}/status`, { status }),
  pinPost: (id: string) => http.patch(`/admin/posts/${id}/pin`),
  deletePost: (id: string) => http.delete(`/admin/posts/${id}`),
  hideComment: (id: string, isHidden: boolean) =>
    http.patch(`/admin/comments/${id}`, { isHidden }),
  deleteComment: (id: string) => http.delete(`/admin/comments/${id}`),

  // 作品轮播
  getCarousel: () => http.get('/admin/carousel'),
  createCarouselItem: (data: any) => http.post('/admin/carousel', data),
  updateCarouselItem: (id: string, data: any) => http.put(`/admin/carousel/${id}`, data),
  deleteCarouselItem: (id: string) => http.delete(`/admin/carousel/${id}`),

  // 用户反馈
  getFeedbacks: (params?: Record<string, any>) => http.get('/admin/feedback', { params }),
  replyFeedback: (id: string, reply: string) =>
    http.post(`/admin/feedback/${id}/reply`, { reply }),
  updateFeedbackStatus: (id: string, status: string) =>
    http.patch(`/admin/feedback/${id}/status`, { status }),

  // 用户管理
  getUsers: (params?: Record<string, any>) => http.get('/admin/users', { params }),
  toggleUser: (id: string, isActive: boolean) => http.patch(`/admin/users/${id}`, { isActive }),

  // 系统监控
  getSystemStatus: () => http.get('/admin/system/status'),
  getSystemChart: (minutes?: number) => http.get('/admin/system/chart', { params: { minutes } }),

  // 积分规则
  getPointRules: () => http.get('/admin/points/rules'),
  updatePointRule: (eventType: string, data: any) => http.put(`/admin/points/rules/${eventType}`, data),

  // 用户积分
  getPointUsers: (params?: Record<string, any>) => http.get('/admin/points/users', { params }),
  adjustPoints: (userId: string, delta: number, remark?: string) =>
    http.post('/admin/points/adjust', { userId, delta, remark }),

  // 商城商品
  getAdminShopItems: (params?: Record<string, any>) => http.get('/admin/shop/items', { params }),
  createShopItem: (data: any) => http.post('/admin/shop/items', data),
  updateShopItem: (id: string, data: any) => http.put(`/admin/shop/items/${id}`, data),
  deleteShopItem: (id: string) => http.delete(`/admin/shop/items/${id}`),

  // 兑换订单
  getRedeemOrders: (params?: Record<string, any>) => http.get('/admin/redeem/orders', { params }),
  approveRedeem: (id: string, note?: string) => http.post(`/admin/redeem/orders/${id}/approve`, { note }),
  rejectRedeem: (id: string, note: string) => http.post(`/admin/redeem/orders/${id}/reject`, { note }),

  // 商品管理
  getProducts: (params?: Record<string, any>) => http.get('/admin/products', { params }),
  createProduct: (data: any) => http.post('/admin/products', data),
  updateProduct: (id: string, data: any) => http.put(`/admin/products/${id}`, data),
  deleteProduct: (id: string) => http.delete(`/admin/products/${id}`),
  toggleProduct: (id: string) => http.patch(`/admin/products/${id}/toggle`),

  // 商品订单管理
  getProductOrders: (params?: Record<string, any>) => http.get('/admin/product-orders', { params }),
  getProductOrderStats: () => http.get('/admin/product-orders/stats'),
  getProductOrder: (id: string) => http.get(`/admin/product-orders/${id}`),
  completeProductOrder: (id: string) => http.put(`/admin/product-orders/${id}/complete`),
  cancelProductOrder: (id: string, reason?: string) => http.put(`/admin/product-orders/${id}/cancel`, { reason }),

  // 优惠码管理
  getPromoCoupons: (params?: Record<string, any>) => http.get('/admin/promo-coupons', { params }),
  createPromoCoupon: (data: any) => http.post('/admin/promo-coupons', data),
  deletePromoCoupon: (id: string) => http.delete(`/admin/promo-coupons/${id}`),
  deactivatePromoCoupon: (id: string) => http.patch(`/admin/promo-coupons/${id}/deactivate`),
  activatePromoCoupon: (id: string) => http.patch(`/admin/promo-coupons/${id}/activate`),

  // 收款码配置
  getPaymentConfig: () => http.get('/admin/payment-config'),
  updatePaymentConfig: (data: any) => http.put('/admin/payment-config', data),

  // 站内通知
  getNotifications: (params?: Record<string, any>) => http.get('/admin/notifications', { params }),
  markNotificationRead: (id: string) => http.put(`/admin/notifications/${id}/read`),
  markAllNotificationsRead: () => http.put('/admin/notifications/read-all'),

  // 幸运转盘管理
  getWheelPrizes: () => http.get('/admin/wheel/prizes'),
  createWheelPrize: (data: any) => http.post('/admin/wheel/prizes', data),
  updateWheelPrize: (id: string, data: any) => http.put(`/admin/wheel/prizes/${id}`, data),
  deleteWheelPrize: (id: string) => http.delete(`/admin/wheel/prizes/${id}`),
  getWheelResults: (params?: Record<string, any>) => http.get('/admin/wheel/results', { params }),
  redeemWheelCode: (id: string) => http.post(`/admin/wheel/redeem/${id}`),
  getWheelStats: () => http.get('/admin/wheel/stats'),
  grantWheelSpins: (userId: string, amount: number) => http.post('/admin/wheel/grant-spins', { userId, amount }),
  getWheelUserDetail: (userId: string) => http.get(`/admin/wheel/user/${userId}`),

  // 活动浮窗配置
  getActivityPopup: () => http.get('/admin/activity-popup'),
  updateActivityPopup: (data: any) => http.put('/admin/activity-popup', data),

  // 毕设进度管理
  getThesisProjects: () => http.get('/admin/thesis/projects'),
  createThesisProject: (data: any) => http.post('/admin/thesis/projects', data),
  updateThesisProject: (id: number, data: any) => http.put(`/admin/thesis/projects/${id}`, data),
  deleteThesisProject: (id: number) => http.delete(`/admin/thesis/projects/${id}`),
  getThesisProject: (id: number) => http.get(`/admin/thesis/projects/${id}`),
  addThesisProgress: (projectId: number, data: any) =>
    http.post(`/admin/thesis/projects/${projectId}/progress`, data),
  deleteThesisProgress: (id: number) => http.delete(`/admin/thesis/progress/${id}`),
  uploadThesisImage: (progressId: number, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return http.post(`/admin/thesis/progress/${progressId}/images`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  deleteThesisImage: (id: number) => http.delete(`/admin/thesis/images/${id}`),
  getThesisActivities: () => http.get('/admin/thesis/activities'),
  createThesisActivity: (data: any) => http.post('/admin/thesis/activities', data),
  updateThesisActivity: (id: number, data: any) => http.put(`/admin/thesis/activities/${id}`, data),
  deleteThesisActivity: (id: number) => http.delete(`/admin/thesis/activities/${id}`),
  getThesisNotice: () => http.get('/admin/thesis/notice'),
  updateThesisNotice: (data: any) => http.put('/admin/thesis/notice', data),
}
