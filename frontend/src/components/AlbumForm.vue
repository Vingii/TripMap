<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AlbumCreate, DatePrecision } from '../api/albums'

const props = defineProps<{
  title: string
  // Seed values when editing; omitted when creating.
  initial?: AlbumCreate
  submitLabel?: string
}>()

const emit = defineEmits<{
  submit: [payload: AlbumCreate]
  cancel: []
}>()

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const today = new Date().toISOString().slice(0, 10)
const seedDate = props.initial?.date ?? today
const [seedYear, seedMonth] = seedDate.split('-').map(Number)

const name = ref(props.initial?.name ?? '')
const description = ref(props.initial?.description ?? '')
const immichAlbumId = ref(props.initial?.immich_album_id ?? '')
const precision = ref<DatePrecision>(props.initial?.date_precision ?? 'day')
// Day precision edits the full date; month/year edit the parts they show.
const day = ref(seedDate)
const month = ref(seedMonth)
const year = ref<number | null>(seedYear)

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// The ISO date to send, or null while the fields don't form one. Coarser
// precisions pin the hidden parts to the first of the period.
const isoDate = computed<string | null>(() => {
  if (precision.value === 'day') return day.value || null
  const y = year.value
  if (y === null || !Number.isInteger(y) || y < 1 || y > 9999) return null
  const m = precision.value === 'month' ? month.value : 1
  return `${String(y).padStart(4, '0')}-${pad(m)}-01`
})

// Switching precision carries the date over so nothing typed is lost.
function setPrecision(next: DatePrecision): void {
  const current = isoDate.value
  if (current) {
    const [y, m] = current.split('-').map(Number)
    year.value = y
    month.value = m
    if (next === 'day' && precision.value !== 'day') day.value = current
  }
  precision.value = next
}

function parseYear(event: Event): number | null {
  const raw = (event.target as HTMLInputElement).value
  return raw === '' ? null : Number(raw)
}

const valid = computed(
  () => name.value.trim().length > 0 && isoDate.value !== null,
)

function save(): void {
  if (!valid.value || isoDate.value === null) return
  emit('submit', {
    name: name.value.trim(),
    description: description.value.trim() || null,
    date: isoDate.value,
    date_precision: precision.value,
    immich_album_id: immichAlbumId.value.trim() || null,
  })
}

// Width is left to each use: the date row lays its controls out side by side.
const fieldClass =
  'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:ring-2 focus:ring-slate-200 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-600'
const inputClass = `${fieldClass} w-full`
const labelClass = 'text-sm font-medium text-slate-700 dark:text-slate-300'
</script>

<template>
  <div
    class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4"
    @click.self="emit('cancel')"
    @keydown.escape="emit('cancel')"
  >
    <form
      class="w-full max-w-md space-y-4 rounded-lg bg-white p-6 shadow-xl dark:bg-slate-800"
      @submit.prevent="save"
    >
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {{ title }}
      </h2>

      <label class="block space-y-1">
        <span :class="labelClass">Name</span>
        <input
          v-model="name"
          type="text"
          autofocus
          maxlength="255"
          placeholder="e.g. Italy"
          :class="inputClass"
        />
      </label>

      <label class="block space-y-1">
        <span :class="labelClass">Description</span>
        <textarea
          v-model="description"
          rows="2"
          placeholder="Optional"
          :class="inputClass"
        />
      </label>

      <fieldset class="space-y-1">
        <legend :class="labelClass">Date</legend>
        <div class="flex gap-2">
          <select
            :value="precision"
            aria-label="Date precision"
            :class="[fieldClass, 'w-28 shrink-0']"
            @change="
              setPrecision(
                ($event.target as HTMLSelectElement).value as DatePrecision,
              )
            "
          >
            <option value="day">Day</option>
            <option value="month">Month</option>
            <option value="year">Year</option>
          </select>
          <input
            v-if="precision === 'day'"
            v-model="day"
            type="date"
            aria-label="Date"
            :class="[fieldClass, 'min-w-0 flex-1']"
          />
          <template v-else>
            <select
              v-if="precision === 'month'"
              v-model.number="month"
              aria-label="Month"
              :class="[fieldClass, 'min-w-0 flex-1']"
            >
              <option
                v-for="(monthName, index) in MONTH_NAMES"
                :key="monthName"
                :value="index + 1"
              >
                {{ monthName }}
              </option>
            </select>
            <input
              :value="year"
              type="number"
              min="1"
              max="9999"
              step="1"
              aria-label="Year"
              :class="[fieldClass, 'min-w-0 flex-1']"
              @input="year = parseYear($event)"
            />
          </template>
        </div>
      </fieldset>

      <label class="block space-y-1">
        <span :class="labelClass">Immich album ID</span>
        <input
          v-model="immichAlbumId"
          type="text"
          maxlength="255"
          placeholder="Optional"
          :class="inputClass"
        />
      </label>

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
