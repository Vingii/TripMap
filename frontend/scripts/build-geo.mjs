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
 * Both outputs are cut from the same 1:10m admin-1 layer: subdivisions are
 * simplified once, and countries are dissolved from those simplified
 * subdivisions. That way a country drawn at country level and its neighbour
 * expanded into subdivisions share exactly the same border arcs — no slivers,
 * no overlaps. (Natural Earth's 1:50m admin-1 layer only covers nine large
 * countries, so it is not an option for the subdivisions.) The small 1:50m
 * admin-0 layer is still fetched, but only for its up-to-date English country
 * names.
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

/** Visvalingam retention applied to the shared admin-1 arcs. */
const SIMPLIFY = '3%'

/**
 * Coordinate precision of the output, in degrees. 0.001 is roughly 100 m —
 * far below what a country- or region-level choropleth can resolve, and it
 * strips a large amount of redundant decimals from every coordinate pair.
 */
const PRECISION = 0.001

/** Well-formed ISO 3166-2 subdivision code, e.g. `US-CA`. */
const ISO_3166_2 = /^[A-Z]{2}-[A-Z0-9]{1,3}$/

/**
 * Natural Earth leaves the ISO code at "-99" for a few de-facto states. Nominatim
 * reports the de-jure country for coordinates inside them, so without these
 * the polygon covering that territory could never be matched to a visit.
 * Siachen Glacier is deliberately left uncoded — it is contested between two
 * countries and too small to matter at this scale.
 */
const COUNTRY_CODE_OVERRIDES = {
  SOL: 'SO', // Somaliland
  CYN: 'CY', // Northern Cyprus
}

/**
 * Natural Earth v5.1.2 predates ISO 3166-2 recodings that Nominatim (via OSM)
 * already follows, so these subdivisions would never match a location. Only
 * one-to-one renames are listed; boundary reforms (e.g. Norway's county
 * mergers) cannot be fixed by recoding and are left as-is.
 */
const SUBDIVISION_CODE_OVERRIDES = {
  // Czechia moved its regions to numeric codes.
  'CZ-PR': 'CZ-10',
  'CZ-ST': 'CZ-20',
  'CZ-JC': 'CZ-31',
  'CZ-PL': 'CZ-32',
  'CZ-KA': 'CZ-41',
  'CZ-US': 'CZ-42',
  'CZ-LI': 'CZ-51',
  'CZ-KR': 'CZ-52',
  'CZ-PA': 'CZ-53',
  'CZ-VY': 'CZ-63',
  'CZ-JM': 'CZ-64',
  'CZ-OL': 'CZ-71',
  'CZ-ZL': 'CZ-72',
  'CZ-MO': 'CZ-80',
  // Poland moved its voivodeships to numeric codes in 2018.
  'PL-DS': 'PL-02',
  'PL-KP': 'PL-04',
  'PL-LU': 'PL-06',
  'PL-LB': 'PL-08',
  'PL-LD': 'PL-10',
  'PL-MA': 'PL-12',
  'PL-MZ': 'PL-14',
  'PL-OP': 'PL-16',
  'PL-PK': 'PL-18',
  'PL-PD': 'PL-20',
  'PL-PM': 'PL-22',
  'PL-SL': 'PL-24',
  'PL-SK': 'PL-26',
  'PL-WN': 'PL-28',
  'PL-WP': 'PL-30',
  'PL-ZP': 'PL-32',
  // Aosta Valley has no provinces, so OSM only tags the region.
  'IT-AO': 'IT-23',
}

/** Discards Natural Earth's "-99" / "-1" placeholders. */
function iso(value) {
  return /^[A-Z]{2}$/.test(value ?? '') ? value : undefined
}

/**
 * English country names keyed by ISO 3166-1 alpha-2. Where the 1:50m layer
 * maps several features to one code (Australia and Ashmore and Cartier
 * Islands), the feature that owns the code outright wins.
 */
function countryNames(admin0) {
  const names = new Map()
  for (const { properties: source } of admin0) {
    const code = iso(source.ISO_A2_EH)
    if (!code) continue
    if (!names.has(code) || source.ISO_A2 === code) {
      names.set(code, source.NAME_EN)
    }
  }
  return names
}

function subdivisionProperties(source, names) {
  // Seven features in the source are unnamed remainder polygons with no
  // subdivision code either; there is nothing a zone list could show for them.
  const name = source.name_en || source.name
  if (!name) return null

  const countryCode =
    iso(source.iso_a2) ?? COUNTRY_CODE_OVERRIDES[source.adm0_a3]
  // Natural Earth invents codes like "XK-X01~" where no ISO code exists.
  const code = ISO_3166_2.test(source.iso_3166_2 ?? '')
    ? (SUBDIVISION_CODE_OVERRIDES[source.iso_3166_2] ?? source.iso_3166_2)
    : undefined

  return {
    name,
    country_code: countryCode,
    code,
    // Build-time only: what countries are dissolved by, and named as. Uncoded
    // territories still get their own polygon so the map has no holes.
    country_key: countryCode ?? source.adm0_a3,
    country_name: (countryCode && names.get(countryCode)) || source.admin,
  }
}

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

async function build(refresh) {
  const admin0 = JSON.parse(
    await download('ne_50m_admin_0_countries', refresh),
  ).features
  const admin1 = JSON.parse(
    await download('ne_10m_admin_1_states_provinces', refresh),
  ).features

  const names = countryNames(admin0)
  const reduced = reduceProperties(admin1, (source) =>
    subdivisionProperties(source, names),
  )

  // Simplify once, then dissolve countries out of the simplified subdivisions
  // so both layers are built from identical arcs.
  const commands = [
    '-i input.geojson name=subdivisions',
    `-simplify visvalingam ${SIMPLIFY} keep-shapes`,
    '-clean',
    '-dissolve country_key copy-fields=country_code,country_name + name=countries',
    '-rename-fields target=countries name=country_name',
    '-filter-fields target=countries name,country_code',
    '-filter-fields target=subdivisions name,country_code,code',
    `-o target=countries admin-0.geojson precision=${PRECISION}`,
    `-o target=subdivisions admin-1.geojson precision=${PRECISION}`,
  ].join(' ')
  const output = await mapshaper.applyCommands(commands, {
    'input.geojson': Buffer.from(
      JSON.stringify({ type: 'FeatureCollection', features: reduced }),
    ),
  })

  await mkdir(OUTPUT_DIR, { recursive: true })
  for (const file of ['admin-0.geojson', 'admin-1.geojson']) {
    const built = output[file]
    await writeFile(join(OUTPUT_DIR, file), built)
    verify(file, JSON.parse(built.toString()))
    const kb = Math.round(built.length / 1024)
    process.stdout.write(`${file}: ${kb} kB\n`)
  }
  process.stdout.write(
    `  ${admin1.length} source subdivisions -> ${reduced.length} kept\n`,
  )
}

/** Guards the invariants the Zone view relies on. */
function verify(file, collection) {
  const unnamed = collection.features.filter((f) => !f.properties.name).length
  if (unnamed > 0) {
    throw new Error(`${file}: ${unnamed} features have no name`)
  }

  const coded = collection.features.filter(
    (f) => f.properties.country_code,
  ).length
  process.stdout.write(
    `  ${coded}/${collection.features.length} features carry a country code\n`,
  )
}

await build(process.argv.includes('--refresh'))
