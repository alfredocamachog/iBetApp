import { lazy, Suspense } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useParams } from 'react-router-dom'
import Logo from './components/Logo'
import SearchBox from './components/SearchBox'
import LiveAlerts, { BellButton, ToastHost } from './components/LiveAlerts'
import { TZ, fmtDay } from './api/espn'
import { useNow } from './hooks/useLive'
import { favCount, useFavs } from './store/favorites'
import Feed from './pages/Feed'

const GamePage = lazy(() => import('./pages/GamePage'))
const LeaguePage = lazy(() => import('./pages/LeaguePage'))
const TeamPage = lazy(() => import('./pages/TeamPage'))
const EventPage = lazy(() => import('./pages/EventPage'))
const FavoritesPage = lazy(() => import('./pages/FavoritesPage'))

function Clock() {
  const now = useNow(1000)
  return (
    <div className="clock" title={TZ}>
      <span>{now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
      <small>{fmtDay(now)}</small>
    </div>
  )
}

/** Enlaces antiguos /deporte/:sport/:liga/partido/:id → /partido/... */
function LegacyGame() {
  const { sportId, leagueKey, gameId } = useParams()
  return <Navigate to={`/partido/${sportId}/${leagueKey}/${gameId}`} replace />
}

export default function App() {
  const loc = useLocation()
  const favs = useFavs()
  const n = favCount(favs)
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <Logo />
        </Link>
        <SearchBox />
        <nav className="top-actions">
          <NavLink to="/favoritos" className="iconbtn fav-link" title="Mis favoritos">
            ★<em>Favoritos</em>
            {n > 0 && <b>{n}</b>}
          </NavLink>
          <BellButton />
        </nav>
        <Clock />
      </header>
      <main key={loc.pathname.split('/').slice(0, 3).join('/')} className="page">
        <Suspense fallback={<div className="skeleton-page" />}>
          <Routes>
            <Route path="/" element={<Feed />} />
            <Route path="/deporte/:sportId" element={<Feed />} />
            <Route path="/liga/:sportId/:slug" element={<LeaguePage />} />
            <Route path="/equipo/:sportId/:slug/:teamId" element={<TeamPage />} />
            <Route path="/partido/:sportId/:slug/:gameId" element={<GamePage />} />
            <Route path="/evento/:sportId/:slug/:eventId" element={<EventPage />} />
            <Route path="/favoritos" element={<FavoritesPage />} />
            <Route path="/deporte/:sportId/:leagueKey/partido/:gameId" element={<LegacyGame />} />
            <Route path="*" element={<Feed />} />
          </Routes>
        </Suspense>
      </main>
      <footer className="foot">Datos en tiempo real · Zona horaria: {TZ} · Fuente: ESPN</footer>
      <LiveAlerts />
      <ToastHost />
    </div>
  )
}
