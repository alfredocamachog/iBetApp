/* Catálogo mundial: deportes fijos + ligas cargadas dinámicamente desde ESPN (cache 24 h). */
import { useEffect, useState } from 'react'

export type FieldKind = 'soccer' | 'basketball' | 'football' | 'baseball' | 'hockey' | 'none'
/** team: equipo vs equipo · versus: atleta vs atleta (tenis, MMA) · leaderboard: clasificación (golf, F1) */
export type SportMode = 'team' | 'versus' | 'leaderboard'

export interface SportDef {
  id: string
  espn: string
  uid: string // id de deporte en los uid de ESPN (s:600 = fútbol)
  name: string
  emoji: string
  field: FieldKind
  accent: string
  mode: SportMode
  /** ESPN tiene un scoreboard agregado de todas las ligas (solo fútbol) */
  aggregate?: boolean
  /** cuántas ligas consultar para el feed del día (las más relevantes + favoritas) */
  feedLeagues: number
}

export const SPORTS: SportDef[] = [
  { id: 'futbol', espn: 'soccer', uid: '600', name: 'Fútbol', emoji: '⚽', field: 'soccer', accent: '#00f5a0', mode: 'team', aggregate: true, feedLeagues: 999 },
  { id: 'basquetbol', espn: 'basketball', uid: '40', name: 'Básquetbol', emoji: '🏀', field: 'basketball', accent: '#ff8a3d', mode: 'team', feedLeagues: 15 },
  { id: 'americano', espn: 'football', uid: '20', name: 'Fútbol Americano', emoji: '🏈', field: 'football', accent: '#ffd23f', mode: 'team', feedLeagues: 5 },
  { id: 'beisbol', espn: 'baseball', uid: '1', name: 'Béisbol', emoji: '⚾', field: 'baseball', accent: '#ff4d6d', mode: 'team', feedLeagues: 12 },
  { id: 'hockey', espn: 'hockey', uid: '70', name: 'Hockey', emoji: '🏒', field: 'hockey', accent: '#5ab8ff', mode: 'team', feedLeagues: 6 },
  { id: 'tenis', espn: 'tennis', uid: '850', name: 'Tenis', emoji: '🎾', field: 'none', accent: '#c6f432', mode: 'versus', feedLeagues: 2 },
  { id: 'mma', espn: 'mma', uid: '3301', name: 'MMA', emoji: '🥊', field: 'none', accent: '#ff5d5d', mode: 'versus', feedLeagues: 10 },
  { id: 'rugby', espn: 'rugby', uid: '300', name: 'Rugby', emoji: '🏉', field: 'none', accent: '#a78bfa', mode: 'team', feedLeagues: 18 },
  { id: 'cricket', espn: 'cricket', uid: '200', name: 'Críquet', emoji: '🏏', field: 'none', accent: '#34d399', mode: 'team', feedLeagues: 30 },
  { id: 'automovilismo', espn: 'racing', uid: '2000', name: 'Automovilismo', emoji: '🏎️', field: 'none', accent: '#f43f5e', mode: 'leaderboard', feedLeagues: 5 },
  { id: 'golf', espn: 'golf', uid: '1100', name: 'Golf', emoji: '⛳', field: 'none', accent: '#4ade80', mode: 'leaderboard', feedLeagues: 10 },
  { id: 'voleibol', espn: 'volleyball', uid: '1600', name: 'Voleibol', emoji: '🏐', field: 'none', accent: '#fbbf24', mode: 'team', feedLeagues: 2 },
  { id: 'lacrosse', espn: 'lacrosse', uid: '500', name: 'Lacrosse', emoji: '🥍', field: 'none', accent: '#38bdf8', mode: 'team', feedLeagues: 4 },
  { id: 'australiano', espn: 'australian-football', uid: '34', name: 'Fútbol Australiano', emoji: '🦘', field: 'none', accent: '#fb923c', mode: 'team', feedLeagues: 1 },
]

export const getSport = (id?: string) => SPORTS.find((s) => s.id === id)
export const sportByUid = (uid?: string) => SPORTS.find((s) => s.uid === uid)

export interface League {
  key: string // `${sportId}:${slug}`
  sportId: string
  slug: string
  path: string // espnSport/slug
  name: string
  short: string
  country: string
  flag: string
  espnId?: string
  logo?: string
  order: number
}

/* ---------- Países (prefijo del slug de fútbol) ---------- */
const INTL = ['Internacional', '🌍']
const COUNTRIES: Record<string, [string, string]> = {
  eng: ['Inglaterra', '🏴󠁧󠁢󠁥󠁮󠁧󠁿'], esp: ['España', '🇪🇸'], ger: ['Alemania', '🇩🇪'], ita: ['Italia', '🇮🇹'], fra: ['Francia', '🇫🇷'],
  mex: ['México', '🇲🇽'], usa: ['Estados Unidos', '🇺🇸'], can: ['Canadá', '🇨🇦'], ned: ['Países Bajos', '🇳🇱'], por: ['Portugal', '🇵🇹'],
  sco: ['Escocia', '🏴󠁧󠁢󠁳󠁣󠁴󠁿'], tur: ['Turquía', '🇹🇷'], bel: ['Bélgica', '🇧🇪'], aut: ['Austria', '🇦🇹'], gre: ['Grecia', '🇬🇷'],
  rus: ['Rusia', '🇷🇺'], swe: ['Suecia', '🇸🇪'], den: ['Dinamarca', '🇩🇰'], nor: ['Noruega', '🇳🇴'], arg: ['Argentina', '🇦🇷'],
  bra: ['Brasil', '🇧🇷'], chi: ['Chile', '🇨🇱'], uru: ['Uruguay', '🇺🇾'], col: ['Colombia', '🇨🇴'], per: ['Perú', '🇵🇪'],
  par: ['Paraguay', '🇵🇾'], ecu: ['Ecuador', '🇪🇨'], ven: ['Venezuela', '🇻🇪'], bol: ['Bolivia', '🇧🇴'], hon: ['Honduras', '🇭🇳'],
  crc: ['Costa Rica', '🇨🇷'], gua: ['Guatemala', '🇬🇹'], slv: ['El Salvador', '🇸🇻'], aus: ['Australia', '🇦🇺'], ksa: ['Arabia Saudita', '🇸🇦'],
  chn: ['China', '🇨🇳'], jpn: ['Japón', '🇯🇵'], ind: ['India', '🇮🇳'], rsa: ['Sudáfrica', '🇿🇦'], sui: ['Suiza', '🇨🇭'],
  irl: ['Irlanda', '🇮🇪'], wal: ['Gales', '🏴󠁧󠁢󠁷󠁬󠁳󠁿'], kor: ['Corea del Sur', '🇰🇷'], uae: ['Emiratos Árabes', '🇦🇪'], qat: ['Catar', '🇶🇦'],
}
const COUNTRY_ORDER = ['Internacional', 'México', 'España', 'Inglaterra', 'Italia', 'Alemania', 'Francia', 'Argentina', 'Brasil', 'Estados Unidos']

