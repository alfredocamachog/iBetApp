import type { MouseEvent } from 'react'

/** Botón estrella para marcar favoritos (no navega aunque esté dentro de un enlace). */
export default function Star({ on, onToggle, title, size = 18 }: { on: boolean; onToggle: () => void; title?: string; size?: number }) {
  const click = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onToggle()
  }
  return (
    <button className={`star ${on ? 'on' : ''}`} onClick={click} title={title ?? (on ? 'Quitar de favoritos' : 'Agregar a favoritos')} aria-pressed={on}>
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        <path d="M12 2.8l2.8 5.7 6.3.9-4.6 4.4 1.1 6.3L12 17.1 6.4 20.1l1.1-6.3L2.9 9.4l6.3-.9z" />
      </svg>
    </button>
  )
}
