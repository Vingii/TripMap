<script setup lang="ts">
import { computed } from 'vue'
import type { ChangelogEntry } from '../changelog'
import { renderMarkdown } from '../changelog/render'

const props = defineProps<{
  // Newest first.
  entries: ChangelogEntry[]
  // Ids of entries added since the user last looked, badged as new.
  unseenIds: string[]
}>()

const emit = defineEmits<{
  close: []
}>()

const rendered = computed(() =>
  props.entries.map((entry) => ({
    ...entry,
    html: renderMarkdown(entry.body),
    isNew: props.unseenIds.includes(entry.id),
  })),
)

function formatDate(iso: string): string {
  // Parse as local midnight so the shown day never shifts with the timezone.
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// Rendered markdown can't carry utility classes, so style its elements from
// the container.
const proseClass =
  'space-y-2 text-sm text-slate-700 dark:text-slate-300 [&_a]:underline [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 dark:[&_code]:bg-slate-700 [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_strong]:text-slate-900 dark:[&_strong]:text-slate-100 [&_ul]:list-disc [&_ul]:pl-5'
</script>

<template>
  <div
    class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4"
    @click.self="emit('close')"
    @keydown.escape="emit('close')"
  >
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="changelog-title"
      class="flex max-h-full w-full max-w-lg flex-col rounded-lg bg-white shadow-xl dark:bg-slate-800"
    >
      <h2
        id="changelog-title"
        class="border-b border-slate-200 px-6 py-4 text-lg font-semibold text-slate-900 dark:border-slate-700 dark:text-slate-100"
      >
        What's new
      </h2>

      <div class="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-4">
        <p
          v-if="rendered.length === 0"
          class="text-sm text-slate-500 dark:text-slate-400"
        >
          Nothing here yet.
        </p>
        <article v-for="entry in rendered" :key="entry.id" class="space-y-2">
          <header class="space-y-0.5">
            <div class="flex items-center gap-2">
              <h3 class="font-semibold text-slate-900 dark:text-slate-100">
                {{ entry.title }}
              </h3>
              <span
                v-if="entry.isNew"
                class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
              >
                New
              </span>
            </div>
            <time
              :datetime="entry.date"
              class="block text-xs text-slate-500 dark:text-slate-400"
            >
              {{ formatDate(entry.date) }}
            </time>
          </header>
          <!-- eslint-disable-next-line vue/no-v-html -- sanitized by renderMarkdown (DOMPurify) -->
          <div :class="proseClass" v-html="entry.html" />
        </article>
      </div>

      <div
        class="flex justify-end border-t border-slate-200 px-6 py-3 dark:border-slate-700"
      >
        <button
          type="button"
          autofocus
          class="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          @click="emit('close')"
        >
          Close
        </button>
      </div>
    </section>
  </div>
</template>
