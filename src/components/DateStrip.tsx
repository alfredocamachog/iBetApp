import { useEffect, useRef } from 'react'
import { addDays, isoDay, sameLocalDay } from '../api/espn'

/** Tira de fechas: 3 días atrás, hoy y 7 adelante, más selector libre. */
export default function DateStrip({ day, onChange }: { day: Date; onChange: (d: Date) => void }) {
  const today = new Date()
  const ref = useRef<HTMLDivElement>(null)
  const days = Array.from({ length: 11 }, (_, i) => addDays(today, i - 3))
  useEffect(() => {
    ref.current?.querySelector('.on')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [day])
  return (
    <div className="datestrip">
      <div className="ds-days" ref={ref}>
        {days.map((d) => {
          const diff = Math.round((d.getTime() - addDays(today, 0).getTime()) / 864e5)
          const label = diff === 0 ? 'Hoy' : diff === -1 ? 'Ayer' : diff === 1 ? 'Mañana' : d.toLocaleDateString('es-MX', { weekday: 'short' })
          return (
            <button key={d.toISOString()} className={sameLocalDay(d, day) ? 'on' : ''} onClick={() => onChange(d)}>
              <span>{label}</span>
              <b>{d.getDate()}</b>
              <small>{d.toLocaleDateString('es-MX', { month: 'short' })}</small>
            </button>
          )
        })}
      </div>
      <label className="ds-pick" title="Elegir otra fecha">
        📅
        <input
          type="date"
          value={isoDay(day)}
          onChange={(e) => {
            if (!e.target.value) return
            const [y, m, dd] = e.target.value.split('-').map(Number)
            onChange(new Date(y, m - 1, dd))
          }}
        />
      </label>
    </div>
  )
}
