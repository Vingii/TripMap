import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getClientConfig, type ClientConfig } from '../api/config'

// Holds the backend's runtime configuration (`GET /api/config`) for components
// that need it after startup — currently the flat map, which builds Mapy.com
// tile URLs from a key that only exists in the backend's environment.
// `load()` is idempotent: concurrent callers share one in-flight request and
// later callers reuse the cached result.
export const useConfigStore = defineStore('config', () => {
  const config = ref<ClientConfig | null>(null)
  let pending: Promise<void> | null = null

  // Empty when the backend has no MAPY_API_KEY, which is the signal to hide
  // the Mapy.com base layer altogether.
  const mapyApiKey = computed<string>(() => config.value?.mapy_api_key ?? '')

  async function load(): Promise<void> {
    if (config.value) return
    // A failed fetch leaves `config` null and clears `pending`, so a later
    // call retries rather than caching the failure forever.
    pending ??= getClientConfig()
      .then((loaded) => {
        config.value = loaded
      })
      .finally(() => {
        pending = null
      })
    await pending
  }

  return { config, mapyApiKey, load }
})
