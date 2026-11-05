import { useNow } from '../hooks/useLive'

/** "En tiempo real · hace Xs" */
export default function Updated({ at, live }: { at?: Date; live?: boolean }) {
  const now = useNow(1000)
  if (!at) return null
  const s = Math.max(0, Math.round((now.getTime() - at.getTime()) / 1000))
  return (
    <span className={`updated ${live ? 'is-live' : ''}`}>
      <span className="dot" /> {live ? 'En tiempo real' : 'Actualizado'} · hace {s}s
    </span>
  )
}
