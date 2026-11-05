/** Logo de iBet Live: balón-rayo con estela de velocidad y pulso "en vivo". */
export default function Logo({ size = 36, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <span className="logo" aria-label="iBet Live">
      <svg width={size} height={size} viewBox="0 0 64 64" className="logo-mark" aria-hidden>
        <defs>
          <linearGradient id="lg-a" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#00f5a0" />
            <stop offset="1" stopColor="#00b4ff" />
          </linearGradient>
          <linearGradient id="lg-b" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#00f5a0" stopOpacity="0" />
            <stop offset="1" stopColor="#00f5a0" />
          </linearGradient>
        </defs>
        <g className="logo-streaks">
          <path d="M2 25h13M0 32h15M2 39h13" stroke="url(#lg-b)" strokeWidth="3.2" strokeLinecap="round" />
        </g>
        <circle className="logo-ring" cx="36" cy="32" r="18" fill="none" stroke="url(#lg-a)" strokeWidth="5" strokeDasharray="88 25" />
        <path className="logo-bolt" d="M32 18 L41 31 L33.5 31 L39 46 L27.5 30.5 L35 30.5 Z" fill="url(#lg-a)" />
        <circle className="logo-live" cx="54" cy="12" r="5" fill="#ff3b5c" />
      </svg>
      {withText && (
        <span className="logo-text">
          <b>iBet</b>
          <i>LIVE</i>
        </span>
      )}
    </span>
  )
}
