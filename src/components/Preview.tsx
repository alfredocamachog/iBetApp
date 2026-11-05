import type { Game } from '../api/espn'
import { fmtDay, fmtTime } from '../api/espn'
import { TeamLogo } from './GameCard'

const stripHtml = (html: string) =>
  html
    .replace(/<(script|style|iframe)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/p>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)

/** Previa: contexto, horario exacto local, momios, forma reciente, líderes y bajas. */
export default function Preview({ game, summary }: { game: Game; summary: any }) {
  const art = summary.article
  const norm = (x = '') => x.replace(/^[—\-\s]+/, '').trim()
  const paragraphs = art?.story
    ? stripHtml(art.story).filter((p) => norm(p) !== norm(art.description) && !norm(p).endsWith(norm(art.description))).slice(0, 8)
    : []
  const gi = summary.gameInfo || {}
  const pick = summary.pickcenter?.[0]
  const leaders: any[] = summary.leaders || []
  const lastFive: any[] = summary.lastFiveGames || []
  const injuries: any[] = summary.injuries || []
  const series = summary.seasonseries?.[0]

  return (
    <div className="preview">
      <div className="pv-main">
        {art ? (
          <article className="card">
            <h2>{art.headline}</h2>
            {art.description && <p className="lead">{norm(art.description)}</p>}
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </article>
        ) : (
          <article className="card">
            <h2>
              {game.away.name} vs {game.home.name}
            </h2>
            <p className="lead">
              {game.state === 'pre' ? 'Se juega el' : 'Se jugó el'} {fmtDay(game.date)} a las {fmtTime(game.date)} (tu hora local).
            </p>
          </article>
        )}

        {leaders.length > 0 && (
          <div className="card">
            <h3>Jugadores a seguir</h3>
            <div className="leaders">
              {leaders.map((t: any) => (
                <div key={t.team?.id} className="leader-col">
                  <h4>
                    <TeamLogo team={{ logo: t.team?.logo, abbr: t.team?.abbreviation, color: '#334' }} size={20} /> {t.team?.displayName}
                  </h4>
                  {(t.leaders || []).slice(0, 4).map((cat: any) => {
                    const l = cat.leaders?.[0]
                    if (!l) return null
                    return (
                      <div key={cat.name} className="leader">
                        {l.athlete?.headshot?.href && <img src={l.athlete.headshot.href} alt="" loading="lazy" />}
                        <div>
                          <small>{cat.displayName}</small>
                          <strong>{l.athlete?.shortName || l.athlete?.displayName}</strong>
                          <span className="muted">{l.displayValue}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {lastFive.length > 0 && (
          <div className="card">
            <h3>Forma reciente</h3>
            {lastFive.map((t: any) => (
              <div key={t.team?.id} className="form-row">
                <span>{t.team?.displayName}</span>
                <div>
                  {(t.events || []).map((e: any) => (
                    <i key={e.id} className={`form ${e.gameResult}`} title={`${e.atVs} ${e.opponent?.displayName} ${e.score}`}>
                      {e.gameResult === 'W' ? 'G' : e.gameResult === 'L' ? 'P' : 'E'}
                    </i>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <aside className="pv-side">
        <div className="card info">
          <h3>Datos del partido</h3>
          <dl>
            <dt>Fecha</dt>
            <dd>{fmtDay(game.date)}</dd>
            <dt>Hora local</dt>
            <dd>{fmtTime(game.date)}</dd>
            {gi.venue?.fullName && (
              <>
                <dt>Estadio</dt>
                <dd>
                  {gi.venue.fullName}
                  {gi.venue.address?.city ? `, ${gi.venue.address.city}` : ''}
                </dd>
              </>
            )}
            {gi.weather && (
              <>
                <dt>Clima</dt>
                <dd>
                  {gi.weather.temperature}°{gi.weather.displayValue ? ` · ${gi.weather.displayValue}` : ''}
                </dd>
              </>
            )}
            {gi.officials?.[0] && (
              <>
                <dt>Árbitro</dt>
                <dd>{gi.officials[0].displayName}</dd>
              </>
            )}
            {game.broadcast && (
              <>
                <dt>TV</dt>
                <dd>{game.broadcast}</dd>
              </>
            )}
            {gi.attendance > 0 && (
              <>
                <dt>Asistencia</dt>
                <dd>{gi.attendance.toLocaleString('es-MX')}</dd>
              </>
            )}
          </dl>
        </div>

        {pick && (
          <div className="card odds">
            <h3>Momios {pick.provider?.name ? <small className="muted">· {pick.provider.name}</small> : null}</h3>
            {pick.details && <p className="big">{pick.details}</p>}
            <dl>
              {pick.overUnder !== undefined && (
                <>
                  <dt>Total (O/U)</dt>
                  <dd>{pick.overUnder}</dd>
                </>
              )}
              {pick.awayTeamOdds?.moneyLine !== undefined && (
                <>
                  <dt>{game.away.abbr} ML</dt>
                  <dd>{fmtMl(pick.awayTeamOdds.moneyLine)}</dd>
                </>
              )}
              {pick.homeTeamOdds?.moneyLine !== undefined && (
                <>
                  <dt>{game.home.abbr} ML</dt>
                  <dd>{fmtMl(pick.homeTeamOdds.moneyLine)}</dd>
                </>
              )}
              {pick.drawOdds?.moneyLine !== undefined && (
                <>
                  <dt>Empate</dt>
                  <dd>{fmtMl(pick.drawOdds.moneyLine)}</dd>
                </>
              )}
            </dl>
            <p className="muted sm">Solo informativo.</p>
          </div>
        )}

        {series && (
          <div className="card">
            <h3>Serie de la temporada</h3>
            <p>{series.summary || series.description}</p>
          </div>
        )}

        {injuries.some((t: any) => t.injuries?.length) && (
          <div className="card">
            <h3>Bajas y lesiones</h3>
            {injuries.map((t: any) =>
              t.injuries?.length ? (
                <div key={t.team?.id} className="inj">
                  <h4>{t.team?.displayName}</h4>
                  {t.injuries.slice(0, 8).map((i: any, n: number) => (
                    <p key={n}>
                      <strong>{i.athlete?.shortName || i.athlete?.displayName}</strong> <span className="muted">{i.status}</span>
                    </p>
                  ))}
                </div>
              ) : null,
            )}
          </div>
        )}
      </aside>
    </div>
  )
}

const fmtMl = (v: number) => (v > 0 ? `+${v}` : `${v}`)
