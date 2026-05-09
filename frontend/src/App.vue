<script setup lang="ts">
import AppNav from './components/AppNav.vue'
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900">
    <app-nav />
    <main class="mx-auto max-w-5xl px-6 py-8">
      <router-view />
    </main>
  </div>
</template>
