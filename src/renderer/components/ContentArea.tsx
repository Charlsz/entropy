import type { SectionId } from "./Sidebar";

interface ContentAreaProps {
  section: SectionId;
}

const LABELS: Record<SectionId, string> = {
  notebook: "Notebook",
  files: "Files",
  canvas: "Canvas",
  settings: "Settings",
};

export function ContentArea({ section }: ContentAreaProps) {
  return (
    <main className="content-area" aria-label={LABELS[section]}>
      <div className="content-empty">
        <h1>{LABELS[section]}</h1>
        <p>This section is ready for content.</p>
      </div>
    </main>
  );
}
