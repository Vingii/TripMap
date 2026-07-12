<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

// Completes the interactive login redirect: exchanges the authorization code
// for tokens, then forwards the user to the page they originally requested.
// (The silent-renew iframe never reaches this component — main.ts handles that
// case before the app mounts.)

const auth = useAuthStore()
const router = useRouter()
const failed = ref(false)

onMounted(async () => {
  try {
    const returnTo = await auth.completeLogin()
    await router.replace(returnTo)
  } catch {
    failed.value = true
  }
})
</script>

<template>
  <section
    class="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center"
  >
    <template v-if="failed">
      <p class="text-slate-600 dark:text-slate-400">
        Sign-in could not be completed.
      </p>
      <router-link
        to="/login"
        class="font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400"
      >
        Back to sign in
      </router-link>
    </template>
    <p v-else class="text-slate-600 dark:text-slate-400">Signing you in…</p>
  </section>
</template>
