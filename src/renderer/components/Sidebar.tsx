export type SectionId = "notebook" | "files" | "canvas" | "settings";

interface SidebarProps {
  active: SectionId;
  onChange: (section: SectionId) => void;
}

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "notebook", label: "Notebook" },
  { id: "files", label: "Files" },
  { id: "canvas", label: "Canvas" },
  { id: "settings", label: "Settings" },
];

export function Sidebar({ active, onChange }: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <nav className="sidebar-nav">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            className={`sidebar-item${active === section.id ? " is-active" : ""}`}
            aria-current={active === section.id ? "page" : undefined}
            onClick={() => onChange(section.id)}
          >
            <span className="sidebar-icon" data-section={section.id} />
            <span className="sidebar-label">{section.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
