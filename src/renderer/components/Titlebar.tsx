interface TitlebarProps {
  workspaceName?: string;
  onCloseWorkspace?: () => void;
  onOpenSearch?: () => void;
}

export function Titlebar({ workspaceName, onCloseWorkspace, onOpenSearch }: TitlebarProps) {
  return (
    <header className="titlebar" aria-label="Application title bar">
      <div className="titlebar-drag">
        <span className="titlebar-brand">Entropy</span>
        {workspaceName ? <span className="titlebar-workspace">{workspaceName}</span> : null}
      </div>
      <div className="titlebar-actions">
        {onOpenSearch ? (
          <button
            type="button"
            className="titlebar-action"
            onClick={onOpenSearch}
            title="Search notes (Ctrl+K)"
          >
            Search
          </button>
        ) : null}
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
