interface TitlebarProps {
  workspaceName?: string;
  onCloseWorkspace?: () => void;
}

export function Titlebar({ workspaceName, onCloseWorkspace }: TitlebarProps) {
  return (
    <header className="titlebar" aria-label="Application title bar">
      <div className="titlebar-drag">
        <span className="titlebar-brand">Entropy</span>
        {workspaceName ? <span className="titlebar-workspace">{workspaceName}</span> : null}
      </div>
      <div className="titlebar-actions">
        {onCloseWorkspace ? (
          <button
            type="button"
            className="titlebar-action"
            onClick={onCloseWorkspace}
            title="Close workspace"
          >
            Switch
          </button>
        ) : null}
        <div className="titlebar-controls" aria-hidden="true" />
      </div>
    </header>
  );
}
