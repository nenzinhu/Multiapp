/** The brand mark: lime tile with the forest "m", shared by shelf and login. */
export function Logo() {
  return (
    <span className="brand">
      <svg
        className="brand-mark"
        viewBox="0 0 512 512"
        aria-hidden="true"
        focusable="false"
      >
        <rect width="512" height="512" rx="120" fill="var(--logo-tile, #d9f26b)" />
        <path
          d="M108 347V239a74 74 0 0 1 148 0v108M256 347V239a74 74 0 0 1 148 0v108"
          fill="none"
          stroke="var(--logo-glyph, #123b31)"
          strokeWidth="46"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>
        multiapp<span className="brand-period">.</span>
      </span>
    </span>
  );
}
