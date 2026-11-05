import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAllLeagues, getSport, type League } from '../api/catalog'
import { searchAll, type SearchHit } from '../api/espn'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Buscador global: ligas de todos los deportes (catálogo local) + equipos (búsqueda en línea). */
export default function SearchBox() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [leagues, setLeagues] = useState<League[]>([])
  const [remote, setRemote] = useState<SearchHit[]>([])
  const [busy, setBusy] = useState(false)
  const [sel, setSel] = useState(0)
  const nav = useNavigate()
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && !leagues.length) fetchAllLeagues().then(setLeagues)
  }, [open, leagues.length])

  useEffect(() => {
    const h = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Atajo: "/" enfoca el buscador
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target as HTMLElement).closest('input,textarea')) {
        e.preventDefault()
        box.current?.querySelector('input')?.focus()
      }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  useEffect(() => {
    if (q.trim().length < 2) return setRemote([])
    setBusy(true)
    const t = setTimeout(() => {
      searchAll(q.trim())
        .then(setRemote)
        .catch(() => setRemote([]))
        .finally(() => setBusy(false))
    }, 280)
    return () => clearTimeout(t)
  }, [q])

  const local: SearchHit[] = useMemo(() => {
    const n = norm(q.trim())
    if (n.length < 2) return []
    return leagues
      .filter((l) => norm(`${l.name} ${l.short} ${l.country} ${l.slug}`).includes(n))
      .slice(0, 8)
      .map((l) => ({ type: 'league' as const, name: l.name, subtitle: `${getSport(l.sportId)?.emoji} ${l.flag} ${l.country}`, logo: l.logo, sportId: l.sportId, slug: l.slug }))
  }, [q, leagues])

  const hits = useMemo(() => {
    const seen = new Set<string>()
    return [...remote.filter((h) => h.type === 'team'), ...local, ...remote].filter((h) => {
      const k = `${h.type}:${h.sportId}:${h.slug}:${h.teamId ?? ''}`
      return seen.has(k) ? false : (seen.add(k), true)
    })
  }, [local, remote])

  const go = (h: SearchHit) => {
    setOpen(false)
    setQ('')
    nav(h.type === 'team' ? `/equipo/${h.sportId}/${h.slug}/${h.teamId}` : `/liga/${h.sportId}/${h.slug}`)
  }

  return (
    <div className="search" ref={box}>
      <input
        value={q}
        placeholder="Buscar equipo, liga o país…  ( / )"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value)
          setSel(0)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setSel((s) => Math.min(s + 1, hits.length - 1))
          else if (e.key === 'ArrowUp') setSel((s) => Math.max(s - 1, 0))
          else if (e.key === 'Enter' && hits[sel]) go(hits[sel])
          else if (e.key === 'Escape') setOpen(false)
        }}
      />
      {open && q.trim().length >= 2 && (
        <div className="search-pop">
          {hits.map((h, i) => (
            <button key={`${h.type}${h.sportId}${h.slug}${h.teamId ?? ''}`} className={i === sel ? 'sel' : ''} onMouseEnter={() => setSel(i)} onClick={() => go(h)}>
              {h.logo ? <img src={h.logo} alt="" width={22} height={22} loading="lazy" /> : <span className="sp-emoji">{getSport(h.sportId)?.emoji}</span>}
              <span className="sh-main">
                {h.name}
                <small>{h.subtitle}</small>
              </span>
              <em>{h.type === 'team' ? 'Equipo' : 'Liga'}</em>
            </button>
          ))}
          {!hits.length && <p className="muted sm pad">{busy ? 'Buscando…' : 'Sin resultados'}</p>}
        </div>
      )}
    </div>
  )
}
