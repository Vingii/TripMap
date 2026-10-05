<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AlbumForm from '../components/AlbumForm.vue'
import AlbumMiniMap from '../components/AlbumMiniMap.vue'
import ImmichPhotoGrid from '../components/ImmichPhotoGrid.vue'
import ProxiedImage from '../components/ProxiedImage.vue'
import { useAlbumsStore } from '../stores/albums'
import { useConfigStore } from '../stores/config'
import { useLocationsStore } from '../stores/locations'
import { formatAlbumDate } from '../utils/albumDate'
import type { AlbumCreate } from '../api/albums'
import {
  getImmichAlbum,
  ImmichError,
  immichAlbumUrl,
  immichAssetImage,
  type ImmichAlbumDetail,
} from '../api/immich'

const props = defineProps<{ id: string }>()

const store = useAlbumsStore()
const locationsStore = useLocationsStore()
const configStore = useConfigStore()
const router = useRouter()

const editing = ref(false)
const actionError = ref<string | null>(null)
const query = ref('')

// How many matches the add-location picker lists at once.
const PICKER_LIMIT = 8

const album = computed(() =>
  store.current?.id === props.id ? store.current : null,
)

watch(
  () => props.id,
  (id) => {
    actionError.value = null
    void store.fetchOne(id)
  },
  { immediate: true },
)

// The linked Immich album loads on its own, after the album itself, so a slow
// or unreachable Immich never holds up the rest of the page.
type ImmichState = 'idle' | 'loading' | 'ready' | 'not-found' | 'error'
const immichAlbum = ref<ImmichAlbumDetail | null>(null)
const immichState = ref<ImmichState>('idle')
const immichError = ref<string | null>(null)
let immichRequest = 0

async function loadImmich(immichId: string | null): Promise<void> {
  const request = ++immichRequest
  immichAlbum.value = null
  immichError.value = null
  if (!immichId || !configStore.immichUrl) {
    immichState.value = 'idle'
    return
  }
  immichState.value = 'loading'
  try {
    const loaded = await getImmichAlbum(immichId)
    if (request !== immichRequest) return
    immichAlbum.value = loaded
    immichState.value = 'ready'
  } catch (e) {
    if (request !== immichRequest) return
    if (e instanceof ImmichError && e.notFound) {
      immichState.value = 'not-found'
    } else {
      immichState.value = 'error'
      immichError.value =
        e instanceof ImmichError ? e.message : 'Immich is unavailable.'
    }
  }
}

// Reload only when the link itself changes, not on every album update.
watch(
  () => (album.value ? [album.value.id, album.value.immich_album_id] : null),
  (link, previous) => {
    if (link?.[0] === previous?.[0] && link?.[1] === previous?.[1]) return
    void loadImmich(link?.[1] ?? null)
  },
  { immediate: true },
)

// The chosen cover, else the Immich album's own thumbnail.
const coverAssetId = computed(
  () =>
    album.value?.cover_asset_id ??
    immichAlbum.value?.thumbnail_asset_id ??
    null,
)

// The picker needs every location, not just the album's.
if (locationsStore.locations.length === 0) void locationsStore.fetchAll()

const candidates = computed(() => {
  if (!album.value) return []
  const inAlbum = new Set(album.value.locations.map((l) => l.id))
  const needle = query.value.trim().toLowerCase()
  return locationsStore.locations
    .filter((l) => !inAlbum.has(l.id))
    .filter((l) => !needle || l.name.toLowerCase().includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, PICKER_LIMIT)
})

async function run(
  action: () => Promise<unknown>,
  failure: string,
): Promise<boolean> {
  actionError.value = null
  try {
    await action()
    return true
  } catch {
    actionError.value = failure
    return false
  }
}

async function save(payload: AlbumCreate): Promise<void> {
  if (
    await run(() => store.update(props.id, payload), 'Failed to save album.')
  ) {
    editing.value = false
  }
}

async function remove(): Promise<void> {
  if (!album.value) return
  const ok = window.confirm(
    `Delete "${album.value.name}"? Its locations are kept.`,
  )
  if (!ok) return
  if (await run(() => store.remove(props.id), 'Failed to delete album.')) {
    await router.push({ name: 'albums' })
  }
}

async function addLocation(locationId: string): Promise<void> {
  if (
    await run(
      () => store.addLocation(props.id, locationId),
      'Failed to add location.',
    )
  ) {
    query.value = ''
  }
}

function setCover(assetId: string): void {
  void run(
    () => store.update(props.id, { cover_asset_id: assetId }),
    'Failed to set the cover photo.',
  )
}

function unlinkImmich(): void {
  void run(
    () => store.update(props.id, { immich_album_id: null }),
    'Failed to unlink the Immich album.',
  )
}

function removeLocation(locationId: string): void {
  void run(
    () => store.removeLocation(props.id, locationId),
    'Failed to remove location.',
  )
}
</script>

