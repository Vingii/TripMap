<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AlbumForm from '../components/AlbumForm.vue'
import { useAlbumsStore } from '../stores/albums'
import { formatAlbumDate } from '../utils/albumDate'
import type { AlbumCreate } from '../api/albums'

const store = useAlbumsStore()
const router = useRouter()

const creating = ref(false)
const saveError = ref<string | null>(null)

onMounted(() => {
  void store.fetchAll()
})

async function create(payload: AlbumCreate): Promise<void> {
  saveError.value = null
  try {
    const album = await store.create(payload)
    creating.value = false
    await router.push({ name: 'album', params: { id: album.id } })
  } catch {
    saveError.value = 'Failed to create album.'
  }
}
</script>

<template>
  <section class="mx-auto w-full max-w-5xl space-y-6 px-6 py-8">
    <div class="flex items-center justify-between gap-4">
      <h1 class="text-2xl font-semibold">Albums</h1>
      <button
        type="button"
        class="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        @click="creating = true"
      >
        New album
      </button>
    </div>

    <p v-if="saveError" class="text-sm text-red-600 dark:text-red-400">
      {{ saveError }}
    </p>
    <p v-if="store.error" class="text-sm text-red-600 dark:text-red-400">
      {{ store.error }}
    </p>
    <p
      v-else-if="store.loading && store.albums.length === 0"
      class="text-slate-600 dark:text-slate-400"
    >
      Loading…
    </p>
    <p
      v-else-if="store.albums.length === 0"
      class="text-slate-600 dark:text-slate-400"
    >
      No albums yet. Create one to group the places from a trip.
    </p>

    <ul
      v-else
      class="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800"
    >
      <li v-for="album in store.albums" :key="album.id">
        <router-link
          :to="{ name: 'album', params: { id: album.id } }"
          class="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium text-slate-900 dark:text-slate-100">
              {{ album.name }}
            </p>
            <p class="text-sm text-slate-600 dark:text-slate-400">
              {{ formatAlbumDate(album.date, album.date_precision) }}
            </p>
          </div>
          <span
            v-if="album.immich_album_id"
            class="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
            title="Linked to an Immich album"
          >
            Immich
          </span>
          <span
            class="text-sm whitespace-nowrap text-slate-600 dark:text-slate-400"
          >
            {{ album.location_count }}
            {{ album.location_count === 1 ? 'location' : 'locations' }}
          </span>
        </router-link>
      </li>
    </ul>

    <album-form
      v-if="creating"
      title="New album"
      submit-label="Create"
      @submit="create"
      @cancel="creating = false"
    />
  </section>
</template>
