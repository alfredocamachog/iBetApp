import type { FieldKind, Game } from '../../api/espn'

/**
 * Una posición del balón/disco en las coordenadas SVG de la cancha de cada deporte.
 * `to` es un segundo tramo del movimiento (tiro → portería, jugada → yarda final, bateo → destino).
 */
export interface TrackPoint {
  id: string
  x: number
  y: number
  to?: { x: number; y: number }
  team?: string
  label: string
  time?: string
  kind: 'move' | 'shot' | 'goal' | 'set'
}

const sideOf = (game: Game, teamId?: string, teamName?: string) => {
  if (teamId) return teamId === game.home.id ? 'home' : teamId === game.away.id ? 'away' : undefined
  if (teamName) {
    const n = teamName.toLowerCase()
    if ([game.home.name, game.home.short].some((x) => x?.toLowerCase() === n)) return 'home'
    if ([game.away.name, game.away.short].some((x) => x?.toLowerCase() === n)) return 'away'
  }
  return undefined
}
const idOf = (game: Game, s?: 'home' | 'away') => (s === 'home' ? game.home.id : s === 'away' ? game.away.id : undefined)

/* ------------------------------ Fútbol (105 x 68) ------------------------------ */
// Las posiciones vienen relativas al equipo de la jugada, que ataca hacia X=100.
// En el dibujo el local ataca a la derecha y el visitante a la izquierda.
function soccerXY(home: boolean, X: number, Y: number) {
  return home ? { x: X * 1.05, y: (100 - Y) * 0.68 } : { x: (100 - X) * 1.05, y: Y * 0.68 }
}

function soccerTrack(game: Game, summary: any): TrackPoint[] {
  const src: any[] = (summary.commentary || []).map((c: any) => c.play && { ...c.play, text: c.text, ctime: c.time?.displayValue })
  const plays = src.filter(Boolean).length ? src.filter(Boolean) : summary.keyEvents || []
  const out: TrackPoint[] = []
  for (const p of plays) {
    const t = p.type?.type || ''
    const label = p.text || p.type?.text
    const time = p.ctime || p.clock?.displayValue
    if (t === 'kickoff' || /half-?begins|second-half|start-2nd/.test(t)) {
      out.push({ id: p.id, x: 52.5, y: 34, label, time, kind: 'set' })
      continue
    }
    if (p.fieldPositionX === undefined) continue
    const side = sideOf(game, p.team?.id, p.team?.displayName)
    if (!side) continue
    const home = side === 'home'
    const a = soccerXY(home, p.fieldPositionX, p.fieldPositionY)
    let to: TrackPoint['to']
    if (p.fieldPosition2X !== undefined && p.fieldPosition2X > 0) to = soccerXY(home, p.fieldPosition2X, p.fieldPosition2Y ?? 50)
    else if (t === 'goal' || t.startsWith('shot')) to = soccerXY(home, 100, p.goalPositionY ?? 50)
    out.push({
      id: p.id, ...a, to, team: idOf(game, side), label, time,
      kind: p.scoringPlay || t === 'goal' ? 'goal' : t.startsWith('shot') ? 'shot' : t === 'corner-awarded' || t === 'foul' ? 'set' : 'move',
    })
  }
  return out
}

/* ------------------------------ Básquet (94 x 50) ------------------------------ */
// Coordenadas de media cancha (x 0-50 a lo ancho, y = distancia a la línea de fondo).
// El local ataca la canasta derecha.
const RIM = { home: { x: 88.75, y: 25 }, away: { x: 5.25, y: 25 } }
function bbXY(attHome: boolean, c: { x: number; y: number }) {
  return attHome ? { x: 94 - c.y, y: c.x } : { x: c.y, y: 50 - c.x }
}
function basketballTrack(game: Game, summary: any): TrackPoint[] {
  const out: TrackPoint[] = []
  for (const p of summary.plays || []) {
    const side = sideOf(game, p.team?.id)
    if (!side) continue
    const type = p.type?.text || ''
    const time = `${p.period?.displayValue ?? ''} ${p.clock?.displayValue ?? ''}`.trim()
    const valid = p.coordinate && p.coordinate.x >= 0 && p.coordinate.x <= 50 && p.coordinate.y >= 0 && p.coordinate.y <= 47
    // ¿A qué canasta corresponde la coordenada?
    const attHome = /Defensive Rebound/i.test(type) ? side !== 'home' : side === 'home'
    const rim = attHome ? RIM.home : RIM.away
    if (/Free Throw/i.test(type)) {
      const ft = { x: attHome ? 75 : 19, y: 25 }
      out.push({ id: p.id, ...ft, to: rim, team: idOf(game, side), label: p.text, time, kind: p.scoringPlay ? 'goal' : 'shot' })
      continue
    }
    if (!valid) continue
    const a = bbXY(attHome, p.coordinate)
    out.push({
      id: p.id, ...a, to: p.shootingPlay ? rim : undefined, team: idOf(game, side), label: p.text, time,
      kind: p.scoringPlay ? 'goal' : p.shootingPlay ? 'shot' : 'move',
    })
  }
  return out
}

