<script setup lang="ts">
import { useTemplateRef } from 'vue'
import MapCanvas from '../components/MapCanvas.vue'
import LocationSearch from '../components/LocationSearch.vue'
import type { GeocodeResult } from '../api/geocode'

const mapRef = useTemplateRef<InstanceType<typeof MapCanvas>>('map')

function goTo(place: GeocodeResult): void {
  mapRef.value?.flyTo(place.lat, place.lng)
}
</script>

<template>
  <div class="relative h-full w-full">
    <map-canvas ref="map" />
    <div class="absolute top-4 left-4 z-[1000]">
      <location-search @select="goTo" />
    </div>
  </div>
</template>
