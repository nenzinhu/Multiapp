/** The brand mark: charcoal tile with the gradient "m", shared by shelf and login. */
export function Logo() {
  return (
    <span className="brand">
      <svg
        className="brand-mark"
        viewBox="0 0 512 512"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient
            id="multiapp-mark"
            x1="70"
            y1="150"
            x2="440"
            y2="400"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#22d3ee" />
            <stop offset="0.35" stopColor="#3b82f6" />
            <stop offset="0.6" stopColor="#8b5cf6" />
            <stop offset="0.82" stopColor="#ec4899" />
            <stop offset="1" stopColor="#fb7185" />
          </linearGradient>
        </defs>
        <rect width="512" height="512" rx="116" fill="var(--logo-tile, #23262c)" />
        <path
          d="M108 347V239a74 74 0 0 1 148 0v108M256 347V239a74 74 0 0 1 148 0v108"
          fill="none"
          stroke="url(#multiapp-mark)"
          strokeWidth="56"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="brand-word">
        multiapp<span className="brand-period">.</span>
      </span>
    </span>
  );
}
