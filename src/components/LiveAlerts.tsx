import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { getSport, minimalLeague } from '../api/catalog'
import { fetchLeagueDay, gameHref, type Game } from '../api/espn'
import { getFavs, pruneOldGames, useFavs } from '../store/favorites'

/* ---------- Mini-store de avisos ---------- */
interface Toast {
  id: number
  icon: string
  title: string
  body: string
  href: string
}
let toasts: Toast[] = []
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
let nextId = 1
export function pushToast(t: Omit<Toast, 'id'>) {
  const id = nextId++
  toasts = [...toasts.slice(-3), { ...t, id }]
  emit()
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== id)
    emit()
  }, 9000)
}
const useToasts = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => toasts,
  )

export function ToastHost() {
  const list = useToasts()
  return (
    <div className="toasts" aria-live="polite">
      {list.map((t) => (
        <Link key={t.id} to={t.href} className="toast">
          <span className="t-icon">{t.icon}</span>
          <div>
            <b>{t.title}</b>
            <p>{t.body}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}

/* ---------- Campana: permiso de notificaciones del navegador ---------- */
export function BellButton() {
  const supported = typeof Notification !== 'undefined'
  const [perm, setPerm] = useState(supported ? Notification.permission : 'denied')
  if (!supported) return null
  const ask = async () => {
    if (perm === 'default') setPerm(await Notification.requestPermission())
    else pushToast({ icon: '🔔', title: 'Alertas', body: perm === 'granted' ? 'Las alertas del navegador están activas.' : 'Las bloqueaste en el navegador; actívalas desde la configuración del sitio.', href: '/favoritos' })
  }
  return (
    <button className={`iconbtn ${perm === 'granted' ? 'on' : ''}`} onClick={ask} title="Alertas de tus favoritos">
      {perm === 'granted' ? '🔔' : '🔕'}
    </button>
  )
}

/* ---------- Vigilante: compara marcadores de tus favoritos ---------- */
type Snap = { state: string; h?: string; a?: string }
const label = (g: Game) => `${g.away.short} ${g.away.score ?? ''} - ${g.home.score ?? ''} ${g.home.short}`.replace(/\s+/g, ' ')

function notify(icon: string, title: string, body: string, href: string) {
  pushToast({ icon, title, body, href })
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
    try {
      new Notification(`${icon} ${title}`, { body, icon: '/favicon.svg', tag: href })
    } catch {
      /* algunos navegadores solo permiten notificaciones vía service worker */
    }
  }
}

export default function LiveAlerts() {
  const favs = useFavs()
  const snaps = useRef(new Map<string, Snap>())
  const key = JSON.stringify([favs.teams.map((t) => t.key), favs.games.map((g) => g.key)])

  useEffect(() => {
    pruneOldGames()
    let alive = true
    let timer: number | undefined
    const tick = async () => {
      const f = getFavs()
      const targets = new Map<string, { sportId: string; slug: string }>()
      f.games.forEach((g) => targets.set(`${g.sportId}|${g.slug}`, { sportId: g.sportId, slug: g.slug }))
      f.teams.forEach((t) => targets.set(`${t.sportId}|${t.slug}`, { sportId: t.sportId, slug: t.slug }))
      const today = new Date()
      for (const { sportId, slug } of targets.values()) {
        const sport = getSport(sportId)
        if (!sport) continue
        let games: Game[] = []
        try {
          games = await fetchLeagueDay(sport, minimalLeague(sport, slug), today)
        } catch {
          continue
        }
        const teamIds = new Set(f.teams.filter((t) => t.sportId === sportId).map((t) => t.id))
        const gameIds = new Set(f.games.filter((g) => g.sportId === sportId).map((g) => g.id))
        for (const g of games) {
          if (!gameIds.has(g.id) && !teamIds.has(g.home.id) && !teamIds.has(g.away.id)) continue
          const now: Snap = { state: g.state, h: g.home.score, a: g.away.score }
          const prev = snaps.current.get(g.id)
          snaps.current.set(g.id, now)
          if (!prev || !alive) continue
          const href = gameHref(g)
          if (prev.state === 'pre' && now.state === 'in') notify('🟢', 'Comenzó', `${g.away.short} vs ${g.home.short}`, href)
          else if (now.state === 'in' && (prev.h !== now.h || prev.a !== now.a)) notify(sport.emoji, '¡Anotación!', label(g), href)
          else if (prev.state === 'in' && now.state === 'post') notify('🏁', 'Final', label(g), href)
        }
      }
      if (alive) timer = window.setTimeout(tick, document.hidden ? 60000 : 25000)
    }
    tick()
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [key])

  return null
}
