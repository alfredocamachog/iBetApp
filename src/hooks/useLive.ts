import { useEffect, useRef, useState } from 'react'

/**
 * Carga datos y los refresca automáticamente.
 * - `interval(data)` decide el ritmo: rápido si hay acción en vivo, lento si no.
 * - Se pausa cuando la pestaña está oculta y refresca al volver.
 */
export function useLive<T>(
  loader: () => Promise<T>,
  deps: unknown[],
  interval: (data: T | undefined) => number,
) {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<Date>()
  const loaderRef = useRef(loader)
  const intervalRef = useRef(interval)
  loaderRef.current = loader
  intervalRef.current = interval

  useEffect(() => {
    let alive = true
    let timer: number | undefined
    let last: T | undefined
    setLoading(true)
    setData(undefined)

    const tick = async () => {
      window.clearTimeout(timer)
      try {
        const d = await loaderRef.current()
        if (!alive) return
        last = d
        setData(d)
        setError(undefined)
        setUpdatedAt(new Date())
      } catch (e: any) {
        if (alive) setError(e?.message || 'Error de red')
      } finally {
        if (alive) {
          setLoading(false)
          if (!document.hidden) timer = window.setTimeout(tick, intervalRef.current(last))
        }
      }
    }
    const onVis = () => {
      if (!document.hidden) tick()
      else window.clearTimeout(timer)
    }
    tick()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      alive = false
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVis)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, error, loading, updatedAt }
}

/** Reloj que re-renderiza cada segundo (para "hace X s" y cuenta regresiva). */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), ms)
    return () => window.clearInterval(t)
  }, [ms])
  return now
}
