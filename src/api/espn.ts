/* Cliente de datos en tiempo real (API pública de ESPN, sin clave, con CORS abierto). */
import { fetchLeagues, getSport, minimalLeague, sportByUid, type League, type SportDef } from './catalog'

export type { FieldKind, League, SportDef } from './catalog'

export const BASE = 'https://site.api.espn.com/apis/site/v2/sports'

/* ---------- Fechas: el calendario es SIEMPRE el día local del usuario ---------- */
export const ymd = (d: Date) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const parseIsoDay = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const sameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
export const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone

/* ---------- Fetch con caché corta y deduplicación de peticiones en curso ---------- */
const inflight = new Map<string, Promise<any>>()
const cache = new Map<string, { t: number; data: any }>()

export async function getJSON(url: string, maxAgeMs = 4000): Promise<any> {
  const hit = cache.get(url)
  if (hit && Date.now() - hit.t < maxAgeMs) return hit.data
  const running = inflight.get(url)
  if (running) return running
  const p = fetch(url, { cache: 'no-store' })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    })
    .then((data) => {
      cache.set(url, { t: Date.now(), data })
      if (cache.size > 400) cache.delete(cache.keys().next().value!)
      return data
    })
    .finally(() => inflight.delete(url))
  inflight.set(url, p)
  return p
}

/** Ejecuta tareas con concurrencia limitada (para no saturar al proveedor). */
async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = new Array(items.length)
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++
        try {
          out[k] = { status: 'fulfilled', value: await fn(items[k]) }
        } catch (reason) {
          out[k] = { status: 'rejected', reason }
        }
      }
    }),
  )
  return out
}

/* ---------- Modelo normalizado ---------- */
export type GameState = 'pre' | 'in' | 'post'

export interface TeamSide {
  id: string
  name: string
  short: string
  abbr: string
  logo?: string
  color: string
  altColor: string
  score?: string
  record?: string
  winner?: boolean
  homeAway: 'home' | 'away'
  linescores?: string[]
  athlete?: boolean
}

export interface LeaderRow {
  pos: string
  name: string
  flag?: string
  score?: string
}

export interface Game {
  id: string // id de navegación (único)
  eventId: string
  kind: 'match' | 'leaderboard'
  sportId: string
  leagueKey: string
  leagueSlug: string
  leagueName: string
  date: Date
  state: GameState
  statusText: string
  clock: string
  period: number
  home: TeamSide
  away: TeamSide
  venue?: string
  broadcast?: string
  situation?: any
  odds?: string
  note?: string
  eventName?: string
  leaders?: LeaderRow[]
}

const EMPTY_SIDE: TeamSide = { id: '', name: '', short: '', abbr: '', color: '#334155', altColor: '#94a3b8', homeAway: 'home' }

function side(c: any, fallbackHA: 'home' | 'away'): TeamSide {
  if (c.athlete || c.type === 'athlete' || c.roster) {
    // individual (athlete) o pareja de dobles (roster)
    const a = c.athlete || {
      id: c.id,
      displayName: c.roster?.displayName,
      shortName: c.roster?.shortDisplayName,
      flag: c.roster?.athletes?.[0]?.flag,
    }
    const name = a.displayName || a.fullName || ''
    return {
      id: a.id || c.id,
      name,
      short: a.shortName || name,
      abbr: name.split(' ').map((w: string) => w[0]).join('').slice(0, 3),
      logo: a.flag?.href || a.headshot?.href,
      color: '#475569',
      altColor: '#94a3b8',
      score: c.score?.displayValue ?? c.score,
      record: c.records?.[0]?.summary,
      winner: c.winner,
      homeAway: c.homeAway || fallbackHA,
      linescores: (c.linescores || []).map((l: any) => String(l.displayValue ?? l.value ?? '') + (l.tiebreak ? `⁽${l.tiebreak}⁾` : '')),
      athlete: true,
    }
  }
  const t = c.team || {}
  return {
    id: t.id,
    name: t.displayName || t.name,
    short: t.shortDisplayName || t.name || t.abbreviation,
    abbr: t.abbreviation,
    logo: t.logo || t.logos?.[0]?.href,
    color: '#' + (t.color || '334155'),
    altColor: '#' + (t.alternateColor || '94a3b8'),
    score: c.score?.displayValue ?? c.score,
    record: c.records?.[0]?.summary ?? c.record?.[0]?.displayValue,
    winner: c.winner,
    homeAway: c.homeAway || fallbackHA,
  }
}

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) || 0)
const colorDist = (a: string, b: string) => {
  const [x, y] = [rgb(a), rgb(b)]
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])
}
/** Si los colores de ambos equipos se parecen, el visitante usa su color alterno (o blanco). */
function contrastTeams(home: TeamSide, away: TeamSide) {
  if (colorDist(home.color, away.color) < 110) {
    away.color = colorDist(home.color, away.altColor) >= 110 ? away.altColor : '#f1f5f9'
  }
}

