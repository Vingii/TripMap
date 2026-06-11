<script setup lang="ts">
import { ref, watch } from 'vue'
import { searchPlaces, type GeocodeResult } from '../api/geocode'

const emit = defineEmits<{ select: [place: GeocodeResult] }>()

const DEBOUNCE_MS = 300

const query = ref('')
const results = ref<GeocodeResult[]>([])
const open = ref(false)
const loading = ref(false)
const error = ref(false)

let debounce: ReturnType<typeof setTimeout> | undefined
let controller: AbortController | undefined

watch(query, (value) => {
  clearTimeout(debounce)
  controller?.abort()

  if (!value.trim()) {
    results.value = []
    open.value = false
    loading.value = false
    error.value = false
    return
  }

  loading.value = true
  debounce = setTimeout(() => {
    void run(value)
  }, DEBOUNCE_MS)
})

async function run(value: string): Promise<void> {
  controller = new AbortController()
  error.value = false
  try {
    results.value = await searchPlaces(value, controller.signal)
    open.value = true
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return
    error.value = true
    results.value = []
    open.value = true
  } finally {
    loading.value = false
  }
}

function select(place: GeocodeResult): void {
  emit('select', place)
  query.value = place.name
  open.value = false
}
</script>

<template>
  <div class="relative w-72" @focusout="open = false" @focusin="open = true">
    <input
      v-model="query"
      type="search"
      placeholder="Search for a place…"
      class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:ring-2 focus:ring-slate-200 focus:outline-none"
      @keydown.escape="open = false"
    />
    <ul
      v-if="open && (results.length || error || (!loading && query.trim()))"
      class="absolute z-[1000] mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
    >
      <li v-if="error" class="px-3 py-2 text-slate-500">
        Search is unavailable right now.
      </li>
      <li v-else-if="!results.length" class="px-3 py-2 text-slate-500">
        No matches found.
      </li>
      <li
        v-for="place in results"
        :key="`${place.lat},${place.lng}`"
        class="cursor-pointer truncate px-3 py-2 hover:bg-slate-100"
        @mousedown.prevent="select(place)"
      >
        {{ place.name }}
      </li>
    </ul>
  </div>
</template>
