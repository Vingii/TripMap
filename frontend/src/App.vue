<script setup lang="ts">
import { onMounted } from 'vue'
import AppNav from './components/AppNav.vue'
import { useAuthStore } from './stores/auth'

// Restore the session (if a token is present) before the views fetch data.
const auth = useAuthStore()
onMounted(() => {
  void auth.loadUser()
})
</script>

<template>
  <div
    class="flex h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100"
  >
    <app-nav />
    <main class="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <router-view />
    </main>
  </div>
</template>
