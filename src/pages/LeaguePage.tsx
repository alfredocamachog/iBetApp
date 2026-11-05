import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useLeague } from '../api/catalog'
import { addDays, fetchLeagueDay, fetchStandings, fmtDay, isoDay, parseIsoDay, sameLocalDay, type Game, type StandingGroup } from '../api/espn'
import { useLive } from '../hooks/useLive'
import { toggleLeague, useFavs } from '../store/favorites'
import GameRow from '../components/GameCard'
import DateStrip from '../components/DateStrip'
import { LeagueLogo } from '../components/Sidebar'
import Star from '../components/Star'
import Updated from '../components/Updated'

/* Columnas de tabla por preferencia (se muestran las que existan). */
const COLS: [string, string][] = [
  ['gamesPlayed', 'PJ'], ['wins', 'G'], ['ties', 'E'], ['losses', 'P'], ['otLosses', 'PTE'],
  ['pointsFor', 'F'], ['pointsAgainst', 'C'], ['pointDifferential', 'Dif'], ['winPercent', '%'],
  ['gamesBehind', 'JD'], ['streak', 'Racha'], ['points', 'Pts'],
]

export default function LeaguePage() {
  const { sportId, slug } = useParams()
  const found = useLeague(sportId, slug)
  const favs = useFavs()
  const [sp, setSp] = useSearchParams()
  const tab = sp.get('tab') === 'tabla' ? 'tabla' : 'partidos'
  const today = new Date()
  const day = sp.get('fecha') ? parseIsoDay(sp.get('fecha')!) : today
  const [seeking, setSeeking] = useState(false)

  const set = (k: string, v?: string) => {
    const n = new URLSearchParams(sp)
    v ? n.set(k, v) : n.delete(k)
    setSp(n, { replace: true })
  }

  const games = useLive<Game[]>(
    () => (found && tab === 'partidos' ? fetchLeagueDay(found.sport, found.league, day) : Promise.resolve([])),
    [sportId, slug, isoDay(day), tab],
    (d) => (d?.some((g) => g.state === 'in') ? 8000 : 60000),
  )
  const table = useLive<StandingGroup[]>(
    () => (found && tab === 'tabla' ? fetchStandings(found.league) : Promise.resolve([])),
    [sportId, slug, tab],
    () => 120000,
  )

  if (!found) return <p className="empty">Liga no encontrada.</p>
  const { sport, league } = found
  const fav = favs.leagues.some((l) => l.key === league.key)

  /** Busca el siguiente día con partidos (hasta 30 días). */
  const seekNext = async (dir: 1 | -1) => {
    setSeeking(true)
    for (let i = 1; i <= 30; i++) {
      const d = addDays(day, i * dir)
      const g = await fetchLeagueDay(sport, league, d).catch(() => [])
      if (g.length) {
        set('fecha', sameLocalDay(d, today) ? undefined : isoDay(d))
        break
      }
    }
    setSeeking(false)
  }

  return (
    <div className="league-page" style={{ ['--acc' as any]: sport.accent }}>
      <div className="crumbs">
        <Link to={`/deporte/${sport.id}`}>← {sport.name}</Link>
        <Updated at={tab === 'tabla' ? table.updatedAt : games.updatedAt} live={games.data?.some((g) => g.state === 'in')} />
      </div>
      <header className="league-hero">
        <LeagueLogo l={league} size={56} />
        <div>
          <h1>{league.name}</h1>
          <p className="muted">
            {league.flag} {league.country} · {sport.emoji} {sport.name}
          </p>
        </div>
        <Star size={26} on={fav} onToggle={() => toggleLeague({ key: league.key, sportId: sport.id, slug: league.slug, name: league.name, logo: league.logo, flag: league.flag })} />
      </header>

      <div className="tabs">
        <button className={tab === 'partidos' ? 'on' : ''} onClick={() => set('tab')}>Partidos</button>
        <button className={tab === 'tabla' ? 'on' : ''} onClick={() => set('tab', 'tabla')}>Tabla</button>
      </div>

      {tab === 'partidos' ? (
        <>
          <DateStrip day={day} onChange={(d) => set('fecha', sameLocalDay(d, today) ? undefined : isoDay(d))} />
          <p className="day-label">{fmtDay(day)}</p>
          {games.loading && !games.data ? (
            <div className="league-block">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="grow skeleton" />)}</div>
          ) : games.data?.length ? (
            <section className="league-block">
              {games.data.map((g) => (
                <GameRow key={g.id} g={g} />
              ))}
            </section>
          ) : (
            <div className="empty">
              <p>No hay partidos de {league.name} este día.</p>
              <div className="row-btns">
                <button className="btn" disabled={seeking} onClick={() => seekNext(-1)}>◂ Jornada anterior</button>
                <button className="btn primary" disabled={seeking} onClick={() => seekNext(1)}>{seeking ? 'Buscando…' : 'Próxima jornada ▸'}</button>
              </div>
            </div>
          )}
        </>
      ) : table.loading && !table.data ? (
        <div className="skeleton-page" />
      ) : !table.data?.length ? (
        <p className="empty">Esta competencia no tiene tabla de posiciones disponible.</p>
      ) : (
        table.data.map((g) => {
          const cols = COLS.filter(([k]) => g.rows.some((r) => r.stats[k] !== undefined && r.stats[k] !== ''))
          return (
            <div key={g.name} className="card table-wrap">
              {table.data!.length > 1 && <h3>{g.name}</h3>}
              <table className="standings">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Equipo</th>
                    {cols.map(([k, l]) => (
                      <th key={k}>{l}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r, i) => {
                    const favT = favs.teams.some((t) => t.key === `${sport.id}:${r.team.id}`)
                    return (
                      <tr key={r.team.id} className={favT ? 'fav-row' : ''} title={r.note}>
                        <td>
                          <span className="rank" style={{ borderColor: r.color ? `#${r.color.replace('#', '')}` : 'transparent' }}>{i + 1}</span>
                        </td>
                        <td>
                          <Link to={`/equipo/${sport.id}/${league.slug}/${r.team.id}`} className="st-team">
                            {r.team.logo && <img src={r.team.logo} alt="" width={20} height={20} loading="lazy" />}
                            {r.team.name}
                          </Link>
                        </td>
                        {cols.map(([k]) => (
                          <td key={k} className={k === 'points' ? 'pts' : ''}>{r.stats[k]}</td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })
      )}
    </div>
  )
}
