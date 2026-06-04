<script setup lang="ts">
import AppNav from './components/AppNav.vue'
</script>

<template>
  <div class="flex min-h-screen flex-col bg-slate-50 text-slate-900">
    <app-nav />
    <main class="flex flex-1 flex-col">
      <router-view />
    </main>
  </div>
</template>
