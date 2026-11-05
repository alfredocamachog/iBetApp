import { useState } from 'react'
import type { FieldKind, Game } from '../api/espn'

interface Item {
  id: string
  time: string
  text: string
  teamId?: string
  scoring?: boolean
  score?: string
}

/** Minuto a minuto / jugada por jugada, lo más reciente arriba. */
export default function PlayFeed({ kind, game, summary }: { kind: FieldKind; game: Game; summary: any }) {
  const [onlyKey, setOnlyKey] = useState(false)
  let items: Item[] = []

  if (kind === 'soccer') {
    const keyIds = new Set((summary.keyEvents || []).map((k: any) => k.text))
    items = (summary.commentary || []).map((c: any, i: number) => ({
      id: String(c.sequence ?? i),
      time: c.time?.displayValue || '',
      text: c.text,
      scoring: keyIds.has(c.text) || /^Goal!|^Gol/.test(c.text || ''),
    }))
    if (!items.length)
      items = (summary.keyEvents || []).map((k: any) => ({
        id: k.id, time: k.clock?.displayValue || '', text: k.text || k.type?.text, teamId: k.team?.id, scoring: k.scoringPlay,
      }))
  } else if (kind === 'football') {
    const drives = [...(summary.drives?.previous || []), ...(summary.drives?.current ? [summary.drives.current] : [])]
    const seen = new Set<string>()
    drives.forEach((d: any) =>
      (d.plays || []).forEach((p: any) => {
        if (seen.has(p.id)) return
        seen.add(p.id)
        items.push({
          id: p.id,
          time: `${p.period?.number ? `Q${p.period.number}` : ''} ${p.clock?.displayValue ?? ''}`,
          text: p.text,
          teamId: d.team?.id,
          scoring: p.scoringPlay,
          score: p.scoringPlay ? `${p.awayScore}-${p.homeScore}` : undefined,
        })
      }),
    )
  } else {
    items = (summary.plays || [])
      .filter((p: any) => p.text)
      .map((p: any) => ({
        id: p.id,
        time: `${p.period?.displayValue ?? ''} ${p.clock?.displayValue ?? ''}`.trim(),
        text: p.text,
        teamId: p.team?.id,
        scoring: p.scoringPlay,
        score: p.scoringPlay ? `${p.awayScore}-${p.homeScore}` : undefined,
      }))
  }

  const shown = (onlyKey ? items.filter((i) => i.scoring) : items).slice(-120).reverse()
  const color = (id?: string) => (id === game.home.id ? game.home.color : id === game.away.id ? game.away.color : 'transparent')

  return (
    <div className="feed">
      <div className="feed-head">
        <h3>{kind === 'soccer' ? 'Minuto a minuto' : 'Jugada por jugada'}</h3>
        <label className="toggle">
          <input type="checkbox" checked={onlyKey} onChange={(e) => setOnlyKey(e.target.checked)} />
          Solo {kind === 'soccer' ? 'claves' : 'anotaciones'}
        </label>
      </div>
      {shown.length === 0 ? (
        <p className="empty sm">{game.state === 'pre' ? 'El partido aún no comienza.' : 'Sin jugadas disponibles.'}</p>
      ) : (
        <ol>
          {shown.map((i, n) => (
            <li key={i.id} className={`${i.scoring ? 'scoring' : ''} ${n === 0 && game.state === 'in' ? 'newest' : ''}`} style={{ borderLeftColor: color(i.teamId) }}>
              <time>{i.time}</time>
              <p>{i.text}</p>
              {i.score && <b>{i.score}</b>}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
