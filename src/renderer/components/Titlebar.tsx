export function Titlebar() {
  return (
    <header className="titlebar" aria-label="Application title bar">
      <div className="titlebar-drag">
        <span className="titlebar-brand">Entropy</span>
      </div>
      <div className="titlebar-controls" aria-hidden="true" />
    </header>
  );
}
