<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { isOidcConfigured } from '../auth/oidc'

const auth = useAuthStore()
const route = useRoute()
const submitting = ref(false)

const configured = computed(() => isOidcConfigured())

// Where to send the user after login — the page the guard bounced them from.
const redirectTo = computed(() => {
  const target = route.query.redirect
  return typeof target === 'string' ? target : '/'
})

async function signIn(): Promise<void> {
  submitting.value = true
  try {
    await auth.login(redirectTo.value)
  } catch {
    submitting.value = false
  }
}
</script>

<template>
  <section
    class="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-6 px-6 py-12 text-center"
  >
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold">TripMap</h1>
      <p class="text-slate-600 dark:text-slate-400">
        Sign in to log and explore the places you've visited.
      </p>
    </div>

    <button
      v-if="configured"
      type="button"
      class="w-full rounded-md bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:opacity-60 dark:focus:ring-offset-slate-900"
      :disabled="submitting"
      @click="signIn"
    >
      {{ submitting ? 'Redirecting…' : 'Sign in with SSO' }}
    </button>

    <p v-else class="text-sm text-amber-600 dark:text-amber-400">
      Single sign-on is not configured. Set <code>OIDC_ISSUER</code> and
      <code>OIDC_AUDIENCE</code> on the server to enable login.
    </p>
  </section>
</template>
