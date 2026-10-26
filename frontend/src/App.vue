<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppNav from './components/AppNav.vue'
import { useAuthStore } from './stores/auth'
import { useChangelogStore } from './stores/changelog'

// Lazy, so the markdown renderer stays out of the entry chunk.
const ChangelogDialog = defineAsyncComponent(
  () => import('./components/ChangelogDialog.vue'),
)

// The nav is only meaningful once signed in; hide it on the login/callback
// screens. Session restoration happens in main.ts before mount.
const auth = useAuthStore()
const route = useRoute()
const showNav = computed(() => auth.isAuthenticated && !route.meta.public)

// Once signed in, load the user's changelog marker and pop the dialog if
// anything was added since they last saw it. Best-effort: a failed load just
// means no popup this time.
const changelog = useChangelogStore()
const unseenIds = computed(() => changelog.unseen.map((entry) => entry.id))

async function checkChangelog(): Promise<void> {
  try {
    await changelog.load()
  } catch {
    return
  }
  if (auth.isAuthenticated && changelog.hasUnseen) changelog.show()
}

onMounted(() => {
  watch(
    () => auth.isAuthenticated,
    (signedIn) => {
      if (signedIn) void checkChangelog()
      else changelog.reset()
    },
    { immediate: true },
  )
})
</script>

<template>
  <div
    class="flex h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100"
  >
    <app-nav v-if="showNav" />
    <main class="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <router-view />
    </main>
    <changelog-dialog
      v-if="auth.isAuthenticated && changelog.open"
      :entries="changelog.entries"
      :unseen-ids="unseenIds"
      @close="void changelog.close().catch(() => {})"
    />
  </div>
</template>
