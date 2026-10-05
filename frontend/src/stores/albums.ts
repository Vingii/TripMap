import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  addAlbumLocation,
  createAlbum,
  deleteAlbum,
  getAlbum,
  listAlbums,
  removeAlbumLocation,
  updateAlbum,
  type Album,
  type AlbumCreate,
  type AlbumDetail,
  type AlbumUpdate,
} from '../api/albums'

// Strip the location list so a detail response can stand in for a list entry.
function summary(detail: AlbumDetail): Album {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- dropped on purpose
  const { locations, ...album } = detail
  return album
}

// Albums sort newest first, matching the backend's default order.
function byDateDesc(a: Album, b: Album): number {
  return (
    b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)
  )
}

export const useAlbumsStore = defineStore('albums', () => {
  const albums = ref<Album[]>([])
  // The album open in the detail view, with its locations.
  const current = ref<AlbumDetail | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Keep the list entry in step with a fresh detail response.
  function apply(detail: AlbumDetail): AlbumDetail {
    const others = albums.value.filter((a) => a.id !== detail.id)
    albums.value = [...others, summary(detail)].sort(byDateDesc)
    if (current.value?.id === detail.id) current.value = detail
    return detail
  }

  async function fetchAll(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      albums.value = await listAlbums()
    } catch {
      error.value = 'Failed to load albums.'
    } finally {
      loading.value = false
    }
  }

  async function fetchOne(id: string): Promise<void> {
    loading.value = true
    error.value = null
    current.value = null
    try {
      current.value = await getAlbum(id)
    } catch {
      error.value = 'Failed to load album.'
    } finally {
      loading.value = false
    }
  }

  async function create(input: AlbumCreate): Promise<AlbumDetail> {
    return apply(await createAlbum(input))
  }

  async function update(id: string, input: AlbumUpdate): Promise<AlbumDetail> {
    return apply(await updateAlbum(id, input))
  }

  async function remove(id: string): Promise<void> {
    await deleteAlbum(id)
    albums.value = albums.value.filter((a) => a.id !== id)
    if (current.value?.id === id) current.value = null
  }

  async function addLocation(
    albumId: string,
    locationId: string,
  ): Promise<AlbumDetail> {
    return apply(await addAlbumLocation(albumId, locationId))
  }

  async function removeLocation(
    albumId: string,
    locationId: string,
  ): Promise<void> {
    await removeAlbumLocation(albumId, locationId)
    if (current.value?.id === albumId) {
      const locations = current.value.locations.filter(
        (l) => l.id !== locationId,
      )
      current.value = {
        ...current.value,
        locations,
        location_count: locations.length,
      }
    }
    albums.value = albums.value.map((a) =>
      a.id === albumId
        ? { ...a, location_count: Math.max(0, a.location_count - 1) }
        : a,
    )
  }

  return {
    albums,
    current,
    loading,
    error,
    fetchAll,
    fetchOne,
    create,
    update,
    remove,
    addLocation,
    removeLocation,
  }
})
