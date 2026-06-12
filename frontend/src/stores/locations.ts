import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  createLocation,
  deleteLocation,
  listLocations,
  updateLocation,
  type Location,
  type LocationCreate,
  type LocationUpdate,
} from '../api/locations'

export const useLocationsStore = defineStore('locations', () => {
  const locations = ref<Location[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      locations.value = await listLocations()
    } catch {
      error.value = 'Failed to load locations.'
    } finally {
      loading.value = false
    }
  }

  async function create(input: LocationCreate): Promise<Location> {
    const created = await createLocation(input)
    locations.value = [...locations.value, created]
    return created
  }

  async function update(id: string, input: LocationUpdate): Promise<Location> {
    const updated = await updateLocation(id, input)
    locations.value = locations.value.map((l) => (l.id === id ? updated : l))
    return updated
  }

  async function remove(id: string): Promise<void> {
    await deleteLocation(id)
    locations.value = locations.value.filter((l) => l.id !== id)
  }

  return { locations, loading, error, fetchAll, create, update, remove }
})
