<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { loadImage } from '../api/immich'

// An image served by the backend's Immich proxy. Those need the bearer token,
// which a plain <img src> cannot send, so the image is fetched through the API
// layer and shown from an object URL. Unless `eager`, nothing is fetched until
// the element nears the viewport, so long grids load as they are scrolled.
const props = defineProps<{
  // From `immichAssetImage` / `albumCoverImage`.
  src: string
  alt: string
  eager?: boolean
}>()

const emit = defineEmits<{ error: [error: unknown] }>()

const root = ref<HTMLElement | null>(null)
const url = ref<string | null>(null)
const failed = ref(false)

let started = false
let observer: IntersectionObserver | undefined
let controller: AbortController | undefined

function release(): void {
  controller?.abort()
  if (url.value) URL.revokeObjectURL(url.value)
  url.value = null
}

async function load(): Promise<void> {
  started = true
  release()
  failed.value = false
  const current = new AbortController()
  controller = current
  try {
    const blob = await loadImage(props.src, current.signal)
    if (current.signal.aborted) return
    url.value = URL.createObjectURL(blob)
  } catch (e) {
    if (current.signal.aborted) return
    failed.value = true
    emit('error', e)
  }
}

onMounted(() => {
  if (props.eager || typeof IntersectionObserver === 'undefined') {
    void load()
    return
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer?.disconnect()
      void load()
    },
    // Start a little ahead of the viewport so tiles are ready when scrolled to.
    { rootMargin: '200px' },
  )
  if (root.value) observer.observe(root.value)
})

watch(
  () => props.src,
  () => {
    if (started) void load()
  },
)

onBeforeUnmount(() => {
  observer?.disconnect()
  release()
})
</script>

<template>
  <div
    ref="root"
    class="overflow-hidden bg-slate-200 dark:bg-slate-700"
    :class="{ 'animate-pulse': !url && !failed }"
  >
    <img v-if="url" :src="url" :alt="alt" class="h-full w-full object-cover" />
    <span v-else-if="failed" class="sr-only"
      >{{ alt }} could not be loaded</span
    >
  </div>
</template>
