import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getChangelogLastSeen, setChangelogLastSeen } from '../api/me'
import {
  changelogEntries,
  entriesAfter,
  type ChangelogEntry,
} from '../changelog'

// The bundled release notes plus the signed-in user's "seen" marker, which
// lives on the backend so it follows the user across devices.
//
// `load()` runs after sign-in. A user with no marker yet (or one pointing at an
// entry that no longer exists) is silently marked up to date instead of being
// shown the whole backlog. Closing the dialog marks everything seen.
export const useChangelogStore = defineStore('changelog', () => {
  const entries = ref<ChangelogEntry[]>(changelogEntries)
  const lastSeenId = ref<string | null>(null)
  const loaded = ref(false)
  const open = ref(false)

  const newestId = computed<string | null>(() => entries.value[0]?.id ?? null)

  // Entries added since the marker; empty until loaded.
  const unseen = computed<ChangelogEntry[]>(() =>
    loaded.value ? (entriesAfter(entries.value, lastSeenId.value) ?? []) : [],
  )
  const hasUnseen = computed(() => unseen.value.length > 0)

  async function load(): Promise<void> {
    const { last_seen_entry_id } = await getChangelogLastSeen()
    lastSeenId.value = last_seen_entry_id
    loaded.value = true
    if (entriesAfter(entries.value, last_seen_entry_id) === null) {
      await markAllSeen()
    }
  }

  async function markAllSeen(): Promise<void> {
    const newest = newestId.value
    if (newest === null || newest === lastSeenId.value) return
    // Update locally first so the dialog never re-opens on a failed save; the
    // next sign-in simply retries.
    lastSeenId.value = newest
    await setChangelogLastSeen(newest)
  }

  function show(): void {
    open.value = true
  }

  async function close(): Promise<void> {
    open.value = false
    await markAllSeen()
  }

  // Forget the previous user's marker on sign-out.
  function reset(): void {
    lastSeenId.value = null
    loaded.value = false
    open.value = false
  }

  return {
    entries,
    lastSeenId,
    loaded,
    open,
    newestId,
    unseen,
    hasUnseen,
    load,
    markAllSeen,
    show,
    close,
    reset,
  }
})
