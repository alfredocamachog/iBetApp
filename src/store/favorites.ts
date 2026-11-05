/* Favoritos persistentes en el navegador (ligas, equipos y partidos), sincronizados entre pestañas. */
import { useSyncExternalStore } from 'react'

export interface FavLeague {
  key: string // sportId:slug
  sportId: string
  slug: string
  name: string
  logo?: string
  flag?: string
}
export interface FavTeam {
  key: string // sportId:teamId
  sportId: string
  slug: string // liga para consultar su calendario ('all' en fútbol)
  id: string
  name: string
  logo?: string
}
export interface FavGame {
  key: string // sportId:gameId
  sportId: string
  slug: string
  id: string
  label: string
  date: string
  href: string
}
export interface Favs {
  leagues: FavLeague[]
  teams: FavTeam[]
  games: FavGame[]
}

const KEY = 'ibet:favs:v1'
const empty: Favs = { leagues: [], teams: [], games: [] }

function load(): Favs {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...empty, ...JSON.parse(raw) }
  } catch {
    /* almacenamiento no disponible */
  }
  return empty
}

let state: Favs = load()
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

function save(next: Favs) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* modo privado */
  }
  emit()
}

if (typeof window !== 'undefined')
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      state = load()
      emit()
    }
  })

const subscribe = (f: () => void) => {
  subs.add(f)
  return () => subs.delete(f)
}
export const useFavs = () => useSyncExternalStore(subscribe, () => state)
export const getFavs = () => state

function toggle<K extends keyof Favs>(kind: K, item: Favs[K][number]) {
  const list = state[kind] as { key: string }[]
  const exists = list.some((x) => x.key === item.key)
  save({ ...state, [kind]: exists ? list.filter((x) => x.key !== item.key) : [...list, item] })
  return !exists
}

export const toggleLeague = (l: FavLeague) => toggle('leagues', l)
export const toggleTeam = (t: FavTeam) => toggle('teams', t)
export const toggleGame = (g: FavGame) => toggle('games', g)

/** Limpia partidos favoritos de hace más de 3 días. */
export function pruneOldGames() {
  const limit = Date.now() - 3 * 864e5
  const games = state.games.filter((g) => new Date(g.date).getTime() > limit)
  if (games.length !== state.games.length) save({ ...state, games })
}

export const favCount = (f: Favs) => f.leagues.length + f.teams.length + f.games.length
