// All HTTP calls live under src/api/ — components and stores import from here.
//
// Immich is reached only through the backend proxy, which adds the user's
// stored API key; the browser never sees the key or talks to Immich directly.

import { apiFetch } from './client'

export interface ImmichAlbum {
  id: string
  name: string
  asset_count: number
  // Immich's own cover for the album; null for an empty album.
  thumbnail_asset_id: string | null
}

export interface ImmichAsset {
  id: string
  // Immich's asset type: 'IMAGE', 'VIDEO', …
  type: string
}

export interface ImmichAlbumDetail extends ImmichAlbum {
  // In Immich's display order.
  assets: ImmichAsset[]
}

export type ImmichImageSize = 'thumbnail' | 'preview'

/**
 * A failed Immich request. `status` tells the cases apart: 404 means the album
 * or asset no longer exists in Immich, 400 that the user has no API key, and
 * 5xx that Immich is unconfigured, unreachable or rejected the key. `message`
 * is the backend's human-readable detail.
 */
export class ImmichError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ImmichError'
    this.status = status
  }

  get notFound(): boolean {
    return this.status === 404
  }
}

async function fail(response: Response): Promise<never> {
  let detail = `Immich request failed (${response.status})`
  try {
    const body = (await response.json()) as unknown
    if (
      typeof body === 'object' &&
      body !== null &&
      'detail' in body &&
      typeof body.detail === 'string'
    ) {
      detail = body.detail
    }
  } catch {
    // Not JSON — keep the generic message.
  }
  throw new ImmichError(response.status, detail)
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) return fail(response)
  return (await response.json()) as T
}

export async function searchImmichAlbums(
  query: string,
  signal?: AbortSignal,
): Promise<ImmichAlbum[]> {
  const params = new URLSearchParams({ q: query })
  return json<ImmichAlbum[]>(
    await apiFetch(`/api/immich/albums?${params.toString()}`, { signal }),
  )
}

export async function getImmichAlbum(id: string): Promise<ImmichAlbumDetail> {
  return json<ImmichAlbumDetail>(
    await apiFetch(`/api/immich/albums/${encodeURIComponent(id)}`),
  )
}

// Image source for an asset thumbnail (load it with `loadImage`). The backend
// marks these cacheable, since an asset's thumbnail never changes.
export function immichAssetImage(
  assetId: string,
  size: ImmichImageSize = 'thumbnail',
): string {
  return `/api/immich/assets/${encodeURIComponent(assetId)}/thumbnail?size=${size}`
}

/**
 * Fetch an image source produced by `immichAssetImage` / `albumCoverImage`.
 *
 * Proxied images need the bearer token, which a plain `<img src>` cannot send,
 * so they are fetched here and shown through an object URL instead.
 */
export async function loadImage(
  src: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await apiFetch(src, { signal })
  if (!response.ok) return fail(response)
  return response.blob()
}

// Where to open an album in the Immich web UI.
export function immichAlbumUrl(immichUrl: string, albumId: string): string {
  return `${immichUrl}/albums/${encodeURIComponent(albumId)}`
}
