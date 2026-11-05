import { useMemo, useState } from 'react'
import { Link, NavLink, useParams, useSearchParams } from 'react-router-dom'
import { SPORTS, getSport, useLeagues, type League } from '../api/catalog'
import { fetchSportDay, fmtDay, isoDay, parseIsoDay, sameLocalDay, type Game } from '../api/espn'
import { useLive } from '../hooks/useLive'
import { toggleLeague, useFavs, type Favs } from '../store/favorites'
import GameRow from '../components/GameCard'
import DateStrip from '../components/DateStrip'
import Sidebar, { LeagueLogo } from '../components/Sidebar'
import Star from '../components/Star'
import Updated from '../components/Updated'

type Filter = 'todos' | 'vivo' | 'favoritos'

const isFavGame = (g: Game, f: Favs) =>
  f.games.some((x) => x.key === `${g.sportId}:${g.id}`) ||
  f.teams.some((t) => t.sportId === g.sportId && (t.id === g.home.id || t.id === g.away.id)) ||
  f.leagues.some((l) => l.key === g.leagueKey)

/** Inicio / deporte: todos los partidos del día de todas las ligas, agrupados por liga. */
export default function Feed() {
  const { sportId = 'futbol' } = useParams()
  const sport = getSport(sportId) ?? getSport('futbol')!
  const [sp, setSp] = useSearchParams()
  const favs = useFavs()
  const leagues = useLeagues(sport)
  const [menu, setMenu] = useState(false)
  const today = new Date()
  const day = sp.get('fecha') ? parseIsoDay(sp.get('fecha')!) : today
  const filter = (sp.get('ver') as Filter) || 'todos'
  const favSlugs = favs.leagues.filter((l) => l.sportId === sport.id).map((l) => l.slug)
  const teamSlugs = favs.teams.filter((t) => t.sportId === sport.id && t.slug !== 'all').map((t) => t.slug)
  const extra = [...new Set([...favSlugs, ...teamSlugs])]

  const { data, loading, error, updatedAt } = useLive(
    () => fetchSportDay(sport, day, extra),
    [sport.id, isoDay(day), extra.join(',')],
    (d) => (d?.some((g) => g.state === 'in') ? 10000 : 60000),
  )

  const set = (k: string, v?: string) => {
    const n = new URLSearchParams(sp)
    v ? n.set(k, v) : n.delete(k)
    setSp(n, { replace: true })
  }

  const live = data?.filter((g) => g.state === 'in').length ?? 0
  const favN = data?.filter((g) => isFavGame(g, favs)).length ?? 0

  const sections = useMemo(() => {
    const list = (data || []).filter((g) => (filter === 'vivo' ? g.state === 'in' : filter === 'favoritos' ? isFavGame(g, favs) : true))
    const m = new Map<string, { league: Partial<League> & { key: string; name: string }; games: Game[]; score: number }>()
    for (const g of list) {
      const lg = leagues?.find((l) => l.key === g.leagueKey)
      const s = m.get(g.leagueKey) ?? {
        league: lg ?? { key: g.leagueKey, name: g.leagueName, slug: g.leagueSlug, sportId: g.sportId },
        games: [],
        score: 0,
      }
      s.games.push(g)
      m.set(g.leagueKey, s)
    }
    for (const s of m.values()) {
      const favL = favs.leagues.some((l) => l.key === s.league.key)
      const favT = s.games.some((g) => isFavGame(g, favs))
      s.score = (favL ? 0 : favT ? 1000 : 2000) + (s.league.order ?? 900) - (s.games.some((g) => g.state === 'in') ? 0.5 : 0)
    }
    return [...m.values()].sort((a, b) => a.score - b.score)
  }, [data, filter, favs, leagues])

  return (
    <div className="with-sidebar" style={{ ['--acc' as any]: sport.accent }}>
      <div className={`sb-wrap ${menu ? 'open' : ''}`} onClick={(e) => e.target === e.currentTarget && setMenu(false)}>
        <Sidebar sport={sport} onPick={() => setMenu(false)} />
      </div>
      <div className="feed-main">
        <nav className="sport-chips">
          {SPORTS.map((s) => (
            <NavLink key={s.id} to={`/deporte/${s.id}`} className={s.id === sport.id ? 'on' : ''}>
              <span>{s.emoji}</span> {s.name}
            </NavLink>
          ))}
        </nav>
        <div className="sp-head">
          <button className="menu-btn" onClick={() => setMenu(true)}>☰ Ligas</button>
          <h1>
            <span>{sport.emoji}</span> {sport.name}
          </h1>
          <Updated at={updatedAt} live={live > 0} />
        </div>

        <DateStrip day={day} onChange={(d) => set('fecha', sameLocalDay(d, today) ? undefined : isoDay(d))} />
        <p className="day-label">{fmtDay(day)}</p>

        <div className="tabs">
          <button className={filter === 'todos' ? 'on' : ''} onClick={() => set('ver')}>
            Todos <b>{data?.length ?? 0}</b>
          </button>
          <button className={filter === 'vivo' ? 'on' : ''} onClick={() => set('ver', 'vivo')}>
            {live > 0 && <span className="dot" />}En vivo <b>{live}</b>
          </button>
          <button className={filter === 'favoritos' ? 'on' : ''} onClick={() => set('ver', 'favoritos')}>
            ★ Favoritos <b>{favN}</b>
          </button>
        </div>

        {error && <p className="error">No se pudo actualizar: {error}</p>}
        {loading && !data ? (
          <div className="league-block">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="grow skeleton" />
            ))}
          </div>
        ) : sections.length === 0 ? (
          <div className="empty">
            {filter === 'vivo'
              ? 'No hay partidos en vivo en este momento.'
              : filter === 'favoritos'
                ? 'Ninguno de tus favoritos juega este día. Marca ligas, equipos o partidos con ★.'
                : 'No hay partidos programados para esta fecha.'}
          </div>
        ) : (
          sections.map(({ league, games }) => (
            <section key={league.key} className="league-block">
              <header className="lb-head">
                <Link to={league.slug && league.slug !== 'all' ? `/liga/${sport.id}/${league.slug}` : '#'} className="lb-link">
                  {league.flag || league.logo ? <LeagueLogo l={league as League} size={20} /> : <span>{sport.emoji}</span>}
                  <span>
                    {league.country && league.country !== 'Internacional' && <small>{league.country} · </small>}
                    {league.name}
                  </span>
                  {games.some((g) => g.state === 'in') && <span className="dot" />}
                </Link>
                {league.slug && league.slug !== 'all' && (
                  <Star
                    size={16}
                    on={favs.leagues.some((l) => l.key === league.key)}
                    onToggle={() =>
                      toggleLeague({ key: league.key, sportId: sport.id, slug: league.slug!, name: league.name, logo: league.logo, flag: league.flag })
                    }
                  />
                )}
              </header>
              {games.map((g) => (
                <GameRow key={g.id} g={g} />
              ))}
            </section>
          ))
        )}
        {!sport.aggregate && leagues && leagues.length > sport.feedLeagues && (
          <p className="muted sm center">
            Mostrando las {sport.feedLeagues} ligas principales y tus favoritas. Abre cualquier otra desde ☰ Ligas o el buscador.
          </p>
        )}
      </div>
    </div>
  )
}