/* --------------------------- Americano (120 x 53.3) --------------------------- */
// Zona de anotación del local a la izquierda (yarda 0). Cada equipo ataca la del rival.
function nflX(game: Game, teamId: string | undefined, yardsToEndzone: number) {
  const yd = teamId === game.home.id ? 100 - yardsToEndzone : yardsToEndzone
  return 10 + Math.max(-9, Math.min(109, yd))
}
function footballTrack(game: Game, summary: any): TrackPoint[] {
  const drives = [...(summary.drives?.previous || []), ...(summary.drives?.current ? [summary.drives.current] : [])]
  const seen = new Set<string>()
  const out: TrackPoint[] = []
  for (const d of drives)
    for (const p of d.plays || []) {
      if (seen.has(p.id)) continue
      seen.add(p.id)
      const s = p.start
      if (s?.yardsToEndzone === undefined || !s.team?.id) continue
      const text: string = p.text || ''
      const offHome = s.team.id === game.home.id
      // Dirección del pase/carrera para darle anchura al movimiento
      const lane = /\bleft\b/i.test(text) ? -1 : /\bright\b/i.test(text) ? 1 : 0
      const y2 = 26.65 + lane * (offHome ? -13 : 13)
      const x = nflX(game, s.team.id, s.yardsToEndzone)
      const e = p.end
      let toX = e?.yardsToEndzone !== undefined && e.team?.id ? nflX(game, e.team.id, e.yardsToEndzone) : x
      if (p.scoringPlay && /touchdown/i.test(text)) toX = offHome ? 115 : 5
      out.push({
        id: p.id, x, y: 26.65, to: { x: toX, y: y2 }, team: s.team.id, label: text,
        time: `Q${p.period?.number ?? ''} ${p.clock?.displayValue ?? ''}`, kind: p.scoringPlay ? 'goal' : 'move',
      })
    }
  return out
}

/* ------------------------------ Hockey (200 x 85) ------------------------------ */
// Los equipos cambian de lado cada periodo; normalizamos para que el local ataque a la derecha.
function hockeyTrack(game: Game, summary: any): TrackPoint[] {
  const plays: any[] = summary.plays || []
  const flip: Record<number, number> = {}
  const per = new Map<number, number[]>()
  plays.forEach((p) => {
    if (!p.shootingPlay || !p.coordinate || Math.abs(p.coordinate.x) > 100) return
    const s = sideOf(game, p.team?.id)
    if (!s) return
    const k = p.period?.number ?? 0
    per.set(k, [...(per.get(k) || []), s === 'home' ? p.coordinate.x : -p.coordinate.x])
  })
  per.forEach((xs, k) => (flip[k] = xs.reduce((a, b) => a + b, 0) >= 0 ? 1 : -1))
  const out: TrackPoint[] = []
  for (const p of plays) {
    const c = p.coordinate
    if (!c || Math.abs(c.x) > 100 || Math.abs(c.y) > 42.5) continue
    const f = flip[p.period?.number ?? 0] ?? 1
    const pt = { x: 100 + c.x * f, y: 42.5 - c.y * f }
    const side = sideOf(game, p.team?.id)
    const attRight = side === 'home'
    out.push({
      id: p.id, ...pt,
      to: p.shootingPlay && side ? { x: attRight ? 189 : 11, y: 42.5 } : undefined,
      team: p.team?.id, label: p.text, time: `${p.period?.displayValue ?? ''} ${p.clock?.displayValue ?? ''}`.trim(),
      kind: p.scoringPlay ? 'goal' : p.shootingPlay ? 'shot' : /Face/i.test(p.type?.text) ? 'set' : 'move',
    })
  }
  return out
}

/* ------------------------------ Béisbol (200 x 200) ------------------------------ */
// Coordenadas tipo Gameday: home ≈ (125, 200), ~2.3 pies por unidad. Home en el SVG = (100, 185).
export const HOME_PLATE = { x: 100, y: 185 }
const mlbXY = (c: { x: number; y: number }) => ({ x: 100 + (c.x - 125) * 0.96, y: 185 - (200 - c.y) * 0.96 })
function baseballTrack(game: Game, summary: any): TrackPoint[] {
  const out: TrackPoint[] = []
  for (const p of summary.plays || []) {
    if (!p.hitCoordinate || p.type?.text === 'End Batter/Pitcher' || p.type?.text === 'Play Result') continue
    out.push({
      id: p.id, ...HOME_PLATE, to: mlbXY(p.hitCoordinate), team: p.team?.id ?? idOf(game, p.period?.type === 'Top' ? 'away' : 'home'),
      label: `${p.type?.text ?? ''}${p.pitchVelocity ? ` · ${p.pitchVelocity} mph` : ''}`,
      time: p.period?.displayValue, kind: p.scoringPlay ? 'goal' : 'shot',
    })
  }
  return out
}

export function buildTrack(kind: FieldKind, game: Game, summary: any): TrackPoint[] {
  try {
    const fn = ({ soccer: soccerTrack, basketball: basketballTrack, football: footballTrack, hockey: hockeyTrack, baseball: baseballTrack } as Record<string, typeof soccerTrack>)[kind]
    return fn ? fn(game, summary) : []
  } catch {
    return []
  }
}
