<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  title: string
  name: string
  lat: number | null
  lng: number | null
  submitLabel?: string
}>()

const emit = defineEmits<{
  submit: [payload: { name: string; lat: number; lng: number }]
  cancel: []
}>()

const name = ref(props.name)
const lat = ref<number | null>(props.lat)
const lng = ref<number | null>(props.lng)

// Re-seed the fields whenever the parent opens the form with different values.
watch(
  () => [props.name, props.lat, props.lng] as const,
  ([n, la, ln]) => {
    name.value = n
    lat.value = la
    lng.value = ln
  },
)

function parseNumber(event: Event): number | null {
  const raw = (event.target as HTMLInputElement).value
  return raw === '' ? null : Number(raw)
}

const valid = computed(
  () =>
    name.value.trim().length > 0 &&
    lat.value !== null &&
    Number.isFinite(lat.value) &&
    lat.value >= -90 &&
    lat.value <= 90 &&
    lng.value !== null &&
    Number.isFinite(lng.value) &&
    lng.value >= -180 &&
    lng.value <= 180,
)

function save(): void {
  if (!valid.value || lat.value === null || lng.value === null) return
  emit('submit', { name: name.value.trim(), lat: lat.value, lng: lng.value })
}
</script>

<template>
  <div
    class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4"
    @click.self="emit('cancel')"
    @keydown.escape="emit('cancel')"
  >
    <form
      class="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow-xl dark:bg-slate-800"
      @submit.prevent="save"
    >
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {{ title }}
      </h2>

      <label class="block space-y-1">
        <span class="text-sm font-medium text-slate-700 dark:text-slate-300">
          Name
        </span>
        <input
          v-model="name"
          type="text"
          autofocus
          placeholder="e.g. Eiffel Tower"
          class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:ring-2 focus:ring-slate-200 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-600"
        />
      </label>

      <div class="flex gap-3">
        <label class="block flex-1 space-y-1">
          <span class="text-sm font-medium text-slate-700 dark:text-slate-300">
            Latitude
          </span>
          <input
            :value="lat"
            type="number"
            step="any"
            min="-90"
            max="90"
            class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:ring-2 focus:ring-slate-200 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-600"
            @input="lat = parseNumber($event)"
          />
        </label>
        <label class="block flex-1 space-y-1">
          <span class="text-sm font-medium text-slate-700 dark:text-slate-300">
            Longitude
          </span>
          <input
            :value="lng"
            type="number"
            step="any"
            min="-180"
            max="180"
            class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:ring-2 focus:ring-slate-200 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-600"
            @input="lng = parseNumber($event)"
          />
        </label>
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <button
          type="button"
          class="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          @click="emit('cancel')"
        >
          Cancel
        </button>
        <button
          type="submit"
          :disabled="!valid"
          class="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          {{ submitLabel ?? 'Save' }}
        </button>
      </div>
    </form>
  </div>
</template>
