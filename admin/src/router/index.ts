import { createRouter, createWebHistory } from 'vue-router'
import { useAdminStore } from '../store/admin'

const router = createRouter({
  history: createWebHistory('/admin/'),
  routes: [
    { path: '/login', component: () => import('../pages/login/index.vue') },
    { path: '/', component: () => import('../pages/dashboard/index.vue'), meta: { requiresAuth: true } },
    { path: '/orders', component: () => import('../pages/orders/index.vue'), meta: { requiresAuth: true } },
    { path: '/order-types', component: () => import('../pages/order-types/index.vue'), meta: { requiresAuth: true } },
    { path: '/activities', component: () => import('../pages/activities/index.vue'), meta: { requiresAuth: true } },
    { path: '/posts', component: () => import('../pages/posts/index.vue'), meta: { requiresAuth: true } },
    { path: '/carousel', component: () => import('../pages/carousel/index.vue'), meta: { requiresAuth: true } },
    { path: '/feedback', component: () => import('../pages/feedback/index.vue'), meta: { requiresAuth: true } },
    { path: '/users', component: () => import('../pages/users/index.vue'), meta: { requiresAuth: true } },
    { path: '/points', component: () => import('../pages/points/index.vue'), meta: { requiresAuth: true } },
    { path: '/points/shop', component: () => import('../pages/points/shop.vue'), meta: { requiresAuth: true } },
    { path: '/points/redeem', component: () => import('../pages/points/redeem.vue'), meta: { requiresAuth: true } },
    { path: '/lucky-wheel', component: () => import('../pages/lucky-wheel/index.vue'), meta: { requiresAuth: true } },
    { path: '/thesis', component: () => import('../pages/thesis/index.vue'), meta: { requiresAuth: true } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach((to) => {
  const store = useAdminStore()
  if (to.meta.requiresAuth && !store.isLoggedIn) return '/login'
  if (to.path === '/login' && store.isLoggedIn) return '/'
})

export default router