function baseGame(e: any, comp: any, league: League, id: string): Omit<Game, 'home' | 'away' | 'kind'> {
  const st = comp.status || e.status || {}
  return {
    id,
    eventId: e.id,
    sportId: league.sportId,
    leagueKey: league.key,
    leagueSlug: league.slug,
    leagueName: league.name,
    date: new Date(comp.date || comp.startDate || e.date),
    state: st.type?.state ?? 'pre',
    statusText: st.type?.shortDetail || st.type?.detail || '',
    clock: st.displayClock ?? '',
    period: st.period ?? 0,
    venue: comp.venue?.fullName || e.venue?.displayName,
    broadcast: comp.broadcasts?.flatMap((b: any) => b.names || []).join(', ') || undefined,
    situation: comp.situation,
    odds: comp.odds?.[0]?.details,
    note: comp.notes?.[0]?.headline || comp.type?.text || comp.round?.displayName,
    eventName: e.shortName || e.name,
  }
}

function matchFrom(e: any, comp: any, league: League, id: string, extraNote?: string): Game {
  const cs: any[] = [...(comp.competitors || [])]
  let home: TeamSide, away: TeamSide
  if (cs.some((c) => c.homeAway === 'home')) {
    home = side(cs.find((c) => c.homeAway === 'home'), 'home')
    away = side(cs.find((c) => c.homeAway === 'away') || cs.find((c) => c.homeAway !== 'home') || {}, 'away')
  } else {
    cs.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    away = side(cs[0] || {}, 'away')
    home = side(cs[1] || {}, 'home')
  }
  contrastTeams(home, away)
  const g: Game = { ...baseGame(e, comp, league, id), kind: 'match', home, away }
  if (extraNote) g.note = [...new Set([extraNote, comp.round?.displayName, g.note].filter(Boolean))].join(' · ')
  return g
}

/** Para golf/automovilismo: una tarjeta por evento con el top de la clasificación. */
function leaderboardFrom(e: any, league: League): Game {
  const comps: any[] = e.competitions || []
  const comp =
    comps.find((c) => c.status?.type?.state === 'in' && c.competitors?.length) ||
    [...comps].reverse().find((c) => c.competitors?.length && c.status?.type?.state === 'post') ||
    comps.find((c) => c.competitors?.length) ||
    comps[comps.length - 1] ||
    {}
  const leaders: LeaderRow[] = [...(comp.competitors || [])]
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .slice(0, 5)
    .map((c, i) => ({
      pos: String(c.status?.position?.displayName ?? c.order ?? i + 1),
      name: c.athlete?.displayName || c.team?.displayName || '',
      flag: c.athlete?.flag?.href,
      score: c.score?.displayValue ?? c.score ?? undefined,
    }))
  const g: Game = {
    ...baseGame(e, { ...comp, status: e.status?.type?.state === 'in' ? e.status : comp.status || e.status }, league, e.id),
    date: new Date(e.date),
    kind: 'leaderboard',
    home: EMPTY_SIDE,
    away: EMPTY_SIDE,
    leaders,
  }
  g.note = [comp.type?.text || comp.type?.abbreviation, g.venue].filter(Boolean).join(' · ') || undefined
  return g
}

/** Convierte un evento de scoreboard en uno o varios "juegos" según el deporte. */
export function normalizeScoreboardEvent(e: any, league: League, sport: SportDef): Game[] {
  if (sport.mode === 'leaderboard') return [leaderboardFrom(e, league)]
  const groups: any[] = e.groupings || []
  if (groups.length) {
    return groups.flatMap((gr) =>
      (gr.competitions || []).map((c: any) => matchFrom(e, c, league, `${e.id}~${c.id}`, gr.grouping?.displayName)),
    )
  }
  const comps: any[] = e.competitions || []
  if (comps.length > 1) return comps.map((c) => matchFrom(e, c, league, `${e.id}~${c.id}`))
  return [matchFrom(e, comps[0] || {}, league, e.id)]
}

/** Compatibilidad: un evento con una sola competencia (encabezado del summary). */
export function normalizeEvent(e: any, league: League): Game {
  return matchFrom(e, e.competitions?.[0] || {}, league, e.id)
}

