import type { FieldKind, Game } from '../api/espn'

/** Alineaciones: en fútbol se dibujan sobre la cancha según la formación; en el resto, titulares y banca. */
export default function Lineups({ kind, game, summary }: { kind: FieldKind; game: Game; summary: any }) {
  if (kind === 'soccer') return <SoccerLineups game={game} summary={summary} />
  const groups: any[] = summary.boxscore?.players || []
  if (!groups.length) return <p className="empty">Las alineaciones se publican poco antes del inicio del partido.</p>
  return (
    <div className="lineup-cols">
      {groups.map((t) => {
        const st = t.statistics?.[0]
        const athletes: any[] = st?.athletes || []
        const starters = athletes.filter((a) => a.starter)
        const bench = athletes.filter((a) => !a.starter)
        const isHome = t.team?.id === game.home.id
        return (
          <div key={t.team?.id} className="card lineup" style={{ ['--tc' as any]: isHome ? game.home.color : game.away.color }}>
            <h3>{t.team?.displayName}</h3>
            {(starters.length ? [['Titulares', starters], ['Banca', bench]] : [['Jugadores', athletes]]).map(([label, list]: any) =>
              list.length ? (
                <div key={label}>
                  <h4>{label}</h4>
                  <ul>
                    {list.map((a: any) => (
                      <li key={a.athlete?.id} className={a.didNotPlay ? 'dnp' : ''}>
                        <span className="jersey">{a.athlete?.jersey ?? a.batOrder ?? ''}</span>
                        {a.athlete?.headshot?.href && <img src={a.athlete.headshot.href} alt="" loading="lazy" />}
                        <span>{a.athlete?.displayName}</span>
                        <small className="muted">{a.athlete?.position?.abbreviation || a.position?.abbreviation}</small>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ---------- Fútbol: formación sobre la cancha ---------- */

// Profundidad (portería → ataque) y lado (izq/der) a partir de la posición.
function depth(abbr = '') {
  const a = abbr.toUpperCase()
  if (a === 'G' || a === 'GK') return 0
  if (/^(CD|CB|SW|D|LB|RB|LWB|RWB)/.test(a)) return /WB/.test(a) ? 1.5 : 1
  if (/^(DM|CDM)/.test(a)) return 2
  if (/^(CM|M|LM|RM)/.test(a)) return 3
  if (/^(AM|CAM)/.test(a)) return 4
  if (/^(LW|RW)/.test(a)) return 4.5
  return 5
}
function lateral(abbr = '') {
  const a = abbr.toUpperCase()
  if (/-L$/.test(a)) return -0.5
  if (/-R$/.test(a)) return 0.5
  if (/^L/.test(a)) return -1
  if (/^R/.test(a)) return 1
  return 0
}

function placeTeam(roster: any, home: boolean) {
  const starters: any[] = (roster?.roster || []).filter((p: any) => p.starter)
  const lines: number[] = String(roster?.formation || '4-4-2').split('-').map(Number).filter(Boolean)
  const gk = starters.filter((p) => depth(p.position?.abbreviation) === 0)
  const field = starters
    .filter((p) => depth(p.position?.abbreviation) !== 0)
    .sort((a, b) => depth(a.position?.abbreviation) - depth(b.position?.abbreviation) || Number(a.formationPlace) - Number(b.formationPlace))
  const out: { p: any; x: number; y: number }[] = []
  gk.slice(0, 1).forEach((p) => out.push({ p, x: 4, y: 34 }))
  let idx = 0
  const total = lines.length
  lines.forEach((n, li) => {
    const row = field.slice(idx, idx + n).sort((a, b) => lateral(a.position?.abbreviation) - lateral(b.position?.abbreviation))
    idx += n
    const x = 12 + ((li + 1) / (total + 0.4)) * 36
    row.forEach((p, i) => {
      // lateral izquierdo arriba (y pequeño) mirando hacia el ataque del local (derecha)
      const y = ((i + 1) / (row.length + 1)) * 68
      out.push({ p, x, y })
    })
  })
  field.slice(idx).forEach((p, i) => out.push({ p, x: 50, y: 10 + i * 8 }))
  // Calculado para un equipo que defiende la izquierda (local). El visitante se rota 180°.
  return home ? out : out.map((o) => ({ ...o, x: 105 - o.x, y: 68 - o.y }))
}

function SoccerLineups({ game, summary }: { game: Game; summary: any }) {
  const rosters: any[] = summary.rosters || []
  const home = rosters.find((r) => r.homeAway === 'home')
  const away = rosters.find((r) => r.homeAway === 'away')
  const hasStarters = rosters.some((r) => r.roster?.some((p: any) => p.starter))
  if (!hasStarters) return <p className="empty">Las alineaciones se confirman aprox. 1 hora antes del inicio.</p>

  // El local defiende la izquierda (ataca a la derecha) en el dibujo.
  const pts = [
    ...placeTeam(home, true).map((o) => ({ ...o, c: game.home.color })),
    ...placeTeam(away, false).map((o) => ({ ...o, c: game.away.color })),
  ]

  return (
    <div className="lineups-soccer">
      <div className="formations">
        <span>
          {game.home.abbr} <b>{home?.formation}</b>
        </span>
        <span>
          <b>{away?.formation}</b> {game.away.abbr}
        </span>
      </div>
      <svg viewBox="-2 -2 109 72" className="field soccer lineup-pitch">
        <rect x="-2" y="-2" width="109" height="72" fill="#0b6b3a" />
        {Array.from({ length: 10 }).map((_, i) => (
          <rect key={i} x={i * 10.5} y="0" width="5.25" height="68" fill="#0e7a43" />
        ))}
        <g fill="none" stroke="#ffffffaa" strokeWidth="0.35">
          <rect x="0" y="0" width="105" height="68" />
          <line x1="52.5" y1="0" x2="52.5" y2="68" />
          <circle cx="52.5" cy="34" r="9.15" />
          <rect x="0" y="13.85" width="16.5" height="40.3" />
          <rect x="88.5" y="13.85" width="16.5" height="40.3" />
        </g>
        {pts.map(({ p, x, y, c }, i) => (
          <g key={p.athlete?.id ?? i} transform={`translate(${x} ${y})`} className="player" style={{ animationDelay: `${i * 25}ms` }}>
            <circle r="2.9" fill={c} stroke="#fff" strokeWidth="0.4" />
            <text y="1" textAnchor="middle" className="pnum">{p.jersey}</text>
            <text y="5.6" textAnchor="middle" className="pname">
              {(p.athlete?.lastName || p.athlete?.shortName || '').slice(0, 14)}
            </text>
            {p.subbedOut && <text x="2.8" y="-2" className="psub">↓</text>}
          </g>
        ))}
      </svg>
      <div className="lineup-cols">
        {[home, away].map((r) =>
          r ? (
            <div key={r.team?.id} className="card lineup">
              <h3>{r.team?.displayName} · Suplentes</h3>
              <ul>
                {r.roster
                  .filter((p: any) => !p.starter)
                  .map((p: any) => (
                    <li key={p.athlete?.id}>
                      <span className="jersey">{p.jersey}</span>
                      <span>{p.athlete?.displayName}</span>
                      <small className="muted">{p.position?.abbreviation}</small>
                      {p.subbedIn && <small className="in">↑ entró</small>}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null,
        )}
      </div>
    </div>
  )
}
