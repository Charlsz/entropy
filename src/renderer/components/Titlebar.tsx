interface TitlebarProps {
  workspaceName?: string;
}

export function Titlebar({ workspaceName }: TitlebarProps) {
  return (
    <header className="titlebar" aria-label="Application title bar">
      <div className="titlebar-drag">
        <span className="titlebar-brand">Entropy</span>
        {workspaceName ? <span className="titlebar-workspace">{workspaceName}</span> : null}
      </div>
      <div className="titlebar-controls" aria-hidden="true" />
    </header>
  );
}
