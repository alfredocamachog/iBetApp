import { useMemo, type ReactNode } from 'react'
import type { FieldKind, Game } from '../../api/espn'
import { buildTrack, HOME_PLATE } from './track'
import { BallLayer, TrackerBar, useBallPlayback } from './BallTracker'

interface P {
  game: Game
  summary: any
  ball: ReactNode
}

/** Cancha en vivo: el balón se mueve por las posiciones reales de cada jugada, en orden. */
export default function LiveField({ kind, game, summary, pollMs }: { kind: Exclude<FieldKind, 'none'>; game: Game; summary: any; pollMs: number }) {
  const track = useMemo(() => buildTrack(kind, game, summary), [kind, summary]) // eslint-disable-line react-hooks/exhaustive-deps
  const live = game.state === 'in'
  const pb = useBallPlayback(track, live, pollMs)
  const scale = { soccer: 1, basketball: 0.9, football: 1, hockey: 1.6, baseball: 2.6 }[kind]
  const ball = <BallLayer pos={pb.pos} trail={pb.trail} game={game} style={kind} scale={scale} current={pb.current} />
  const F = { soccer: Soccer, basketball: Basketball, football: Football, baseball: Baseball, hockey: Hockey }[kind]
  return (
    <div className="field-card">
      <div className="field-legend">
        <span>
          <i style={{ background: game.away.color }} /> {game.away.abbr} (visitante)
        </span>
        <span>
          {game.home.abbr} (local) <i style={{ background: game.home.color }} />
        </span>
      </div>
      <F game={game} summary={summary} ball={ball} />
      <TrackerBar current={pb.current} live={live} replaying={pb.replaying} pending={pb.pending} onReplay={pb.replay} count={track.length} />
    </div>
  )
}

/* ============================== FÚTBOL ============================== */
function Soccer({ game, summary, ball }: P) {
  const poss = (summary.boxscore?.teams || []).map((t: any) => ({
    id: t.team?.id,
    v: parseFloat(t.statistics?.find((s: any) => s.name === 'possessionPct')?.displayValue),
  }))
  const hp = poss.find((p: any) => p.id === game.home.id)?.v
  return (
    <>
      <svg viewBox="-3 -3 111 74" className="field soccer">
        <rect x="-3" y="-3" width="111" height="74" fill="#0b6b3a" />
        {Array.from({ length: 10 }).map((_, i) => (
          <rect key={i} x={i * 10.5} y="0" width="5.25" height="68" fill="#0e7a43" />
        ))}
        <g fill="none" stroke="#ffffffcc" strokeWidth="0.4">
          <rect x="0" y="0" width="105" height="68" />
          <line x1="52.5" y1="0" x2="52.5" y2="68" />
          <circle cx="52.5" cy="34" r="9.15" />
          <rect x="0" y="13.85" width="16.5" height="40.3" />
          <rect x="88.5" y="13.85" width="16.5" height="40.3" />
          <rect x="0" y="24.85" width="5.5" height="18.3" />
          <rect x="99.5" y="24.85" width="5.5" height="18.3" />
          <path d="M16.5 26.7 A9.15 9.15 0 0 1 16.5 41.3" />
          <path d="M88.5 26.7 A9.15 9.15 0 0 0 88.5 41.3" />
          <rect x="-2" y="30.34" width="2" height="7.32" />
          <rect x="105" y="30.34" width="2" height="7.32" />
        </g>
        <circle cx="52.5" cy="34" r="0.5" fill="#fff" />
        <text x="26" y="66" className="fld-label">← {game.away.abbr} ataca</text>
        <text x="79" y="66" className="fld-label" textAnchor="end">{game.home.abbr} ataca →</text>
        {ball}
      </svg>
      {hp !== undefined && !isNaN(hp) && (
        <div className="possession">
          <span style={{ width: `${100 - hp}%`, background: game.away.color }}>{Math.round(100 - hp)}%</span>
          <span style={{ width: `${hp}%`, background: game.home.color }}>{Math.round(hp)}%</span>
          <em>Posesión</em>
        </div>
      )}
    </>
  )
}

