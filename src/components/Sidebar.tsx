import { useMemo, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { SPORTS, countryRank, useLeagues, type League, type SportDef } from '../api/catalog'
import { toggleLeague, useFavs } from '../store/favorites'
import Star from './Star'

/** Windows no dibuja banderas emoji: convertimos el emoji a imagen (flagcdn) y dejamos 🌍 como emoji. */
function flagCode(emoji?: string) {
  if (!emoji) return undefined
  const cps = [...emoji].map((c) => c.codePointAt(0)!)
  if (cps.length === 2 && cps.every((c) => c >= 0x1f1e6 && c <= 0x1f1ff)) return cps.map((c) => String.fromCharCode(c - 0x1f1e6 + 97)).join('')
  if (cps[0] === 0x1f3f4 && cps.length > 2) {
    const tag = cps.slice(1, -1).map((c) => String.fromCharCode(c - 0xe0000)).join('') // gbeng
    return `gb-${tag.slice(2)}`
  }
  return undefined
}
export function Flag({ emoji, size = 18 }: { emoji?: string; size?: number }) {
  const code = flagCode(emoji)
  if (!code) return <span className="lflag" style={{ fontSize: size * 0.8 }}>{emoji}</span>
  return <img className="flagimg" src={`https://flagcdn.com/w40/${code}.png`} alt="" width={size} height={Math.round(size * 0.72)} loading="lazy" />
}

export function LeagueLogo({ l, size = 18 }: { l: { logo?: string; flag?: string }; size?: number }) {
  const [err, setErr] = useState(false)
  if (l.logo && !err) return <img src={l.logo} alt="" width={size} height={size} loading="lazy" className="llogo" onError={() => setErr(true)} />
  return <Flag emoji={l.flag} size={size} />
}

/** Barra lateral: deportes, ligas favoritas y todas las ligas del deporte por país. */
export default function Sidebar({ sport, onPick }: { sport: SportDef; onPick?: () => void }) {
  const favs = useFavs()
  const leagues = useLeagues(sport)
  const [filter, setFilter] = useState('')
  const [openC, setOpenC] = useState<Record<string, boolean>>({ Internacional: true, México: true })

  const byCountry = useMemo(() => {
    const m = new Map<string, League[]>()
    const f = filter.trim().toLowerCase()
    ;(leagues || [])
      .filter((l) => !f || `${l.name} ${l.country}`.toLowerCase().includes(f))
      .forEach((l) => m.set(l.country, [...(m.get(l.country) || []), l]))
    return [...m.entries()].sort((a, b) => countryRank(a[0]) - countryRank(b[0]) || a[0].localeCompare(b[0]))
  }, [leagues, filter])

  const favLeagues = favs.leagues
  const leagueRow = (l: League) => (
    <Link key={l.key} to={`/liga/${l.sportId}/${l.slug}`} className="sb-league" onClick={onPick}>
      <LeagueLogo l={l} />
      <span>{l.name}</span>
      <Star
        size={15}
        on={favLeagues.some((x) => x.key === l.key)}
        onToggle={() => toggleLeague({ key: l.key, sportId: l.sportId, slug: l.slug, name: l.name, logo: l.logo, flag: l.flag })}
      />
    </Link>
  )

  return (
    <aside className="sidebar">
      <nav className="sb-sports">
        {SPORTS.map((s) => (
          <NavLink key={s.id} to={`/deporte/${s.id}`} className="sb-sport" style={{ ['--acc' as any]: s.accent }} onClick={onPick}>
            <span>{s.emoji}</span>
            {s.name}
          </NavLink>
        ))}
      </nav>

      {favLeagues.length > 0 && (
        <section>
          <h4>★ Mis ligas</h4>
          {favLeagues.map((l) => (
            <Link key={l.key} to={`/liga/${l.sportId}/${l.slug}`} className="sb-league" onClick={onPick}>
              <LeagueLogo l={l} />
              <span>{l.name}</span>
              <Star size={15} on onToggle={() => toggleLeague(l)} />
            </Link>
          ))}
        </section>
      )}

      <section>
        <h4>
          {sport.emoji} Ligas de {sport.name} <small className="muted">{leagues?.length ?? ''}</small>
        </h4>
        <input className="sb-filter" placeholder="Filtrar ligas o países…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        {!leagues && <div className="shimmer-line" />}
        {byCountry.length === 1 || sport.id !== 'futbol'
          ? byCountry.flatMap(([, ls]) => ls).map(leagueRow)
          : byCountry.map(([country, ls]) => {
              const open = openC[country] || !!filter
              return (
                <div key={country} className="sb-country">
                  <button onClick={() => setOpenC((o) => ({ ...o, [country]: !open }))}>
                    <Flag emoji={ls[0].flag} />
                    {country}
                    <small>{ls.length}</small>
                    <i>{open ? '▾' : '▸'}</i>
                  </button>
                  {open && ls.map(leagueRow)}
                </div>
              )
            })}
      </section>
    </aside>
  )
}
