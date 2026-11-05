import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useLeague } from '../api/catalog'
import { fetchScoreboardEvent, fmtDay, fmtTime, normalizeScoreboardEvent, parseIsoDay } from '../api/espn'
import { useLive } from '../hooks/useLive'
import GameRow from '../components/GameCard'
import Updated from '../components/Updated'

/** Eventos de varios enfrentamientos (tenis, MMA) o de clasificación (golf, automovilismo). */
export default function EventPage() {
  const { sportId, slug, eventId = '' } = useParams()
  const [sp] = useSearchParams()
  const found = useLeague(sportId, slug)
  const day = sp.get('d') ? parseIsoDay(sp.get('d')!) : new Date()
  const highlight = sp.get('c')
  const [session, setSession] = useState<number>()

  const { data, loading, updatedAt } = useLive(
    () => (found ? fetchScoreboardEvent(found.league, eventId, day) : Promise.resolve(undefined)),
    [sportId, slug, eventId, sp.get('d')],
    (e: any) => (e?.status?.type?.state === 'in' || e?.competitions?.some((c: any) => c.status?.type?.state === 'in') ? 8000 : 60000),
  )

  if (!found) return <p className="empty">Competencia no encontrada.</p>
  if (loading && !data) return <div className="skeleton-page" />
  if (!data) return <p className="empty">No se encontró el evento para esa fecha.</p>
  const { sport, league } = found
  const e = data
  const live = e.status?.type?.state === 'in'

  return (
    <div className="event-page" style={{ ['--acc' as any]: sport.accent }}>
      <div className="crumbs">
        <Link to={`/liga/${sport.id}/${league.slug}`}>← {league.name}</Link>
        <Updated at={updatedAt} live={live} />
      </div>
      <header className="league-hero">
        <span className="big-emoji">{sport.emoji}</span>
        <div>
          <h1>{e.name}</h1>
          <p className="muted">
            {fmtDay(new Date(e.date))} · {fmtTime(new Date(e.date))}
            {e.venue?.displayName ? ` · ${e.venue.displayName}` : ''}
          </p>
          <p className={`sb-status ${e.status?.type?.state}`}>
            {live && <span className="dot" />} {e.status?.type?.detail}
          </p>
        </div>
      </header>

      {sport.mode === 'leaderboard' ? (
        <Leaderboard e={e} session={session} setSession={setSession} />
      ) : (
        <section className="league-block">
          {normalizeScoreboardEvent(e, league, sport)
            .sort((a, b) => (a.state === 'in' ? -1 : 0) - (b.state === 'in' ? -1 : 0) || a.date.getTime() - b.date.getTime())
            .map((g) => (
              <div key={g.id} className={highlight && g.id.endsWith(`~${highlight}`) ? 'hl-row' : ''}>
                <GameRow g={g} />
              </div>
            ))}
        </section>
      )}
    </div>
  )
}

function Leaderboard({ e, session, setSession }: { e: any; session?: number; setSession: (n: number) => void }) {
  const comps: any[] = (e.competitions || []).filter((c: any) => c.competitors?.length)
  if (!comps.length) return <p className="empty">La clasificación aparecerá cuando comience la competencia.</p>
  const liveIdx = comps.findIndex((c) => c.status?.type?.state === 'in')
  const idx = session ?? (liveIdx >= 0 ? liveIdx : comps.length - 1)
  const c = comps[Math.min(idx, comps.length - 1)]
  const rows = [...c.competitors].sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
  const rounds = Math.max(0, ...rows.map((r) => r.linescores?.length ?? 0))
  return (
    <>
      {comps.length > 1 && (
        <div className="chips">
          {comps.map((x, i) => (
            <button key={x.id} className={i === idx ? 'on' : ''} onClick={() => setSession(i)}>
              {x.status?.type?.state === 'in' && <span className="dot" />} {x.type?.abbreviation || x.type?.text || `Sesión ${i + 1}`}
            </button>
          ))}
        </div>
      )}
      <div className="card table-wrap">
        <table className="standings">
          <thead>
            <tr>
              <th>Pos</th>
              <th>Competidor</th>
              {Array.from({ length: rounds }).map((_, i) => (
                <th key={i}>R{i + 1}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id ?? i}>
                <td>{r.status?.position?.displayName ?? r.order ?? i + 1}</td>
                <td>
                  <span className="st-team">
                    {r.athlete?.flag?.href && <img src={r.athlete.flag.href} alt="" width={18} height={12} loading="lazy" />}
                    {r.athlete?.displayName || r.team?.displayName}
                  </span>
                </td>
                {Array.from({ length: rounds }).map((_, k) => (
                  <td key={k}>{r.linescores?.[k]?.displayValue ?? r.linescores?.[k]?.value ?? ''}</td>
                ))}
                <td className="pts">{r.score?.displayValue ?? r.score ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