/* ============================== BÁSQUETBOL ============================== */
function Basketball({ game, summary, ball }: P) {
  const plays: any[] = summary.plays || []
  const shots = plays
    .filter((p) => p.shootingPlay && p.coordinate && p.coordinate.x >= 0 && p.coordinate.x <= 50 && p.coordinate.y >= 0 && p.coordinate.y <= 47)
    .slice(-40)
  const pos = (p: any) =>
    p.team?.id === game.home.id ? { x: 94 - p.coordinate.y, y: p.coordinate.x } : { x: p.coordinate.y, y: 50 - p.coordinate.x }
  const color = (id?: string) => (id === game.home.id ? game.home.color : game.away.color)
  return (
    <>
      <svg viewBox="-2 -2 98 54" className="field basketball">
        <rect x="-2" y="-2" width="98" height="54" fill="#2a1a10" />
        <rect x="0" y="0" width="94" height="50" fill="#c8894f" />
        {Array.from({ length: 24 }).map((_, i) => (
          <line key={i} x1={i * 4} y1="0" x2={i * 4} y2="50" stroke="#b97a42" strokeWidth="0.15" />
        ))}
        <g fill="none" stroke="#fff" strokeWidth="0.3">
          <rect x="0" y="0" width="94" height="50" />
          <line x1="47" y1="0" x2="47" y2="50" />
          <circle cx="47" cy="25" r="6" />
          <rect x="0" y="17" width="19" height="16" fill="#0003" />
          <rect x="75" y="17" width="19" height="16" fill="#0003" />
          <path d="M19 19 A6 6 0 0 1 19 31" />
          <path d="M75 19 A6 6 0 0 0 75 31" />
          <path d="M0 3 H14 A23.75 23.75 0 0 1 14 47 H0" />
          <path d="M94 3 H80 A23.75 23.75 0 0 0 80 47 H94" />
          <circle cx="5.25" cy="25" r="0.75" stroke="#ff6b35" />
          <circle cx="88.75" cy="25" r="0.75" stroke="#ff6b35" />
          <line x1="4" y1="22" x2="4" y2="28" strokeWidth="0.5" />
          <line x1="90" y1="22" x2="90" y2="28" strokeWidth="0.5" />
        </g>
        {shots.map((p, i) => {
          const s = pos(p)
          const c = color(p.team?.id)
          return (
            <g key={p.id} transform={`translate(${s.x} ${s.y})`} opacity={0.2 + (0.5 * i) / shots.length}>
              {p.scoringPlay ? <circle r="0.8" fill={c} /> : <path d="M-0.7 -0.7 L0.7 0.7 M0.7 -0.7 L-0.7 0.7" stroke={c} strokeWidth="0.4" />}
            </g>
          )
        })}
        {ball}
      </svg>
      <p className="field-note">Fondo: últimos {shots.length} tiros (● encestado · ✕ fallado). {game.away.abbr} ataca ← · {game.home.abbr} ataca →</p>
    </>
  )
}

/* ============================== FÚTBOL AMERICANO ============================== */
function Football({ game, summary, ball }: P) {
  const sit = game.situation || summary.situation || {}
  let ballYd: number | undefined
  const m = /([A-Z]+)\s+(\d+)/.exec(sit.possessionText || '')
  if (m) ballYd = m[1] === game.home.abbr ? Number(m[2]) : 100 - Number(m[2])
  else if (sit.possessionText?.includes('50')) ballYd = 50
  const homeHasBall = sit.possession === game.home.id
  const firstDown = ballYd !== undefined && sit.distance ? ballYd + (homeHasBall ? 1 : -1) * sit.distance : undefined
  const drive = summary.drives?.current
  const X = (yd: number) => 10 + yd
  return (
    <>
      <svg viewBox="0 0 120 53.3" className="field football">
        <rect x="0" y="0" width="120" height="53.3" fill="#1f7a3a" />
        <rect x="0" y="0" width="10" height="53.3" fill={game.home.color} opacity="0.85" />
        <rect x="110" y="0" width="10" height="53.3" fill={game.away.color} opacity="0.85" />
        <text x="5" y="26.6" className="ez" transform="rotate(-90 5 26.6)">{game.home.abbr}</text>
        <text x="115" y="26.6" className="ez" transform="rotate(90 115 26.6)">{game.away.abbr}</text>
        {Array.from({ length: 21 }).map((_, i) => (
          <line key={i} x1={10 + i * 5} y1="0" x2={10 + i * 5} y2="53.3" stroke="#fff" strokeWidth={i % 2 ? 0.15 : 0.3} opacity="0.8" />
        ))}
        {[10, 20, 30, 40, 50, 40, 30, 20, 10].map((n, i) => (
          <text key={i} x={20 + i * 10} y="49" className="yd">{n}</text>
        ))}
        {ballYd !== undefined && game.state === 'in' && (
          <>
            {sit.isRedZone && <rect x={homeHasBall ? 80 : 10} y="0" width="30" height="53.3" fill="#ff3b5c" opacity="0.15" />}
            <line x1={X(ballYd)} y1="0" x2={X(ballYd)} y2="53.3" stroke="#3ea6ff" strokeWidth="0.6" className="los" />
            {firstDown !== undefined && firstDown > 0 && firstDown < 100 && (
              <line x1={X(firstDown)} y1="0" x2={X(firstDown)} y2="53.3" stroke="#ffd23f" strokeWidth="0.6" />
            )}
          </>
        )}
        {ball}
      </svg>
      {game.state === 'in' && (
        <div className="situation">
          {sit.downDistanceText && <b>{sit.downDistanceText}</b>}
          {sit.isRedZone && <span className="pill live">Zona roja</span>}
          {drive?.description && <span className="muted">Serie: {drive.description}</span>}
        </div>
      )}
    </>
  )
}

