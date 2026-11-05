import type { Game } from '../api/espn'

/** Comparativa de estadísticas por equipo + tablas por jugador. */
export default function Stats({ game, summary }: { game: Game; summary: any }) {
  const teams: any[] = summary.boxscore?.teams || []
  const home = teams.find((t) => t.team?.id === game.home.id) || teams[1]
  const away = teams.find((t) => t.team?.id === game.away.id) || teams[0]
  const rows = (home?.statistics || [])
    .map((s: any) => ({
      label: s.label || s.displayName || s.name,
      h: s.displayValue,
      a: away?.statistics?.find((x: any) => x.name === s.name)?.displayValue,
    }))
    .filter((r: any) => r.h !== undefined && r.a !== undefined)

  const players: any[] = summary.boxscore?.players || []

  if (!rows.length && !players.length) return <p className="empty">Las estadísticas estarán disponibles cuando inicie el partido.</p>

  return (
    <div className="stats">
      {rows.length > 0 && (
        <div className="card">
          <div className="cmp-head">
            <b style={{ color: game.away.color }}>{game.away.abbr}</b>
            <span>Equipo</span>
            <b style={{ color: game.home.color }}>{game.home.abbr}</b>
          </div>
          {rows.map((r: any) => {
            const a = parseFloat(r.a)
            const h = parseFloat(r.h)
            const tot = a + h
            const pa = tot > 0 && !isNaN(tot) ? (a / tot) * 100 : 50
            return (
              <div key={r.label} className="cmp">
                <span>{r.a}</span>
                <div>
                  <small>{r.label}</small>
                  <div className="cmp-bar">
                    <i style={{ width: `${pa}%`, background: 'var(--away)' }} />
                    <i style={{ width: `${100 - pa}%`, background: 'var(--home)' }} />
                  </div>
                </div>
                <span>{r.h}</span>
              </div>
            )
          })}
        </div>
      )}

      {players.map((t: any) => (
        <div key={t.team?.id} className="card">
          <h3>{t.team?.displayName}</h3>
          {(t.statistics || []).map((g: any, gi: number) =>
            g.athletes?.length ? (
              <div key={gi} className="table-wrap">
                {g.name && <h4>{g.text || g.name}</h4>}
                <table>
                  <thead>
                    <tr>
                      <th>Jugador</th>
                      {(g.labels || []).map((l: string) => (
                        <th key={l}>{l}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {g.athletes.map((a: any) => (
                      <tr key={a.athlete?.id} className={a.starter ? 'starter' : ''}>
                        <td>
                          {a.athlete?.jersey && <em>#{a.athlete.jersey}</em>} {a.athlete?.shortName || a.athlete?.displayName}
                        </td>
                        {(a.stats || []).map((v: string, i: number) => (
                          <td key={i}>{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null,
          )}
        </div>
      ))}
    </div>
  )
}
