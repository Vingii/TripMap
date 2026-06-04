<script setup lang="ts">
import AppNav from './components/AppNav.vue'
</script>

<template>
  <div class="flex h-screen flex-col bg-slate-50 text-slate-900">
    <app-nav />
    <main class="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <router-view />
    </main>
  </div>
</template>