<template>
  <section class="mx-auto w-full max-w-5xl space-y-6 px-6 py-8">
    <router-link
      :to="{ name: 'albums' }"
      class="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
    >
      ← All albums
    </router-link>

    <p
      v-if="store.loading && !album"
      class="text-slate-600 dark:text-slate-400"
    >
      Loading…
    </p>
    <p v-else-if="!album" class="text-sm text-red-600 dark:text-red-400">
      {{ store.error ?? 'Album not found.' }}
    </p>

    <template v-else>
      <proxied-image
        v-if="immichState === 'ready' && coverAssetId"
        :key="coverAssetId"
        :src="immichAssetImage(coverAssetId, 'preview')"
        :alt="`Cover photo of ${album.name}`"
        eager
        class="h-64 w-full rounded-lg sm:h-80"
      />

      <header class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0 space-y-1">
          <h1 class="text-2xl font-semibold">{{ album.name }}</h1>
          <p class="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            {{ formatAlbumDate(album.date, album.date_precision) }}
            <a
              v-if="album.immich_album_id && configStore.immichUrl"
              :href="
                immichAlbumUrl(configStore.immichUrl, album.immich_album_id)
              "
              target="_blank"
              rel="noopener"
              class="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300 dark:hover:bg-indigo-900"
              title="Open in Immich"
            >
              {{ immichAlbum?.name ?? 'Immich album' }} ↗
            </a>
            <span
              v-else-if="album.immich_album_id"
              class="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
              :title="`Immich album ${album.immich_album_id}`"
            >
              Immich
            </span>
          </p>
          <p
            v-if="album.description"
            class="whitespace-pre-line text-slate-700 dark:text-slate-300"
          >
            {{ album.description }}
          </p>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            @click="editing = true"
          >
            Edit
          </button>
          <button
            type="button"
            class="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
            @click="remove"
          >
            Delete
          </button>
        </div>
      </header>

      <p v-if="actionError" class="text-sm text-red-600 dark:text-red-400">
        {{ actionError }}
      </p>

      <div
        v-if="immichState === 'error'"
        role="status"
        class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
      >
        <span>Couldn't load photos from Immich: {{ immichError }}</span>
        <button
          type="button"
          class="font-medium underline hover:no-underline"
          @click="loadImmich(album.immich_album_id)"
        >
          Retry
        </button>
      </div>
      <div
        v-else-if="immichState === 'not-found'"
        role="status"
        class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
      >
        <span>
          Album not found in Immich — it may have been deleted, or your API key
          can't see it.
        </span>
        <button
          type="button"
          class="font-medium underline hover:no-underline"
          @click="unlinkImmich"
        >
          Unlink
        </button>
      </div>

      <album-mini-map :locations="album.locations" />

      <div class="grid gap-6 md:grid-cols-2">
        <div class="space-y-2">
          <h2 class="text-lg font-semibold">
            Locations ({{ album.location_count }})
          </h2>
          <p
            v-if="album.locations.length === 0"
            class="text-sm text-slate-600 dark:text-slate-400"
          >
            No locations in this album yet.
          </p>
          <ul
            v-else
            class="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800"
          >
            <li
              v-for="location in album.locations"
              :key="location.id"
              class="flex items-center justify-between gap-3 px-4 py-2"
            >
              <span class="truncate text-slate-900 dark:text-slate-100">
                {{ location.name }}
              </span>
              <button
                type="button"
                class="text-sm text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
                :aria-label="`Remove ${location.name} from album`"
                @click="removeLocation(location.id)"
              >
                Remove
              </button>
            </li>
          </ul>
        </div>

        <div class="space-y-2">
          <h2 class="text-lg font-semibold">Add a location</h2>
          <input
            v-model="query"
            type="search"
            placeholder="Filter your locations"
            aria-label="Filter locations to add"
            class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:ring-2 focus:ring-slate-200 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-600"
          />
          <p
            v-if="candidates.length === 0"
            class="text-sm text-slate-600 dark:text-slate-400"
          >
            {{
              locationsStore.locations.length === 0
                ? 'No locations yet — add some on the map first.'
                : 'No matching locations.'
            }}
          </p>
          <ul v-else class="space-y-1">
            <li v-for="location in candidates" :key="location.id">
              <button
                type="button"
                class="w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                @click="addLocation(location.id)"
              >
                + {{ location.name }}
              </button>
            </li>
          </ul>
        </div>
      </div>

      <section
        v-if="immichState === 'loading' || immichAlbum"
        class="space-y-2"
      >
        <h2 class="text-lg font-semibold">
          Photos<template v-if="immichAlbum">
            ({{ immichAlbum.assets.length }})</template
          >
        </h2>
        <p
          v-if="immichState === 'loading'"
          class="text-sm text-slate-600 dark:text-slate-400"
        >
          Loading photos…
        </p>
        <immich-photo-grid
          v-else-if="immichAlbum"
          :assets="immichAlbum.assets"
          :cover-asset-id="coverAssetId"
          :immich-url="configStore.immichUrl"
          @set-cover="setCover"
        />
      </section>

      <album-form
        v-if="editing"
        title="Edit album"
        :initial="album"
        :immich-album-name="immichAlbum?.name"
        @submit="save"
        @cancel="editing = false"
      />
    </template>
  </section>
</template>
