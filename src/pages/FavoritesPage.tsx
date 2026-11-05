import { Link } from 'react-router-dom'
import { getSport } from '../api/catalog'
import { fetchTeamSchedule, fmtShort, fmtTime, type Game } from '../api/espn'
import { useLive } from '../hooks/useLive'
import { toggleGame, toggleLeague, toggleTeam, useFavs, type FavTeam } from '../store/favorites'
import GameRow, { TeamLogo } from '../components/GameCard'
import { LeagueLogo } from '../components/Sidebar'
import Star from '../components/Star'
import { BellButton } from '../components/LiveAlerts'

/** Mi panel: lo que juegan hoy y próximamente tus equipos, tus ligas y tus partidos guardados. */
export default function FavoritesPage() {
  const favs = useFavs()
  const teamKey = favs.teams.map((t) => t.key).join(',')
  const { data, loading } = useLive(
    async () => {
      const res = await Promise.allSettled(
        favs.teams.map(async (t: FavTeam) => {
          const sport = getSport(t.sportId)!
          const { games } = await fetchTeamSchedule(sport, t.slug, t.id)
          return {
            team: t,
            live: games.find((g) => g.state === 'in'),
            next: games.find((g) => g.state === 'pre'),
            last: [...games].reverse().find((g) => g.state === 'post'),
          }
        }),
      )
      return res.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
    },
    [teamKey],
    (d) => (d?.some((x) => x.live) ? 15000 : 120000),
  )

  const empty = !favs.teams.length && !favs.leagues.length && !favs.games.length
  const liveNow: Game[] = (data || []).flatMap((x) => (x.live ? [x.live] : []))

  return (
    <div className="fav-page">
      <div className="sp-head">
        <h1>★ Mis favoritos</h1>
        <span className="muted sm">
          Alertas de goles, inicio y final <BellButton />
        </span>
      </div>

      {empty && (
        <div className="empty card">
          <p style={{ fontSize: 40, margin: 0 }}>☆</p>
          <h3>Aún no tienes favoritos</h3>
          <p>Toca la ★ en cualquier liga, equipo o partido. Aquí verás lo que juegan, con alertas en tiempo real mientras la app esté abierta.</p>
          <Link to="/" className="btn primary">Explorar partidos</Link>
        </div>
      )}

      {liveNow.length > 0 && (
        <section className="league-block">
          <header className="lb-head"><span className="lb-link"><span className="dot" /> Tus equipos en vivo</span></header>
          {liveNow.map((g) => <GameRow key={g.id} g={g} />)}
        </section>
      )}

      {favs.teams.length > 0 && (
        <section>
          <h2 className="sec-title">Equipos que sigues</h2>
          <div className="fav-teams">
            {favs.teams.map((t) => {
              const info = data?.find((x) => x.team.key === t.key)
              const sport = getSport(t.sportId)
              return (
                <Link key={t.key} to={`/equipo/${t.sportId}/${t.slug}/${t.id}`} className="fav-team card">
                  <div className="ft-head">
                    <TeamLogo team={{ logo: t.logo, abbr: t.name.slice(0, 3), color: '#334155' }} size={36} />
                    <div>
                      <b>{t.name}</b>
                      <small className="muted">{sport?.emoji} {sport?.name}</small>
                    </div>
                    <Star on onToggle={() => toggleTeam(t)} />
                  </div>
                  {loading && !data ? (
                    <div className="shimmer-line" />
                  ) : (
                    <>
                      {info?.next && (
                        <p className="ft-line">
                          <em>Próximo</em> {info.next.away.short} vs {info.next.home.short} · {fmtShort(info.next.date)} {fmtTime(info.next.date)}
                        </p>
                      )}
                      {info?.last && (
                        <p className="ft-line">
                          <em>Último</em> {info.last.away.short} {info.last.away.score}-{info.last.home.score} {info.last.home.short}
                        </p>
                      )}
                    </>
                  )}
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {favs.leagues.length > 0 && (
        <section>
          <h2 className="sec-title">Ligas</h2>
          <div className="chips wrap">
            {favs.leagues.map((l) => (
              <Link key={l.key} to={`/liga/${l.sportId}/${l.slug}`} className="chip-link">
                <LeagueLogo l={l} size={18} /> {l.name}
                <Star size={14} on onToggle={() => toggleLeague(l)} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {favs.games.length > 0 && (
        <section>
          <h2 className="sec-title">Partidos guardados</h2>
          <div className="league-block">
            {[...favs.games]
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((g) => (
                <Link key={g.key} to={g.href} className="grow">
                  <span className="rs pre">
                    <b>{fmtTime(new Date(g.date))}</b>
                    <small>{fmtShort(new Date(g.date))}</small>
                  </span>
                  <div className="rbody">
                    <span className="rn">{getSport(g.sportId)?.emoji} {g.label}</span>
                  </div>
                  <Star on onToggle={() => toggleGame(g)} />
                </Link>
              ))}
          </div>
        </section>
      )}
    </div>
  )
}
