import type { DatePrecision } from '../api/albums'

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/**
 * Format an album's ISO date at its precision: day → "14 Jul 2024",
 * month → "Jul 2024", year → "2024". Parsed from the string rather than via
 * `Date` so the viewer's timezone can never shift it to a neighbouring day.
 */
export function formatAlbumDate(iso: string, precision: DatePrecision): string {
  const [year, month, day] = iso.split('-').map(Number)
  if (precision === 'year') return String(year)
  const monthName = MONTHS[month - 1]
  if (precision === 'month') return `${monthName} ${year}`
  return `${day} ${monthName} ${year}`
}
