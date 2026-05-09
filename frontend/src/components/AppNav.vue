<script setup lang="ts"></script>

<template>
  <nav class="border-b border-slate-200 bg-white">
    <div class="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
      <router-link to="/" class="text-lg font-semibold text-slate-900">
        TripMap
      </router-link>
      <ul class="flex gap-4 text-sm">
        <li>
          <router-link
            to="/"
            class="text-slate-600 hover:text-slate-900"
            active-class="text-slate-900 font-medium"
          >
            Home
          </router-link>
        </li>
        <li>
          <router-link
            to="/map"
            class="text-slate-600 hover:text-slate-900"
            active-class="text-slate-900 font-medium"
          >
            Map
          </router-link>
        </li>
        <li>
          <router-link
            to="/albums"
            class="text-slate-600 hover:text-slate-900"
            active-class="text-slate-900 font-medium"
          >
            Albums
          </router-link>
        </li>
      </ul>
    </div>
  </nav>
</template>
