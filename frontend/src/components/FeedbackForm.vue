<script setup lang="ts">
import { computed, ref } from 'vue'
import { FeedbackError, submitFeedback } from '../api/feedback'

const emit = defineEmits<{
  close: []
}>()

const message = ref('')
const attachment = ref<File | null>(null)
const sending = ref(false)
const error = ref<string | null>(null)
// Set once the backend has filed the issue; the form is replaced by a
// confirmation.
const issueId = ref<string | null>(null)

const valid = computed(() => message.value.trim().length > 0)

function pickFile(event: Event): void {
  attachment.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

async function send(): Promise<void> {
  if (!valid.value || sending.value) return
  sending.value = true
  error.value = null
  try {
    const result = await submitFeedback(message.value.trim(), attachment.value)
    issueId.value = result.issue_id
  } catch (err) {
    error.value =
      err instanceof FeedbackError
        ? err.message
        : 'Feedback could not be sent. Please try again.'
  } finally {
    sending.value = false
  }
}

const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:ring-2 focus:ring-slate-200 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-600'
const labelClass = 'text-sm font-medium text-slate-700 dark:text-slate-300'
const secondaryButtonClass =
  'rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
const primaryButtonClass =
  'rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white'
</script>

<template>
  <div
    class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4"
    @click.self="emit('close')"
    @keydown.escape="emit('close')"
  >
    <div
      v-if="issueId"
      role="status"
      class="w-full max-w-md space-y-4 rounded-lg bg-white p-6 shadow-xl dark:bg-slate-800"
    >
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Thank you!
      </h2>
      <p class="text-sm text-slate-600 dark:text-slate-300">
        Your feedback was sent as {{ issueId }}.
      </p>
      <div class="flex justify-end">
        <button
          type="button"
          autofocus
          :class="primaryButtonClass"
          @click="emit('close')"
        >
          Close
        </button>
      </div>
    </div>

    <form
      v-else
      class="w-full max-w-md space-y-4 rounded-lg bg-white p-6 shadow-xl dark:bg-slate-800"
      @submit.prevent="send"
    >
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Send feedback
      </h2>

      <label class="block space-y-1">
        <span :class="labelClass">Message</span>
        <textarea
          v-model="message"
          rows="5"
          autofocus
          maxlength="10000"
          placeholder="What's working, what isn't, what you'd like to see…"
          :class="inputClass"
        />
      </label>

      <label class="block space-y-1">
        <span :class="labelClass">Attachment</span>
        <input
          type="file"
          class="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200 dark:text-slate-300 dark:file:bg-slate-700 dark:file:text-slate-200 dark:hover:file:bg-slate-600"
          @change="pickFile"
        />
        <span class="text-xs text-slate-500 dark:text-slate-400">
          Optional — e.g. a screenshot.
        </span>
      </label>

      <p
        v-if="error"
        role="alert"
        class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/40 dark:text-red-200"
      >
        {{ error }}
      </p>

      <div class="flex justify-end gap-2 pt-2">
        <button
          type="button"
          :class="secondaryButtonClass"
          @click="emit('close')"
        >
          Cancel
        </button>
        <button
          type="submit"
          :disabled="!valid || sending"
          :class="primaryButtonClass"
        >
          {{ sending ? 'Sending…' : 'Send' }}
        </button>
      </div>
    </form>
  </div>
</template>
