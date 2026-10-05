<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ProxiedImage from './ProxiedImage.vue'
import { ImmichError, immichAssetImage, type ImmichAsset } from '../api/immich'

// Thumbnail grid for a linked Immich album. Tiles are revealed a page at a
// time and each image loads only as it nears the viewport, so a large album
// never holds up the rest of the page.
const props = defineProps<{
  assets: ImmichAsset[]
  coverAssetId: string | null
  // Browser-facing Immich URL, for opening a photo in Immich.
  immichUrl: string
}>()

const emit = defineEmits<{ 'set-cover': [assetId: string] }>()

const PAGE_SIZE = 60

const shown = ref(PAGE_SIZE)
// Why thumbnails failed, from the first failure. Usually the same cause for
// every tile (e.g. a key without asset.view), so one notice explains them all.
const loadError = ref<string | null>(null)
watch(
  () => props.assets,
  () => {
    shown.value = PAGE_SIZE
    loadError.value = null
  },
)

function onImageError(error: unknown): void {
  loadError.value ??=
    error instanceof ImmichError ? error.message : 'Immich is unavailable.'
}

const visible = computed(() => props.assets.slice(0, shown.value))
const remaining = computed(() => props.assets.length - visible.value.length)
</script>

<template>
  <p
    v-if="assets.length === 0"
    class="text-sm text-slate-600 dark:text-slate-400"
  >
    This Immich album has no photos yet.
  </p>
  <div v-else class="space-y-3">
    <p
      v-if="loadError"
      role="status"
      class="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
    >
      Some photos couldn't be loaded: {{ loadError }}
    </p>
    <ul class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
      <li
        v-for="(asset, index) in visible"
        :key="asset.id"
        class="group relative aspect-square"
      >
        <a
          :href="`${immichUrl}/photos/${asset.id}`"
          target="_blank"
          rel="noopener"
          class="block h-full w-full"
        >
          <proxied-image
            :src="immichAssetImage(asset.id)"
            :alt="`Photo ${index + 1}`"
            class="h-full w-full rounded-md"
            @error="onImageError"
          />
        </a>
        <span
          v-if="asset.type === 'VIDEO'"
          class="pointer-events-none absolute top-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white"
        >
          Video
        </span>
        <span
          v-if="asset.id === coverAssetId"
          class="pointer-events-none absolute right-1 bottom-1 rounded bg-indigo-600 px-1.5 py-0.5 text-xs font-medium text-white"
        >
          Cover
        </span>
        <button
          v-else
          type="button"
          class="absolute right-1 bottom-1 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white opacity-0 group-hover:opacity-100 hover:bg-black/90 focus:opacity-100"
          @click="emit('set-cover', asset.id)"
        >
          Set as cover
        </button>
      </li>
    </ul>
    <button
      v-if="remaining > 0"
      type="button"
      class="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
      @click="shown += PAGE_SIZE"
    >
      Show more ({{ remaining }} left)
    </button>
  </div>
</template>