/* ============================== BÉISBOL ============================== */
// Zona de strike estimada a partir de strikes cantados (coordenadas de lanzamiento de ESPN).
const ZONE = { x1: 88, x2: 137, y1: 151, y2: 192 }

function Baseball({ game, summary, ball }: P) {
  const s = game.situation || {}
  const plays: any[] = summary.plays || []
  const pitches = plays.filter((p) => p.pitchCoordinate)
  const lastAb = pitches.length ? pitches[pitches.length - 1].atBatId : undefined
  const abPitches = pitches.filter((p) => p.atBatId === lastAb)
  const hits = plays.filter((p) => p.hitCoordinate && p.type?.text !== 'End Batter/Pitcher' && p.type?.text !== 'Play Result').slice(-25)
  const H = HOME_PLATE
  const base = (on: boolean, x: number, y: number) => (
    <rect x={x - 3} y={y - 3} width="6" height="6" transform={`rotate(45 ${x} ${y})`} className={on ? 'base on' : 'base'} />
  )
  const dots = (n: number, max: number, cls: string) =>
    Array.from({ length: max }).map((_, i) => <span key={i} className={`cnt ${cls} ${i < n ? 'on' : ''}`} />)
  const pitchColor = (t = '') => (/Ball|Hit By/.test(t) ? '#22c55e' : /Strike|Foul/.test(t) ? '#ff3b5c' : '#ffd23f')
  return (
    <div className="bb-wrap">
      <svg viewBox="0 10 200 185" className="field baseball">
        <rect x="0" y="10" width="200" height="185" fill="#173f22" />
        <path d={`M${H.x} ${H.y} L${H.x - 118} ${H.y - 118} A168 168 0 0 1 ${H.x + 118} ${H.y - 118} Z`} fill="#2f8a3e" />
        <path d={`M${H.x} ${H.y + 4} L${H.x - 30} ${H.y - 26} A40 40 0 0 1 ${H.x + 30} ${H.y - 26} Z`} fill="#b5713a" />
        <path d={`M${H.x} ${H.y - 4} L${H.x - 22} ${H.y - 27} L${H.x} ${H.y - 50} L${H.x + 22} ${H.y - 27} Z`} fill="#2f8a3e" />
        <path d={`M${H.x} ${H.y} L${H.x - 118} ${H.y - 118} M${H.x} ${H.y} L${H.x + 118} ${H.y - 118}`} stroke="#fff" strokeWidth="0.6" opacity="0.8" />
        <circle cx={H.x} cy={H.y - 25} r="3" fill="#b5713a" />
        {base(!!s.onSecond, H.x, H.y - 53)}
        {base(!!s.onThird, H.x - 26.7, H.y - 26.7)}
        {base(!!s.onFirst, H.x + 26.7, H.y - 26.7)}
        <path d={`M${H.x - 2.5} ${H.y - 2} h5 v2 l-2.5 2.5 l-2.5 -2.5 Z`} fill="#fff" />
        {hits.map((p) => {
          const x = 100 + (p.hitCoordinate.x - 125) * 0.96
          const y = 185 - (200 - p.hitCoordinate.y) * 0.96
          return <circle key={p.id} cx={x} cy={y} r="1.6" fill={/Single|Double|Triple|Home Run/.test(p.type?.text) ? '#ffd23f' : '#ffffff66'} />
        })}
        {ball}
      </svg>
      <div className="count">
        <svg viewBox="40 105 160 160" className="zone">
          <rect x="40" y="105" width="160" height="160" fill="#0e1424" rx="8" />
          <rect x={ZONE.x1} y={ZONE.y1} width={ZONE.x2 - ZONE.x1} height={ZONE.y2 - ZONE.y1} fill="none" stroke="#ffffff99" strokeWidth="1.2" />
          {[1, 2].map((i) => (
            <g key={i} stroke="#ffffff33" strokeWidth="0.6">
              <line x1={ZONE.x1 + ((ZONE.x2 - ZONE.x1) * i) / 3} y1={ZONE.y1} x2={ZONE.x1 + ((ZONE.x2 - ZONE.x1) * i) / 3} y2={ZONE.y2} />
              <line x1={ZONE.x1} y1={ZONE.y1 + ((ZONE.y2 - ZONE.y1) * i) / 3} x2={ZONE.x2} y2={ZONE.y1 + ((ZONE.y2 - ZONE.y1) * i) / 3} />
            </g>
          ))}
          {abPitches.map((p, i) => (
            <g key={p.id} className={i === abPitches.length - 1 ? 'pitch newest' : 'pitch'} transform={`translate(${p.pitchCoordinate.x} ${p.pitchCoordinate.y})`}>
              <circle r="6" fill={pitchColor(p.type?.text)} stroke="#fff" strokeWidth="0.8" />
              <text y="2.4" textAnchor="middle" className="pitch-n">{i + 1}</text>
            </g>
          ))}
        </svg>
        <div><label>B</label>{dots(s.balls ?? 0, 4, 'b')}</div>
        <div><label>S</label>{dots(s.strikes ?? 0, 3, 's')}</div>
        <div><label>O</label>{dots(s.outs ?? 0, 3, 'o')}</div>
        <p className="inning">{game.statusText}</p>
        {s.batter?.athlete && <p>🏏 {s.batter.athlete.shortName || s.batter.athlete.displayName}</p>}
        {s.pitcher?.athlete && <p>🎯 {s.pitcher.athlete.shortName || s.pitcher.athlete.displayName}</p>}
        {abPitches.length > 0 && (
          <p className="muted sm">
            Último: {abPitches[abPitches.length - 1].pitchType?.text ?? ''} {abPitches[abPitches.length - 1].pitchVelocity ? `${abPitches[abPitches.length - 1].pitchVelocity} mph` : ''}
          </p>
        )}
      </div>
    </div>
  )
}

