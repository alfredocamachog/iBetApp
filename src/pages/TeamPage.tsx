import { Link, useParams } from 'react-router-dom'
import { getSport } from '../api/catalog'
import { fetchTeamSchedule, fmtDay, fmtTime } from '../api/espn'
import { useLive, useNow } from '../hooks/useLive'
import { toggleTeam, useFavs } from '../store/favorites'
import GameRow, { TeamLogo } from '../components/GameCard'
import Star from '../components/Star'

function Countdown({ to }: { to: Date }) {
  const now = useNow(1000)
  let s = Math.max(0, Math.floor((to.getTime() - now.getTime()) / 1000))
  const d = Math.floor(s / 86400)
  s -= d * 86400
  const h = Math.floor(s / 3600)
  s -= h * 3600
  const m = Math.floor(s / 60)
  s -= m * 60
  return (
    <div className="countdown">
      {d > 0 && <span><b>{d}</b>d</span>}
      <span><b>{String(h).padStart(2, '0')}</b>h</span>
      <span><b>{String(m).padStart(2, '0')}</b>m</span>
      <span><b>{String(s).padStart(2, '0')}</b>s</span>
    </div>
  )
}

export default function TeamPage() {
  const { sportId, slug = 'all', teamId = '' } = useParams()
  const sport = getSport(sportId)
  const favs = useFavs()
  const { data, loading, error } = useLive(
    () => (sport ? fetchTeamSchedule(sport, slug, teamId) : Promise.reject(new Error('Deporte no encontrado'))),
    [sportId, slug, teamId],
    (d) => (d?.games.some((g) => g.state === 'in') ? 10000 : 120000),
  )
  if (!sport) return <p className="empty">Deporte no encontrado.</p>
  if (loading && !data) return <div className="skeleton-page" />
  if (!data) return <p className="error">No se pudo cargar el equipo. {error}</p>

  const { team, games } = data
  const key = `${sport.id}:${teamId}`
  const fav = favs.teams.some((t) => t.key === key)
  const live = games.filter((g) => g.state === 'in')
  const upcoming = games.filter((g) => g.state === 'pre')
  const results = games.filter((g) => g.state === 'post').reverse()
  const next = upcoming[0]
  const form = results.slice(0, 5).map((g) => {
    const me = g.home.id === teamId ? g.home : g.away
    const other = g.home.id === teamId ? g.away : g.home
    return me.winner ? 'W' : other.winner ? 'L' : 'D'
  })

  return (
    <div className="team-page" style={{ ['--acc' as any]: sport.accent, ['--tc' as any]: team.color }}>
      <div className="crumbs">
        <Link to={`/deporte/${sport.id}`}>← {sport.name}</Link>
      </div>
      <header className="team-hero">
        <TeamLogo team={{ logo: team.logo, abbr: team.abbr, color: team.color }} size={80} />
        <div>
          <h1>{team.name}</h1>
          <p className="muted">{[team.standing, team.record].filter(Boolean).join(' · ')}</p>
          {form.length > 0 && (
            <div className="form-inline">
              {form.map((f, i) => (
                <i key={i} className={`form ${f}`}>{f === 'W' ? 'G' : f === 'L' ? 'P' : 'E'}</i>
              ))}
              <small className="muted">últimos {form.length}</small>
            </div>
          )}
        </div>
        <div className={`follow ${fav ? 'on' : ''}`}>
          <Star on={fav} onToggle={() => toggleTeam({ key, sportId: sport.id, slug, id: teamId, name: team.name, logo: team.logo })} />
          {fav ? 'Siguiendo' : 'Seguir'}
        </div>
      </header>

      {live.length > 0 && (
        <section className="league-block">
          <header className="lb-head"><span className="lb-link"><span className="dot" /> En vivo</span></header>
          {live.map((g) => <GameRow key={g.id} g={g} />)}
        </section>
      )}

      {next && (
        <div className="next-match card">
          <small className="muted">Próximo partido · {next.leagueName}</small>
          <div className="nm-teams">
            <span><TeamLogo team={next.away} size={36} /> {next.away.short}</span>
            <b>vs</b>
            <span>{next.home.short} <TeamLogo team={next.home} size={36} /></span>
          </div>
          <p>{fmtDay(next.date)} · {fmtTime(next.date)}</p>
          <Countdown to={next.date} />
        </div>
      )}

      <div className="two-col">
        <section className="league-block">
          <header className="lb-head"><span className="lb-link">Próximos ({upcoming.length})</span></header>
          {upcoming.length ? upcoming.slice(0, 15).map((g) => <GameRow key={g.id} g={g} />) : <p className="empty sm">Sin partidos programados.</p>}
        </section>
        <section className="league-block">
          <header className="lb-head"><span className="lb-link">Resultados ({results.length})</span></header>
          {results.length ? results.slice(0, 15).map((g) => <GameRow key={g.id} g={g} />) : <p className="empty sm">Sin resultados aún.</p>}
        </section>
      </div>
    </div>
  )
}