/* ---------- Scoreboards por día ---------- */
const dayKeys = (day: Date) => [-1, 0, 1].map((n) => ymd(addDays(day, n)))
const keepDay = (g: Game, day: Date) =>
  sameLocalDay(g.date, day) || (g.state === 'in' && sameLocalDay(day, new Date())) ||
  // eventos de varios días (torneos, GP) que siguen en curso o abarcan la fecha
  (g.kind === 'leaderboard' && g.state === 'in')

async function fetchRaw(path: string, day: Date, maxAge = 4000): Promise<any[]> {
  const res = await Promise.allSettled(dayKeys(day).map((d) => getJSON(`${BASE}/${path}/scoreboard?dates=${d}&limit=1000`, maxAge)))
  if (res.every((r) => r.status === 'rejected')) throw new Error('Sin conexión con el proveedor de datos')
  const seen = new Set<string>()
  const out: any[] = []
  res.forEach((r) => r.status === 'fulfilled' && (r.value.events || []).forEach((e: any) => !seen.has(e.id) && (seen.add(e.id), out.push(e))))
  return out
}

export async function fetchLeagueDay(sport: SportDef, league: League, day: Date): Promise<Game[]> {
  const events = await fetchRaw(league.path, day)
  return events
    .flatMap((e) => normalizeScoreboardEvent(e, league, sport))
    .filter((g) => keepDay(g, day))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
}

const leagueIdFromUid = (uid?: string) => /~l:(\d+)/.exec(uid || '')?.[1]

/**
 * Todos los juegos del día de un deporte.
 * - Fútbol: un solo scoreboard agregado con TODAS las ligas del mundo.
 * - Resto: ligas más relevantes + las favoritas del usuario, en paralelo con concurrencia limitada.
 */
export async function fetchSportDay(sport: SportDef, day: Date, extraLeagueSlugs: string[] = []): Promise<Game[]> {
  const leagues = await fetchLeagues(sport).catch(() => [] as League[])
  if (sport.aggregate) {
    const byId = new Map(leagues.map((l) => [l.espnId, l]))
    const events = await fetchRaw(`${sport.espn}/all`, day)
    const games = events.flatMap((e) => {
      const lg = byId.get(leagueIdFromUid(e.uid)) ?? minimalLeague(sport, 'all')
      return normalizeScoreboardEvent(e, lg, sport)
    })
    // ligas favoritas que el agregado no incluya
    const missing = extraLeagueSlugs.filter((s) => !games.some((g) => g.leagueSlug === s))
    const extra = await pool(missing, 6, (s) => fetchLeagueDay(sport, leagues.find((l) => l.slug === s) ?? minimalLeague(sport, s), day))
    extra.forEach((r) => r.status === 'fulfilled' && games.push(...r.value))
    return dedupe(games.filter((g) => keepDay(g, day)))
  }
  const chosen = [
    ...leagues.slice(0, sport.feedLeagues),
    ...extraLeagueSlugs.filter((s) => !leagues.slice(0, sport.feedLeagues).some((l) => l.slug === s)).map((s) => leagues.find((l) => l.slug === s) ?? minimalLeague(sport, s)),
  ]
  const res = await pool(chosen, 8, (l) => fetchLeagueDay(sport, l, day))
  const games: Game[] = []
  res.forEach((r) => r.status === 'fulfilled' && games.push(...r.value))
  return dedupe(games)
}

const dedupe = (games: Game[]) => {
  const seen = new Set<string>()
  return games
    .filter((g) => (seen.has(g.id) ? false : (seen.add(g.id), true)))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
}

export async function fetchSummary(league: League, id: string) {
  return getJSON(`${BASE}/${league.path}/summary?event=${id}`, 2500)
}

/** Situación en vivo (down/yarda, bases/cuenta) que vive en el scoreboard. */
export async function fetchSituation(league: League, id: string, date: Date) {
  const events = await fetchRaw(league.path, date, 2500)
  const e = events.find((x: any) => x.id === id)
  return e ? normalizeEvent(e, league) : undefined
}

/** Evento crudo de scoreboard (tenis, MMA, golf, F1) para su página de detalle. */
export async function fetchScoreboardEvent(league: League, eventId: string, day: Date) {
  const events = await fetchRaw(league.path, day, 2500)
  return events.find((x: any) => x.id === eventId)
}

