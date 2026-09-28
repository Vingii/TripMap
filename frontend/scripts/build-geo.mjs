#!/usr/bin/env node
/**
 * Regenerates the bundled Natural Earth GeoJSON in src/assets/geo/.
 *
 *   npm run geo:build            # reuse anything already in .geo-cache/
 *   npm run geo:build -- --refresh   # re-download the sources first
 *
 * The output files are committed, so this only needs running when the pinned
 * Natural Earth release or the simplification settings below change.
 *
 * Countries come from the 1:50m layer, which is detailed enough to keep small
 * island states visible. Subdivisions have to come from 1:10m: Natural Earth's
 * 1:50m admin-1 layer only covers nine large countries, so anything coarser
 * would leave most of the world without zones.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import mapshaper from 'mapshaper'

const NE_RELEASE = 'v5.1.2'
const SOURCE_BASE = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NE_RELEASE}/geojson`

const FRONTEND_DIR = dirname(dirname(fileURLToPath(import.meta.url)))
const CACHE_DIR = join(FRONTEND_DIR, '.geo-cache')
const OUTPUT_DIR = join(FRONTEND_DIR, 'src/assets/geo')

/**
 * Coordinate precision of the output, in degrees. 0.001 is roughly 100 m —
 * far below what a country- or region-level choropleth can resolve, and it
 * strips a large amount of redundant decimals from every coordinate pair.
 */
const PRECISION = 0.001

/** Well-formed ISO 3166-2 subdivision code, e.g. `US-CA`. */
const ISO_3166_2 = /^[A-Z]{2}-[A-Z0-9]{1,3}$/

/**
 * Natural Earth leaves ISO_A2_EH at "-99" for a few de-facto states. Nominatim
 * reports the de-jure country for coordinates inside them, so without these
 * the polygon covering that territory could never be matched to a visit.
 * Siachen Glacier is deliberately left uncoded — it is contested between two
 * countries and too small to matter at this scale.
 */
const ADMIN_0_CODE_OVERRIDES = {
  Somaliland: 'SO',
  'N. Cyprus': 'CY',
}

/** Discards Natural Earth's "-99" placeholder. */
function iso(value) {
  return value && value !== '-99' ? value : undefined
}

function admin0Properties(source) {
  const countryCode =
    iso(source.ISO_A2_EH) ?? ADMIN_0_CODE_OVERRIDES[source.NAME]
  return { name: source.NAME_EN, country_code: countryCode }
}

function admin1Properties(source) {
  // Seven features in the source are unnamed remainder polygons with no
  // subdivision code either; there is nothing a zone list could show for them.
  const name = source.name_en || source.name
  if (!name) return null

  return {
    name,
    country_code: iso(source.iso_a2),
    // Natural Earth invents codes like "XK-X01~" where no ISO code exists.
    code: ISO_3166_2.test(source.iso_3166_2 ?? '')
      ? source.iso_3166_2
      : undefined,
  }
}

const LAYERS = [
  {
    source: 'ne_50m_admin_0_countries',
    output: 'admin-0.geojson',
    simplify: '12%',
    properties: admin0Properties,
  },
  {
    source: 'ne_10m_admin_1_states_provinces',
    output: 'admin-1.geojson',
    simplify: '3%',
    properties: admin1Properties,
  },
]

async function download(name, refresh) {
  const cached = join(CACHE_DIR, `${name}.geojson`)
  if (!refresh) {
    try {
      return await readFile(cached, 'utf8')
    } catch {
      // Not cached yet — fall through and fetch it.
    }
  }

  const url = `${SOURCE_BASE}/${name}.geojson`
  process.stdout.write(`  downloading ${url}\n`)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`${url} responded ${response.status}`)
  }

  const body = await response.text()
  await mkdir(CACHE_DIR, { recursive: true })
  await writeFile(cached, body)
  return body
}

/** Drops every property the app does not use, and every undefined value. */
function reduceProperties(features, pick) {
  return features.flatMap((feature) => {
    const properties = pick(feature.properties)
    if (!properties) return []
    return {
      type: 'Feature',
      properties: Object.fromEntries(
        Object.entries(properties).filter(([, value]) => value !== undefined),
      ),
      geometry: feature.geometry,
    }
  })
}

async function buildLayer(layer, refresh) {
  process.stdout.write(`${layer.output}\n`)

  const { features } = JSON.parse(await download(layer.source, refresh))
  const reduced = reduceProperties(features, layer.properties)

  const commands = [
    '-i input.geojson',
    `-simplify visvalingam ${layer.simplify} keep-shapes`,
    '-clean',
    `-o output.geojson precision=${PRECISION}`,
  ].join(' ')
  const output = await mapshaper.applyCommands(commands, {
    'input.geojson': Buffer.from(
      JSON.stringify({ type: 'FeatureCollection', features: reduced }),
    ),
  })

  const built = output['output.geojson']
  await mkdir(OUTPUT_DIR, { recursive: true })
  await writeFile(join(OUTPUT_DIR, layer.output), built)

  verify(layer, JSON.parse(built.toString()))
  const kb = Math.round(built.length / 1024)
  process.stdout.write(
    `  ${features.length} source features -> ${reduced.length} kept, ${kb} kB\n`,
  )
}

/** Guards the invariants the Zone view relies on. */
function verify(layer, collection) {
  const unnamed = collection.features.filter((f) => !f.properties.name).length
  if (unnamed > 0) {
    throw new Error(`${layer.output}: ${unnamed} features have no name`)
  }

  const coded = collection.features.filter(
    (f) => f.properties.country_code,
  ).length
  process.stdout.write(
    `  ${coded}/${collection.features.length} features carry a country code\n`,
  )
}

const refresh = process.argv.includes('--refresh')
for (const layer of LAYERS) {
  await buildLayer(layer, refresh)
}
