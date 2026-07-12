<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppNav from './components/AppNav.vue'
import { useAuthStore } from './stores/auth'

// The nav is only meaningful once signed in; hide it on the login/callback
// screens. Session restoration happens in main.ts before mount.
const auth = useAuthStore()
const route = useRoute()
const showNav = computed(() => auth.isAuthenticated && !route.meta.public)
</script>

<template>
  <div
    class="flex h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100"
  >
    <app-nav v-if="showNav" />
    <main class="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <router-view />
    </main>
  </div>
</template>
