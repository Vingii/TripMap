<script setup lang="ts">
import { computed } from 'vue'
import { zoneCountLabel, type ZoneInfo } from '../stores/zones'

const props = defineProps<{ zone: ZoneInfo }>()

const hint = computed<string | null>(() => {
  if (!props.zone.clickable) return null
  return props.zone.level === 'country'
    ? 'Click to show regions'
    : 'Click to show the whole country'
})
</script>

<template>
  <div
    class="w-64 rounded-lg border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-800"
  >
    <h3
      class="truncate font-semibold text-slate-900 dark:text-slate-100"
      :title="zone.name"
    >
      {{ zone.name }}
    </h3>
    <p class="text-sm text-slate-600 dark:text-slate-300">
      {{ zoneCountLabel(zone) }}
    </p>
    <p v-if="hint" class="mt-1 text-xs text-slate-500 dark:text-slate-400">
      {{ hint }}
    </p>
  </div>
</template>
