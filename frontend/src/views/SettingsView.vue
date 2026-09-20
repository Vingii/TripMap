<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useSettingsStore } from '../stores/settings'
import { useConfigStore } from '../stores/config'
import type {
  BaseLayer,
  MapFilter,
  Projection,
  Theme,
  UserSettingsUpdate,
} from '../api/me'

const auth = useAuthStore()
const settings = useSettingsStore()
// Mapy.com is only offered as a base layer when the backend has a key for it.
const config = useConfigStore()

interface FormState {
  theme: Theme
  default_projection: Projection
  default_map_filter: MapFilter
  default_base_layer: BaseLayer
  default_visited: boolean
  // A newly typed Immich key; blank means "leave the stored key untouched".
  immichKey: string
  // Explicit request to remove a previously stored key.
  clearImmich: boolean
}

const form = reactive<FormState>({
  theme: 'system',
  default_projection: 'flat',
  default_map_filter: 'all',
  default_base_layer: 'osm',
  default_visited: true,
  immichKey: '',
  clearImmich: false,
})

// True once the user has stored an Immich key (so we can show a masked hint).
const immichKeySet = ref(false)

type SaveState = 'idle' | 'saving' | 'saved' | 'error'
const saveState = ref<SaveState>('idle')

function seedFromSettings(): void {
  const s = settings.settings
  if (!s) return
  form.theme = s.theme
  form.default_projection = s.default_projection
  form.default_map_filter = s.default_map_filter
  form.default_base_layer = s.default_base_layer
  form.default_visited = s.default_visited
  form.immichKey = ''
  form.clearImmich = false
  immichKeySet.value = s.immich_api_key_set
}

onMounted(async () => {
  // Settings are normally hydrated at login; refresh if we arrived without them.
  if (!settings.settings) {
    try {
      await settings.refresh()
    } catch {
      saveState.value = 'error'
    }
  }
  // Decides whether the base-layer field is shown at all; a failure here just
  // leaves it hidden, same as an unconfigured key.
  void config.load().catch(() => undefined)
  seedFromSettings()
})

async function onSubmit(): Promise<void> {
  saveState.value = 'saving'
  const patch: UserSettingsUpdate = {
    theme: form.theme,
    default_projection: form.default_projection,
    default_map_filter: form.default_map_filter,
    default_base_layer: form.default_base_layer,
    default_visited: form.default_visited,
  }
  // Only touch the Immich key when the user typed a new one or asked to clear it.
  if (form.clearImmich) {
    patch.immich_api_key = ''
  } else if (form.immichKey.trim() !== '') {
    patch.immich_api_key = form.immichKey.trim()
  }

  try {
    await settings.save(patch)
    seedFromSettings()
    saveState.value = 'saved'
  } catch {
    saveState.value = 'error'
  }
}

const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:ring-2 focus:ring-slate-200 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-600'
const labelClass = 'text-sm font-medium text-slate-700 dark:text-slate-300'
</script>

<template>
  <section class="mx-auto w-full max-w-2xl space-y-6 px-6 py-8">
    <h1 class="text-2xl font-semibold">Settings</h1>

    <!-- Read-only profile, sourced from the OIDC identity provider. -->
    <div
      class="space-y-3 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800"
    >
      <h2 class="text-lg font-semibold">Profile</h2>
      <p class="text-xs text-slate-500 dark:text-slate-400">
        Managed by your identity provider.
      </p>
      <div class="grid gap-1">
        <span :class="labelClass">Name</span>
        <span class="text-sm text-slate-900 dark:text-slate-100">
          {{ auth.user?.display_name || '—' }}
        </span>
      </div>
      <div class="grid gap-1">
        <span :class="labelClass">Email</span>
        <span class="text-sm text-slate-900 dark:text-slate-100">
          {{ auth.user?.email || '—' }}
        </span>
      </div>
    </div>

    <form
      class="space-y-5 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800"
      @submit.prevent="onSubmit"
    >
      <h2 class="text-lg font-semibold">Preferences</h2>

      <label class="block space-y-1">
        <span :class="labelClass">Theme</span>
        <select v-model="form.theme" :class="inputClass">
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </label>

      <label class="block space-y-1">
        <span :class="labelClass">Default map view</span>
        <select v-model="form.default_projection" :class="inputClass">
          <option value="flat">Flat</option>
          <option value="globe">Globe</option>
        </select>
      </label>

      <label class="block space-y-1">
        <span :class="labelClass">Default map filter</span>
        <select v-model="form.default_map_filter" :class="inputClass">
          <option value="all">All</option>
          <option value="visited">My visited</option>
        </select>
      </label>

      <!-- Hidden entirely unless the server has a Mapy.com key, in which case
           OpenStreetMap is the only base layer there is to pick. -->
      <label v-if="config.mapyApiKey" class="block space-y-1">
        <span :class="labelClass">Default base map</span>
        <select v-model="form.default_base_layer" :class="inputClass">
          <option value="osm">OpenStreetMap</option>
          <option value="mapy">Mapy.com</option>
        </select>
        <span class="block text-xs text-slate-500 dark:text-slate-400">
          Applies to the flat map; the globe always uses OpenStreetMap.
        </span>
      </label>

      <label class="flex items-center gap-3">
        <input
          v-model="form.default_visited"
          type="checkbox"
          class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700"
        />
        <span :class="labelClass"
          >Mark new locations as visited by default</span
        >
      </label>

      <label class="block space-y-1">
        <span :class="labelClass">Immich API key</span>
        <input
          v-model="form.immichKey"
          type="password"
          autocomplete="off"
          :disabled="form.clearImmich"
          :placeholder="immichKeySet ? '•••••••• (saved)' : 'Not set'"
          :class="inputClass"
        />
        <label
          v-if="immichKeySet"
          class="flex items-center gap-2 pt-1 text-xs text-slate-500 dark:text-slate-400"
        >
          <input v-model="form.clearImmich" type="checkbox" class="h-3 w-3" />
          Remove the saved key
        </label>
      </label>

      <div class="flex items-center gap-3 pt-2">
        <button
          type="submit"
          :disabled="saveState === 'saving'"
          class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {{ saveState === 'saving' ? 'Saving…' : 'Save changes' }}
        </button>
        <span
          v-if="saveState === 'saved'"
          class="text-sm text-green-600 dark:text-green-400"
        >
          Settings saved.
        </span>
        <span
          v-else-if="saveState === 'error'"
          class="text-sm text-red-600 dark:text-red-400"
        >
          Could not save settings. Please try again.
        </span>
      </div>
    </form>
  </section>
</template>