/* ============================== HOCKEY ============================== */
function Hockey({ ball }: P) {
  return (
    <>
      <svg viewBox="-2 -2 204 89" className="field hockey">
        <rect x="0" y="0" width="200" height="85" rx="28" fill="#eef6fb" stroke="#9fb4c4" strokeWidth="0.8" />
        <line x1="100" y1="0" x2="100" y2="85" stroke="#d62839" strokeWidth="1" />
        <line x1="75" y1="0" x2="75" y2="85" stroke="#2a6fdb" strokeWidth="1" />
        <line x1="125" y1="0" x2="125" y2="85" stroke="#2a6fdb" strokeWidth="1" />
        <line x1="11" y1="2" x2="11" y2="83" stroke="#d62839" strokeWidth="0.4" />
        <line x1="189" y1="2" x2="189" y2="83" stroke="#d62839" strokeWidth="0.4" />
        <circle cx="100" cy="42.5" r="15" fill="none" stroke="#2a6fdb" strokeWidth="0.5" />
        {[31, 169].map((x) => [20.5, 64.5].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="15" fill="none" stroke="#d62839" strokeWidth="0.4" />))}
        <path d="M11 38.5 h4 a4 4 0 0 1 0 8 h-4" fill="#7fb3ff55" stroke="#d62839" strokeWidth="0.4" />
        <path d="M189 38.5 h-4 a4 4 0 0 0 0 8 h4" fill="#7fb3ff55" stroke="#d62839" strokeWidth="0.4" />
        {ball}
      </svg>
    </>
  )
}
