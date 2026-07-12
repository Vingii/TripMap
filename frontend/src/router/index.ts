import {
  createRouter,
  createWebHistory,
  type NavigationGuardReturn,
  type RouteLocationNormalized,
  type RouteRecordRaw,
} from 'vue-router'
import { useAuthStore } from '../stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    // Routes reachable without an authenticated session (login + callback).
    public?: boolean
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/auth/callback',
    name: 'auth-callback',
    component: () => import('../views/AuthCallbackView.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
  },
  {
    path: '/map',
    name: 'map',
    component: () => import('../views/MapView.vue'),
  },
  {
    path: '/albums',
    name: 'albums',
    component: () => import('../views/AlbumsView.vue'),
  },
]

/**
 * Protect every route except those marked `public`. Unauthenticated users are
 * sent to /login with the requested path preserved in `redirect` so they land
 * back there after signing in.
 */
export function authGuard(to: RouteLocationNormalized): NavigationGuardReturn {
  if (to.meta.public) return true
  const auth = useAuthStore()
  if (!auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  return true
}

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(authGuard)
