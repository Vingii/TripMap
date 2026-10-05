<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  ImmichError,
  searchImmichAlbums,
  type ImmichAlbum,
} from '../api/immich'

// Links a TripMap album to an Immich album: a search box whose dropdown lists
// matching Immich albums as the user types, or — once linked — the linked
// album's name with Change / Unlink actions.
const props = defineProps<{
  // The linked Immich album ID (v-model).
  modelValue: string | null
  // The linked album's name, when the parent already knows it.
  name?: string | null
}>()

const emit = defineEmits<{ 'update:modelValue': [id: string | null] }>()

const DEBOUNCE_MS = 300

const query = ref('')
const results = ref<ImmichAlbum[]>([])
const open = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)
const linkedName = ref<string | null>(props.name ?? null)
// Showing the search box rather than the linked album.
const searching = ref(props.modelValue === null)

let debounce: ReturnType<typeof setTimeout> | undefined
let controller: AbortController | undefined

watch(
  () => props.name,
  (name) => {
    if (name) linkedName.value = name
  },
)

function schedule(value: string, delay: number): void {
  clearTimeout(debounce)
  controller?.abort()
  loading.value = true
  debounce = setTimeout(() => {
    void run(value)
  }, delay)
}

watch(query, (value) => schedule(value, DEBOUNCE_MS))

async function run(value: string): Promise<void> {
  const current = new AbortController()
  controller = current
  error.value = null
  try {
    results.value = await searchImmichAlbums(value.trim(), current.signal)
  } catch (e) {
    if (current.signal.aborted) return
    results.value = []
    error.value =
      e instanceof ImmichError ? e.message : 'Immich is unavailable right now.'
  } finally {
    if (!current.signal.aborted) loading.value = false
  }
}

// Focusing an untouched box lists every album, so the user can browse.
function onFocus(): void {
  open.value = true
  if (results.value.length === 0 && !loading.value) schedule(query.value, 0)
}

function onEscape(event: KeyboardEvent): void {
  if (!open.value) return
  // Close just the dropdown, not the dialog around it.
  event.stopPropagation()
  open.value = false
}

function select(album: ImmichAlbum): void {
  emit('update:modelValue', album.id)
  linkedName.value = album.name
  searching.value = false
  open.value = false
  query.value = ''
}

function unlink(): void {
  emit('update:modelValue', null)
  linkedName.value = null
  searching.value = true
}

function photoCount(count: number): string {
  return `${count} ${count === 1 ? 'photo' : 'photos'}`
}

const buttonClass =
  'text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
</script>

<template>
  <div
    v-if="!searching && modelValue"
    class="flex items-center justify-between gap-3 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600"
  >
    <span class="truncate text-slate-900 dark:text-slate-100">
      {{ linkedName ?? 'Linked Immich album' }}
    </span>
    <span class="flex shrink-0 gap-3">
      <button type="button" :class="buttonClass" @click="searching = true">
        Change
      </button>
      <button
        type="button"
        class="text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
        @click="unlink"
      >
        Unlink
      </button>
    </span>
  </div>

  <div v-else class="space-y-1">
    <div class="relative" @focusin="onFocus" @focusout="open = false">
      <input
        v-model="query"
        type="search"
        aria-label="Search Immich albums"
        placeholder="Search Immich albums…"
        class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:ring-2 focus:ring-slate-200 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-600"
        @keydown.escape="onEscape"
      />
      <ul
        v-if="open"
        class="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      >
        <li
          v-if="loading && results.length === 0"
          class="px-3 py-2 text-slate-500 dark:text-slate-400"
        >
          Searching…
        </li>
        <li
          v-else-if="error"
          class="px-3 py-2 text-amber-700 dark:text-amber-400"
        >
          {{ error }}
        </li>
        <li
          v-else-if="results.length === 0"
          class="px-3 py-2 text-slate-500 dark:text-slate-400"
        >
          No matching albums.
        </li>
        <li
          v-for="album in results"
          :key="album.id"
          class="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700"
          @mousedown.prevent="select(album)"
        >
          <span class="truncate">{{ album.name }}</span>
          <span
            class="shrink-0 text-xs whitespace-nowrap text-slate-500 dark:text-slate-400"
          >
            {{ photoCount(album.asset_count) }}
          </span>
        </li>
      </ul>
    </div>
    <button
      v-if="modelValue"
      type="button"
      :class="buttonClass"
      @click="searching = false"
    >
      Keep {{ linkedName ?? 'the current album' }}
    </button>
  </div>
</template>
