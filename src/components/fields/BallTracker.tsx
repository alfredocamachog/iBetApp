import { useCallback, useEffect, useRef, useState } from 'react'
import type { Game } from '../../api/espn'
import type { TrackPoint } from './track'

interface Pos {
  x: number
  y: number
  dur: number
}
interface TrailPt {
  x: number
  y: number
  team?: string
  k: number
}

const TRAIL = 9
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Reproduce la secuencia de posiciones del balón en orden.
 * - Al abrir: repasa las últimas jugadas rápido para mostrar de dónde viene la acción.
 * - En vivo: cuando llegan jugadas nuevas, las encola y las anima una tras otra
 *   repartiendo el tiempo hasta el siguiente refresco, para que el movimiento sea continuo.
 * - Repetición: vuelve N jugadas atrás y las reproduce.
 */
export function useBallPlayback(points: TrackPoint[], live: boolean, pollMs = 5000) {
  const [pos, setPos] = useState<Pos>()
  const [trail, setTrail] = useState<TrailPt[]>([])
  const [current, setCurrent] = useState<TrackPoint>()
  const [replaying, setReplaying] = useState(false)
  const [pending, setPending] = useState(0)

  const pts = useRef(points)
  pts.current = points
  const shown = useRef(-1) // índice de la última jugada mostrada
  const running = useRef(false)
  const gen = useRef(0) // invalida bucles anteriores (repetición/reinicio)
  const firstId = useRef<string>()
  const counter = useRef(0)
  const liveRef = useRef(live)
  liveRef.current = live

  const push = (x: number, y: number, team?: string) =>
    setTrail((t) => [...t.slice(-(TRAIL - 1)), { x, y, team, k: counter.current++ }])

  const run = useCallback(async (fast = false) => {
    if (running.current) return
    running.current = true
    const my = gen.current
    while (gen.current === my && shown.current < pts.current.length - 1) {
      const left = pts.current.length - 1 - shown.current
      setPending(left - 1)
      // En vivo repartimos el intervalo de refresco entre las jugadas en cola.
      const step = fast ? 650 : Math.max(380, Math.min(1500, (pollMs * 0.9) / left))
      shown.current++
      const p = pts.current[shown.current]
      const d1 = p.to ? step * 0.5 : step * 0.85
      setCurrent(p)
      setPos({ x: p.x, y: p.y, dur: p.kind === 'set' ? Math.min(d1, 300) : d1 })
      push(p.x, p.y, p.team)
      await sleep(d1)
      if (gen.current !== my) break
      if (p.to) {
        const d2 = step * 0.4
        setPos({ x: p.to.x, y: p.to.y, dur: d2 })
        push(p.to.x, p.to.y, p.team)
        await sleep(d2)
      }
      await sleep(step * 0.1)
    }
    // Solo el bucle vigente libera el candado (uno viejo cancelado no debe tocarlo).
    if (gen.current === my) {
      running.current = false
      setReplaying(false)
      setPending(0)
    }
  }, [pollMs])

  useEffect(() => {
    if (!points.length) return
    // Partido distinto o datos reiniciados → empezar de nuevo
    if (firstId.current !== points[0].id || shown.current >= points.length) {
      firstId.current = points[0].id
      gen.current++
      running.current = false
      setTrail([])
      // Intro: repasar las últimas jugadas
      shown.current = Math.max(-1, points.length - 1 - (liveRef.current ? 6 : 8))
      const start = points[Math.max(0, shown.current)]
      setPos({ x: start.x, y: start.y, dur: 0 })
      run(true)
      return
    }
    run()
  }, [points, run])

  const replay = useCallback(
    (n = 12) => {
      gen.current++
      running.current = false
      setTrail([])
      setReplaying(true)
      shown.current = Math.max(-1, pts.current.length - 1 - n)
      const s = pts.current[Math.max(0, shown.current)]
      if (s) setPos({ x: s.x, y: s.y, dur: 0 })
      setTimeout(() => run(true), 30)
    },
    [run],
  )

  return { pos, trail, current, replay, replaying, pending }
}

/* -------------------------------- Render SVG -------------------------------- */

export type BallStyle = 'soccer' | 'basketball' | 'football' | 'hockey' | 'baseball'

