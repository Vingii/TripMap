import L from 'leaflet'

export const MARKER_COLOR = '#6366f1'

// Teardrop map pin: rounded head, pointed tip at the bottom-centre (24×36, tip
// at 12,36). Visited pins are filled solid; unvisited ones are a hollow outline.
export function pinIcon(visited: boolean): L.DivIcon {
  const fill = visited ? MARKER_COLOR : '#ffffff'
  const stroke = visited ? '#1e293b' : MARKER_COLOR
  const dot = visited ? '#ffffff' : MARKER_COLOR
  const svg = `
    <svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24C24 5.373 18.627 0 12 0Z"
            fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <circle cx="12" cy="12" r="4" fill="${dot}"/>
    </svg>`
  return L.divIcon({
    html: svg,
    className: '', // drop the default white box so only the SVG shows
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    tooltipAnchor: [0, -30],
  })
}
