import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getImmichAlbum,
  ImmichError,
  immichAlbumUrl,
  immichAssetImage,
  loadImage,
  searchImmichAlbums,
} from '../immich'
import { albumCoverImage } from '../albums'

afterEach(() => {
  vi.restoreAllMocks()
})

function mockFetch(response: Partial<Response>): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('immich api', () => {
  it('searchImmichAlbums passes the query through', async () => {
    const albums = [
      { id: 'a1', name: 'Paris', asset_count: 3, thumbnail_asset_id: null },
    ]
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      json: () => Promise.resolve(albums),
    })

    expect(await searchImmichAlbums('par is')).toEqual(albums)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/immich/albums?q=par+is')
  })

  it('surfaces the backend detail and status as an ImmichError', async () => {
    mockFetch({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ detail: 'Not found in Immich' }),
    })

    const error = await getImmichAlbum('gone').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ImmichError)
    expect((error as ImmichError).notFound).toBe(true)
    expect((error as ImmichError).message).toBe('Not found in Immich')
  })

  it('falls back to a generic message when the error body is not JSON', async () => {
    mockFetch({
      ok: false,
      status: 502,
      json: () => Promise.reject(new SyntaxError('bad json')),
    })

    const error = await getImmichAlbum('a1').catch((e: unknown) => e)

    expect((error as ImmichError).status).toBe(502)
    expect((error as ImmichError).notFound).toBe(false)
  })

  it('loadImage fetches a proxied image as a blob', async () => {
    const blob = new Blob(['img'], { type: 'image/jpeg' })
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      blob: () => Promise.resolve(blob),
    })

    expect(await loadImage(immichAssetImage('x1', 'preview'))).toBe(blob)
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/immich/assets/x1/thumbnail?size=preview',
    )
  })

  it('builds cover and Immich web URLs', () => {
    expect(albumCoverImage('alb-1')).toBe(
      '/api/albums/alb-1/cover?size=thumbnail',
    )
    expect(immichAlbumUrl('https://photos.example', 'a1')).toBe(
      'https://photos.example/albums/a1',
    )
  })
})