/* ---------- Tablas de posiciones ---------- */
export interface StandingGroup {
  name: string
  rows: { team: { id: string; name: string; logo?: string; abbr: string }; stats: Record<string, string>; note?: string; color?: string }[]
}
export async function fetchStandings(league: League): Promise<StandingGroup[]> {
  const j = await getJSON(`https://site.api.espn.com/apis/v2/sports/${league.path}/standings`, 60000)
  const groups: any[] = j.children?.length ? j.children : j.standings ? [j] : []
  const flat = (g: any): any[] => (g.standings ? [g] : (g.children || []).flatMap(flat))
  return groups.flatMap(flat).map((g: any) => ({
    name: g.name || g.abbreviation || '',
    rows: (g.standings?.entries || []).map((en: any) => ({
      team: {
        id: en.team?.id,
        name: en.team?.displayName || en.team?.name,
        abbr: en.team?.abbreviation,
        logo: en.team?.logos?.[0]?.href,
      },
      stats: Object.fromEntries((en.stats || []).map((s: any) => [s.name || s.type, s.displayValue])),
      note: en.note?.description,
      color: en.note?.color,
    })),
  }))
}

/* ---------- Equipos ---------- */
export async function fetchTeamSchedule(sport: SportDef, slug: string, teamId: string) {
  const leagues = await fetchLeagues(sport).catch(() => [] as League[])
  const byId = new Map(leagues.map((l) => [l.espnId, l]))
  const base = `${BASE}/${sport.espn}/${slug}/teams/${teamId}/schedule`
  const [past, next] = await Promise.allSettled([getJSON(base, 30000), getJSON(`${base}?fixture=true`, 30000)])
  const team = (past.status === 'fulfilled' && past.value.team) || (next.status === 'fulfilled' && next.value.team) || {}
  const events: any[] = []
  const seen = new Set<string>()
  for (const r of [past, next])
    if (r.status === 'fulfilled') for (const e of r.value.events || []) if (!seen.has(e.id)) (seen.add(e.id), events.push(e))
  const fallback = leagues.find((l) => l.slug === slug) ?? minimalLeague(sport, slug)
  const games = events
    .map((e) => {
      // el calendario trae la liga en e.league (fútbol) o dentro del uid
      const lg =
        byId.get(e.league?.id ?? leagueIdFromUid(e.uid)) ??
        (e.league?.slug ? { ...minimalLeague(sport, e.league.slug), name: e.league.shortName || e.league.name } : fallback)
      return normalizeEvent(e, lg)
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime())
  return {
    team: {
      id: teamId,
      name: team.displayName || team.name || '',
      abbr: team.abbreviation || '',
      logo: team.logo || team.logos?.[0]?.href,
      color: '#' + (team.color || '334155'),
      record: team.recordSummary,
      standing: team.standingSummary,
    },
    games,
  }
}

/* ---------- Búsqueda global (equipos, ligas) ---------- */
export interface SearchHit {
  type: 'team' | 'league'
  name: string
  subtitle?: string
  logo?: string
  sportId: string
  slug: string
  teamId?: string
}
export async function searchAll(q: string): Promise<SearchHit[]> {
  const j = await getJSON(`https://site.web.api.espn.com/apis/search/v2?query=${encodeURIComponent(q)}&limit=12`, 60000)
  const hits: SearchHit[] = []
  for (const r of j.results || []) {
    if (r.type !== 'team' && r.type !== 'league') continue
    for (const c of r.contents || []) {
      const uid: string = c.uid || ''
      const sport = sportByUid(/s:(\d+)/.exec(uid)?.[1])
      if (!sport) continue
      const lid = leagueIdFromUid(uid)
      const leagues = await fetchLeagues(sport).catch(() => [] as League[])
      const lg = lid ? leagues.find((l) => l.espnId === lid) : undefined
      if (r.type === 'team') {
        const tid = /~t:(\d+)/.exec(uid)?.[1]
        const slug = lg?.slug ?? (sport.aggregate ? 'all' : undefined)
        if (!tid || !slug) continue
        hits.push({ type: 'team', name: c.displayName, subtitle: c.subtitle || lg?.name, logo: c.image?.default, sportId: sport.id, slug, teamId: tid })
      } else if (lg) {
        hits.push({ type: 'league', name: lg.name, subtitle: `${sport.emoji} ${lg.country}`, logo: lg.logo, sportId: sport.id, slug: lg.slug })
      }
    }
  }
  return hits
}

/* ---------- Rutas ---------- */
export const gameHref = (g: Pick<Game, 'sportId' | 'leagueSlug' | 'id' | 'eventId' | 'kind' | 'date'>) => {
  const sport = getSport(g.sportId)
  if (sport?.mode === 'team' && g.kind === 'match' && !g.id.includes('~')) return `/partido/${g.sportId}/${g.leagueSlug}/${g.id}`
  return `/evento/${g.sportId}/${g.leagueSlug}/${g.eventId}?d=${isoDay(g.date)}${g.id.includes('~') ? `&c=${g.id.split('~')[1]}` : ''}`
}

/* ---------- Formato ---------- */
export const fmtTime = (d: Date) => d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
export const fmtDay = (d: Date) =>
  d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
export const fmtShort = (d: Date) => d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
