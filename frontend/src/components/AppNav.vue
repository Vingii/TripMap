<script setup lang="ts">
import { computed, ref } from 'vue'
import FeedbackForm from './FeedbackForm.vue'
import { useThemeStore } from '../stores/theme'
import { useAuthStore } from '../stores/auth'
import { useChangelogStore } from '../stores/changelog'
import { useConfigStore } from '../stores/config'
import { useSettingsStore } from '../stores/settings'

const theme = useThemeStore()
const auth = useAuthStore()
const settings = useSettingsStore()
// The feedback button only appears when the server has YouTrack configured.
const config = useConfigStore()
const feedbackOpen = ref(false)
const changelog = useChangelogStore()

const userLabel = computed(
  () => auth.user?.display_name || auth.user?.email || '',
)

// Flip light/dark instantly, then persist the choice to the account so it
// sticks across devices (best-effort — the visual change already applied).
function toggleTheme(): void {
  theme.toggle()
  void settings.save({ theme: theme.theme }).catch(() => {})
}
</script>

<template>
  <nav
    class="border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
  >
    <div class="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
      <router-link
        to="/"
        class="text-lg font-semibold text-slate-900 dark:text-slate-100"
      >
        TripMap
      </router-link>
      <ul class="flex gap-4 text-sm">
        <li>
          <router-link
            to="/"
            class="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            active-class="text-slate-900 font-medium dark:text-slate-100"
          >
            Home
          </router-link>
        </li>
        <li>
          <router-link
            to="/map"
            class="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            active-class="text-slate-900 font-medium dark:text-slate-100"
          >
            Map
          </router-link>
        </li>
        <li>
          <router-link
            to="/zones"
            class="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            active-class="text-slate-900 font-medium dark:text-slate-100"
          >
            Zones
          </router-link>
        </li>
        <li>
          <router-link
            to="/albums"
            class="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            active-class="text-slate-900 font-medium dark:text-slate-100"
          >
            Albums
          </router-link>
        </li>
      </ul>
      <div class="ml-auto flex items-center gap-2">
        <button
          type="button"
          class="relative rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          aria-label="Changelog"
          title="Changelog"
          @click="changelog.show()"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7h6m-6 4h4"
            />
          </svg>
        </button>
        <button
          v-if="config.feedbackEnabled"
          type="button"
          class="rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          aria-label="Send feedback"
          title="Send feedback"
          @click="feedbackOpen = true"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M8 10h8M8 14h5M21 12c0 4.42-4.03 8-9 8a9.9 9.9 0 01-4-.83L3 20l1.4-3.73A7.6 7.6 0 013 12c0-4.42 4.03-8 9-8s9 3.58 9 8z"
            />
          </svg>
        </button>
        <router-link
          v-if="userLabel"
          to="/settings"
          class="hidden rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 sm:inline dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          active-class="text-slate-900 font-medium dark:text-slate-100"
        >
          {{ userLabel }}
        </router-link>
        <button
          type="button"
          class="rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          :aria-label="
            theme.isDark ? 'Switch to light theme' : 'Switch to dark theme'
          "
          :aria-pressed="theme.isDark"
          @click="toggleTheme"
        >
          <!-- Sun shown in dark mode (click → light); moon in light mode (click → dark) -->
          <svg
            v-if="theme.isDark"
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="4" />
            <path
              stroke-linecap="round"
              d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"
            />
          </svg>
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
            />
          </svg>
        </button>
        <button
          v-if="!auth.devMode"
          type="button"
          class="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          @click="auth.logout()"
        >
          Sign out
        </button>
      </div>
    </div>
    <feedback-form v-if="feedbackOpen" @close="feedbackOpen = false" />
  </nav>
</template>
