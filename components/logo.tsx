/** The interlocking four-tile mark, shared by the shelf, the login screen and the app. */
export function Logo() {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span>
        multiapp<span className="brand-period">.</span>
      </span>
    </span>
  );
}
