import { useState } from "react";
import { Titlebar } from "./components/Titlebar";
import { Sidebar, type SectionId } from "./components/Sidebar";
import { ContentArea } from "./components/ContentArea";

export function App() {
  const [section, setSection] = useState<SectionId>("notebook");

  return (
    <div className="app-shell">
      <Titlebar />
      <div className="app-body">
        <Sidebar active={section} onChange={setSection} />
        <ContentArea section={section} />
      </div>
    </div>
  );
}
