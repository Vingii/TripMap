<script setup lang="ts">
import { ref } from 'vue'
import type { Location } from '../api/locations'

defineProps<{ location: Location }>()

const emit = defineEmits<{
  edit: []
  delete: []
  close: []
}>()

const confirming = ref(false)
</script>

<template>
  <div
    class="w-64 rounded-lg border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-800"
  >
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <h3
          class="truncate font-semibold text-slate-900 dark:text-slate-100"
          :title="location.name"
        >
          {{ location.name }}
        </h3>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          {{ location.lat.toFixed(4) }}, {{ location.lng.toFixed(4) }}
          <span v-if="location.country_code">
            · {{ location.country_code }}</span
          >
        </p>
      </div>
      <button
        type="button"
        aria-label="Close"
        class="-mt-1 -mr-1 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        @click="emit('close')"
      >
        ✕
      </button>
    </div>

    <div v-if="!confirming" class="mt-3 flex gap-2">
      <button
        type="button"
        class="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
        @click="emit('edit')"
      >
        Edit
      </button>
      <button
        type="button"
        class="flex-1 rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
        @click="confirming = true"
      >
        Delete
      </button>
    </div>

    <div v-else class="mt-3 space-y-2">
      <p class="text-sm text-slate-700 dark:text-slate-300">
        Delete “{{ location.name }}”? This cannot be undone.
      </p>
      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          @click="confirming = false"
        >
          Cancel
        </button>
        <button
          type="button"
          class="flex-1 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          @click="emit('delete')"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
</template>
