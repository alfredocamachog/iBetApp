import { memo, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { fmtTime, gameHref, type Game, type TeamSide } from '../api/espn'
import { toggleGame, toggleTeam, useFavs } from '../store/favorites'
import Star from './Star'

export function TeamLogo({ team, size = 28 }: { team: Pick<TeamSide, 'logo' | 'abbr' | 'color'>; size?: number }) {
  const [err, setErr] = useState(false)
  if (!team.logo || err)
    return (
      <span className="tlogo-fallback" style={{ width: size, height: size, background: team.color }}>
        {team.abbr?.slice(0, 3)}
      </span>
    )
  return <img className="tlogo" src={team.logo} alt="" width={size} height={size} loading="lazy" decoding="async" onError={() => setErr(true)} />
}

/** Marcador que destella cuando cambia. */
export function Score({ value, win }: { value?: string; win?: boolean }) {
  const prev = useRef(value)
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (prev.current !== undefined && prev.current !== value) {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 1600)
      prev.current = value
      return () => clearTimeout(t)
    }
    prev.current = value
  }, [value])
  return <span className={`score ${flash ? 'flash' : ''} ${win ? 'win' : ''}`}>{value ?? '-'}</span>
}

export function StatusPill({ g }: { g: Game }) {
  if (g.state === 'in')
    return (
      <span className="pill live">
        <span className="dot" /> {g.statusText || 'En vivo'}
      </span>
    )
  if (g.state === 'post') return <span className="pill post">{g.statusText || 'Final'}</span>
  return <span className="pill pre">{fmtTime(g.date)}</span>
}

/** Columna de estado de la fila: hora, minuto en vivo o final. */
function StatusCell({ g }: { g: Game }) {
  if (g.state === 'in')
    return (
      <span className="rs live">
        <span className="dot" />
        <b>{g.clock && g.clock !== '0:00' && g.clock !== "0'" ? g.clock : g.statusText}</b>
        {g.clock && g.statusText && <small>{g.statusText.replace(g.clock, '').trim().slice(0, 12)}</small>}
      </span>
    )
  if (g.state === 'post')
    return (
      <span className="rs post">
        <b>{/FT|Final/i.test(g.statusText) ? 'Final' : g.statusText.slice(0, 10)}</b>
        <small>{fmtTime(g.date)}</small>
      </span>
    )
  return (
    <span className="rs pre">
      <b>{fmtTime(g.date)}</b>
      {/Postp|Canc|Susp|Delay/i.test(g.statusText) && <small className="warn">{g.statusText}</small>}
    </span>
  )
}

function SideLine({ t, g }: { t: TeamSide; g: Game }) {
  const favs = useFavs()
  const lost = g.state === 'post' && t.winner === false
  const isFav = favs.teams.some((x) => x.key === `${g.sportId}:${t.id}`)
  return (
    <div className={`rl ${lost ? 'lost' : ''} ${t.winner ? 'won' : ''}`}>
      <TeamLogo team={t} size={20} />
      <span className="rn">
        {t.short || t.name}
        {isFav && <i className="fav-dot" title="Equipo favorito">★</i>}
      </span>
      {t.linescores && t.linescores.length > 0 && (
        <span className="sets">
          {t.linescores.map((s, i) => (
            <i key={i}>{s}</i>
          ))}
        </span>
      )}
      {g.state !== 'pre' && !t.athlete && <Score value={t.score} win={t.winner} />}
    </div>
  )
}

function GameRow({ g }: { g: Game }) {
  const favs = useFavs()
  const key = `${g.sportId}:${g.id}`
  const fav = favs.games.some((x) => x.key === key)
  const href = gameHref(g)

  if (g.kind === 'leaderboard')
    return (
      <Link to={href} className={`grow lb state-${g.state}`}>
        <StatusCell g={g} />
        <div className="rbody">
          <div className="lb-title">{g.eventName}</div>
          {g.note && <small className="muted">{g.note}</small>}
          {g.leaders && g.leaders.length > 0 && (
            <ol className="lb-top">
              {g.leaders.slice(0, 3).map((l, i) => (
                <li key={i}>
                  <em>{l.pos}</em>
                  {l.flag && <img src={l.flag} alt="" width={14} height={10} loading="lazy" />}
                  <span>{l.name}</span>
                  {l.score && <b>{l.score}</b>}
                </li>
              ))}
            </ol>
          )}
        </div>
        <Star on={fav} onToggle={() => toggleGame({ key, sportId: g.sportId, slug: g.leagueSlug, id: g.id, label: g.eventName || '', date: g.date.toISOString(), href })} />
      </Link>
    )

  return (
    <Link to={href} className={`grow state-${g.state}`}>
      <StatusCell g={g} />
      <div className="rbody">
        <SideLine t={g.away} g={g} />
        <SideLine t={g.home} g={g} />
        {(g.note || g.situation?.downDistanceText) && (
          <small className="rnote">{g.situation?.downDistanceText && g.state === 'in' ? g.situation.downDistanceText : g.note}</small>
        )}
      </div>
      <Star
        on={fav}
        onToggle={() =>
          toggleGame({ key, sportId: g.sportId, slug: g.leagueSlug, id: g.id, label: `${g.away.short} vs ${g.home.short}`, date: g.date.toISOString(), href })
        }
      />
    </Link>
  )
}

export default memo(GameRow, (a, b) => JSON.stringify(a.g) === JSON.stringify(b.g))

/** Para enlazar a la página de un equipo con estrella incluida. */
export function TeamFavStar({ sportId, slug, t }: { sportId: string; slug: string; t: TeamSide }) {
  const favs = useFavs()
  const key = `${sportId}:${t.id}`
  return (
    <Star
      on={favs.teams.some((x) => x.key === key)}
      onToggle={() => toggleTeam({ key, sportId, slug, id: t.id, name: t.name, logo: t.logo })}
      title="Seguir equipo"
    />
  )
}