function countryOf(sport: SportDef, slug: string, name: string): [string, string] {
  if (sport.espn === 'soccer') {
    const p = slug.split('.')[0]
    return COUNTRIES[p] ?? (INTL as [string, string])
  }
  if (/mexican/i.test(slug)) return COUNTRIES.mex
  if (/dominican/i.test(slug)) return ['República Dominicana', '🇩🇴']
  if (/venezuelan/i.test(slug)) return COUNTRIES.ven
  if (/puerto-rican/i.test(slug)) return ['Puerto Rico', '🇵🇷']
  if (/^(nba|wnba|nfl|mlb|nhl|ufl|xfl|pll|nll|college|mens-college|womens-college|nba-)/.test(slug) || /NCAA/.test(name)) return COUNTRIES.usa
  if (slug === 'cfl') return COUNTRIES.can
  if (slug === 'nbl' || slug === 'afl') return COUNTRIES.aus
  return INTL as [string, string]
}
export const countryRank = (c: string) => {
  const i = COUNTRY_ORDER.indexOf(c)
  return i === -1 ? 100 : i
}

/* ---------- Carga de ligas ---------- */
const TTL = 24 * 3600 * 1000
const mem = new Map<string, Promise<League[]>>()

export function fetchLeagues(sport: SportDef): Promise<League[]> {
  const hit = mem.get(sport.id)
  if (hit) return hit
  const lsKey = `ibet:leagues:${sport.id}:v1`
  try {
    const raw = localStorage.getItem(lsKey)
    if (raw) {
      const { t, data } = JSON.parse(raw)
      if (Date.now() - t < TTL && data?.length) {
        const p = Promise.resolve(data as League[])
        mem.set(sport.id, p)
        return p
      }
    }
  } catch {
    /* sin almacenamiento */
  }
  const p = fetch(`https://site.api.espn.com/apis/site/v2/leagues/dropdown?sport=${sport.espn}&limit=600`)
    .then((r) => r.json())
    .then((j) => {
      const leagues: League[] = (j.leagues || [])
        .filter((l: any) => l.slug)
        .map((l: any, i: number) => {
          const [country, flag] = countryOf(sport, l.slug, l.name || '')
          return {
            key: `${sport.id}:${l.slug}`,
            sportId: sport.id,
            slug: l.slug,
            path: `${sport.espn}/${l.slug}`,
            name: l.shortName && l.shortName.length > 3 && sport.espn === 'soccer' ? l.shortName : l.name || l.abbreviation,
            short: l.abbreviation || l.shortName || l.slug,
            country,
            flag,
            espnId: l.id,
            logo: sport.espn === 'soccer' && l.id ? `https://a.espncdn.com/i/leaguelogos/soccer/500/${l.id}.png` : undefined,
            order: i,
          }
        })
      try {
        localStorage.setItem(lsKey, JSON.stringify({ t: Date.now(), data: leagues }))
      } catch {
        /* cuota llena */
      }
      return leagues
    })
    .catch((e) => {
      mem.delete(sport.id)
      throw e
    })
  mem.set(sport.id, p)
  return p
}

export function useLeagues(sport?: SportDef) {
  const [leagues, setLeagues] = useState<League[]>()
  useEffect(() => {
    if (!sport) return
    let alive = true
    setLeagues(undefined)
    fetchLeagues(sport).then((l) => alive && setLeagues(l)).catch(() => alive && setLeagues([]))
    return () => {
      alive = false
    }
  }, [sport])
  return leagues
}

/** Liga a partir de la URL; si el catálogo aún no carga, devuelve una mínima utilizable. */
export function minimalLeague(sport: SportDef, slug: string): League {
  const [country, flag] = countryOf(sport, slug, '')
  return { key: `${sport.id}:${slug}`, sportId: sport.id, slug, path: `${sport.espn}/${slug}`, name: slug.toUpperCase(), short: slug, country, flag, order: 999 }
}

export function useLeague(sportId?: string, slug?: string) {
  const sport = getSport(sportId)
  const leagues = useLeagues(sport)
  if (!sport || !slug) return undefined
  return { sport, league: leagues?.find((l) => l.slug === slug) ?? minimalLeague(sport, slug), loaded: !!leagues }
}

/** Todas las ligas de todos los deportes (para el buscador). */
export async function fetchAllLeagues() {
  const res = await Promise.allSettled(SPORTS.map(fetchLeagues))
  return res.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
}
