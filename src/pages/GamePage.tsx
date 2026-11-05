import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLeague } from '../api/catalog'
import { fetchSituation, fetchSummary, fmtDay, fmtTime, gameHref, normalizeEvent, type Game } from '../api/espn'
import { useLive } from '../hooks/useLive'
import { Score, TeamFavStar, TeamLogo } from '../components/GameCard'
import Updated from '../components/Updated'
import Star from '../components/Star'
import LiveField from '../components/fields/LiveField'
import PlayFeed from '../components/PlayFeed'
import Preview from '../components/Preview'
import Lineups from '../components/Lineups'
import Stats from '../components/Stats'
import { toggleGame, useFavs } from '../store/favorites'

/** Ritmo de refresco durante el partido en vivo (la cancha reparte las jugadas nuevas en este lapso). */
const LIVE_POLL_MS = 5000

type Tab = 'vivo' | 'previa' | 'alineaciones' | 'stats'

/** Descarga un .ics para agregar el partido a cualquier calendario. */
function downloadIcs(g: Game, league: string) {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const end = new Date(g.date.getTime() + 2.5 * 3600 * 1000)
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//iBet Live//ES', 'BEGIN:VEVENT',
    `UID:${g.sportId}-${g.id}@ibet.live`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(g.date)}`, `DTEND:${f(end)}`,
    `SUMMARY:${g.away.name} vs ${g.home.name}`, `DESCRIPTION:${league}`, `LOCATION:${g.venue ?? ''}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join(String.fromCharCode(13, 10))
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  a.download = `${g.away.abbr}-vs-${g.home.abbr}.ics`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export default function GamePage() {
  const { sportId, slug, gameId } = useParams()
  const found = useLeague(sportId, slug)
  const favs = useFavs()
  const [tab, setTab] = useState<Tab>()
  const [copied, setCopied] = useState(false)

  const { data, error, loading, updatedAt } = useLive(
    async () => {
      if (!found) throw new Error('Liga no encontrada')
      const summary = await fetchSummary(found.league, gameId!)
      const hc = summary.header?.competitions?.[0]
      const game: Game = normalizeEvent({ ...summary.header, id: gameId, competitions: [hc], date: hc?.date }, found.league)
      // El estado de jugada (down/yardas, bases/cuenta) viene en el scoreboard
      if (game.state === 'in' && (found.sport.field === 'football' || found.sport.field === 'baseball')) {
        const sb = await fetchSituation(found.league, gameId!, game.date).catch(() => undefined)
        if (sb) {
          game.situation = summary.situation ?? sb.situation
          game.statusText = sb.statusText || game.statusText
        }
      }
      return { summary, game }
    },
    [sportId, slug, gameId, found?.loaded],
    (d) => (d?.game.state === 'in' ? LIVE_POLL_MS : d?.game.state === 'pre' ? 30000 : 120000),
  )

  const game = data?.game
  const summary = data?.summary
  const current: Tab = tab ?? (game?.state === 'pre' ? 'previa' : 'vivo')
  const winProb = useMemo(() => {
    const wp = summary?.winprobability
    return wp?.length ? wp[wp.length - 1].homeWinPercentage : undefined
  }, [summary])

  if (!found) return <p className="empty">Liga no encontrada.</p>
  if (loading && !data) return <div className="skeleton-page" />
  if (!game || !summary) return <p className="error">No se pudo cargar el partido. {error}</p>

  const { sport, league } = found
  const favKey = `${sport.id}:${game.id}`
  const isFav = favs.games.some((x) => x.key === favKey)
  const hasField = sport.field !== 'none'
  const share = async () => {
    const url = window.location.href
    const text = `${game.away.name} vs ${game.home.name}`
    if (navigator.share) await navigator.share({ title: text, url }).catch(() => undefined)
    else {
      await navigator.clipboard?.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }
  return (
    <div className="game-page" style={{ ['--acc' as any]: sport.accent, ['--home' as any]: game.home.color, ['--away' as any]: game.away.color }}>
      <div className="crumbs">
        <Link to={`/deporte/${sportId}`}>← {sport.name}</Link>
        <Link to={`/liga/${sport.id}/${league.slug}`}>{league.flag} {league.name}</Link>
        <Updated at={updatedAt} live={game.state === 'in'} />
      </div>
      <div className="game-actions">
        <Star
          on={isFav}
          onToggle={() => toggleGame({ key: favKey, sportId: sport.id, slug: league.slug, id: game.id, label: `${game.away.short} vs ${game.home.short}`, date: game.date.toISOString(), href: gameHref(game) })}
        />
        <span>{isFav ? 'Guardado en favoritos' : 'Guardar partido'}</span>
        {game.state === 'pre' && <button className="btn sm" onClick={() => downloadIcs(game, league.name)}>📅 Agregar al calendario</button>}
        <button className="btn sm" onClick={share}>{copied ? '✓ Enlace copiado' : '↗ Compartir'}</button>
      </div>

      <section className="scoreboard">
        <TeamBlock t={game.away} sportId={sport.id} slug={league.slug} />
        <div className="sb-center">
          {game.state === 'pre' ? (
            <>
              <div className="sb-time">{fmtTime(game.date)}</div>
              <small>{fmtDay(game.date)}</small>
            </>
          ) : (
            <div className="sb-score">
              <Score value={game.away.score} win={game.away.winner} />
              <span>–</span>
              <Score value={game.home.score} win={game.home.winner} />
            </div>
          )}
          <div className={`sb-status ${game.state}`}>
            {game.state === 'in' && <span className="dot" />}
            {game.statusText}
          </div>
          {game.venue && <small className="muted">{game.venue}</small>}
        </div>
        <TeamBlock t={game.home} sportId={sport.id} slug={league.slug} />
      </section>

      {winProb !== undefined && (
        <div className="winprob" title="Probabilidad de victoria">
          <span style={{ width: `${(1 - winProb) * 100}%`, background: 'var(--away)' }}>{game.away.abbr} {Math.round((1 - winProb) * 100)}%</span>
          <span style={{ width: `${winProb * 100}%`, background: 'var(--home)' }}>{Math.round(winProb * 100)}% {game.home.abbr}</span>
        </div>
      )}

      <div className="tabs">
        {(
          [
            ['vivo', game.state === 'post' ? 'Resumen' : 'En vivo'],
            ['previa', 'Previa'],
            ['alineaciones', 'Alineaciones'],
            ['stats', 'Estadísticas'],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button key={k} className={current === k ? 'on' : ''} onClick={() => setTab(k)}>
            {k === 'vivo' && game.state === 'in' && <span className="dot" />}
            {l}
          </button>
        ))}
      </div>

      <div className="tab-body" key={current}>
        {current === 'vivo' && (
          <div className={hasField ? 'live-layout' : ''}>
            {sport.field !== 'none' && <LiveField kind={sport.field} game={game} summary={summary} pollMs={LIVE_POLL_MS} />}
            <PlayFeed kind={sport.field} game={game} summary={summary} />
          </div>
        )}
        {current === 'previa' && <Preview game={game} summary={summary} />}
        {current === 'alineaciones' && <Lineups kind={sport.field} game={game} summary={summary} />}
        {current === 'stats' && <Stats game={game} summary={summary} />}
      </div>
    </div>
  )
}

function TeamBlock({ t, sportId, slug }: { t: Game['home']; sportId: string; slug: string }) {
  return (
    <div className={`sb-team ${t.homeAway}`}>
      <Link to={`/equipo/${sportId}/${slug}/${t.id}`} className="sb-team-link">
        <TeamLogo team={t} size={72} />
        <strong>{t.name}</strong>
      </Link>
      <TeamFavStar sportId={sportId} slug={slug} t={t} />
      <small className="muted">
        {t.homeAway === 'home' ? 'Local' : 'Visitante'}
        {t.record ? ` · ${t.record}` : ''}
      </small>
    </div>
  )
}