export function BallLayer({ pos, trail, game, style, scale = 1, current }: {
  pos?: Pos
  trail: TrailPt[]
  game: Game
  style: BallStyle
  scale?: number
  current?: TrackPoint
}) {
  if (!pos) return null
  const color = (team?: string) => (team === game.home.id ? game.home.color : team === game.away.id ? game.away.color : '#fff')
  const r = scale
  return (
    <g className="tracker">
      {trail.slice(1).map((p, i) => {
        const a = trail[i]
        const op = (i + 1) / trail.length
        return (
          <line key={p.k} x1={a.x} y1={a.y} x2={p.x} y2={p.y} stroke={color(p.team)} strokeWidth={0.55 * r} strokeLinecap="round"
            strokeDasharray={`${1.2 * r} ${0.9 * r}`} opacity={op * 0.9} className="trail-seg" />
        )
      })}
      {trail.map((p, i) => (
        <circle key={`d${p.k}`} cx={p.x} cy={p.y} r={0.45 * r} fill={color(p.team)} opacity={(i + 1) / trail.length} />
      ))}
      <g className="ball-live" style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, transitionDuration: `${pos.dur}ms` }}>
        <circle r={3.4 * r} className="ball-pulse" style={{ stroke: color(current?.team) }} />
        {current?.kind === 'goal' && <circle r={5 * r} className="goal-burst" />}
        <BallIcon style={style} r={r} />
      </g>
    </g>
  )
}

function BallIcon({ style, r }: { style: BallStyle; r: number }) {
  switch (style) {
    case 'soccer':
      return (
        <g>
          <circle r={1.25 * r} fill="#fff" stroke="#111" strokeWidth={0.15 * r} />
          <path d={`M0 ${-0.5 * r} L${0.48 * r} ${-0.15 * r} L${0.3 * r} ${0.42 * r} L${-0.3 * r} ${0.42 * r} L${-0.48 * r} ${-0.15 * r} Z`} fill="#111" />
        </g>
      )
    case 'basketball':
      return (
        <g>
          <circle r={1.2 * r} fill="#f47a20" stroke="#3a1a05" strokeWidth={0.15 * r} />
          <path d={`M${-1.2 * r} 0 H${1.2 * r} M0 ${-1.2 * r} V${1.2 * r}`} stroke="#3a1a05" strokeWidth={0.12 * r} />
        </g>
      )
    case 'football':
      return (
        <g>
          <ellipse rx={1.9 * r} ry={1.15 * r} fill="#7a3f12" stroke="#fff" strokeWidth={0.18 * r} />
          <path d={`M${-0.8 * r} 0 H${0.8 * r}`} stroke="#fff" strokeWidth={0.18 * r} />
        </g>
      )
    case 'hockey':
      return <ellipse rx={1.4 * r} ry={1.1 * r} fill="#0b0b0b" stroke="#fff" strokeWidth={0.2 * r} />
    default:
      return (
        <g>
          <circle r={1.3 * r} fill="#fff" stroke="#c81e1e" strokeWidth={0.18 * r} />
        </g>
      )
  }
}

/** Barra bajo la cancha: jugada actual + controles de repetición. */
export function TrackerBar({ current, live, replaying, pending, onReplay, count }: {
  current?: TrackPoint
  live: boolean
  replaying: boolean
  pending: number
  onReplay: (n: number) => void
  count: number
}) {
  return (
    <div className="tracker-bar">
      <div className="tb-now" key={current?.id}>
        <span className={`tb-badge ${replaying ? 'rep' : live ? 'live' : ''}`}>
          {replaying ? '↺ Repetición' : live ? <><span className="dot" /> En vivo</> : 'Última jugada'}
        </span>
        {current?.time && <small>{current.time}</small>}
        <p>{current?.label || (count ? '' : 'Esperando la primera jugada con posición…')}</p>
        {pending > 0 && <em className="muted">+{pending} en cola</em>}
      </div>
      <div className="tb-actions">
        <button onClick={() => onReplay(10)} disabled={!count}>↺ Últimas 10</button>
        <button onClick={() => onReplay(30)} disabled={!count}>↺ Últimas 30</button>
      </div>
    </div>
  )
}
