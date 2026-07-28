import { useCallback, useEffect, useState } from "react";
import { Titlebar } from "./Titlebar";
import { IconRail } from "./IconRail";
import { ContentArea } from "./ContentArea";
import { SearchPalette } from "./SearchPalette";
import { CommandPalette, type CommandAction } from "./CommandPalette";
import { TooltipProvider } from "./ui/tooltip";
import { useWorkspace } from "../state/useWorkspace";

export function WorkspaceShell() {
  const {
    workspace,
    pendingNote,
    clearPendingNote,
    setSection,
    closeWorkspace,
    openNote,
    updateSettings,
  } = useWorkspace();
  const [searchOpen, setSearchOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = workspace.settings.theme;
  }, [workspace.settings.theme]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const key = event.key.toLowerCase();
      const mod = event.ctrlKey || event.metaKey;

      if (mod && key === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (mod && event.shiftKey && key === "f") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (mod && key === "p") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (mod && key === "1") {
        event.preventDefault();
        setSection("notebook");
      }
      if (mod && key === "2") {
        event.preventDefault();
        setSection("files");
      }
      if (mod && key === "3") {
        event.preventDefault();
        setSection("canvas");
      }
      if (mod && key === ",") {
        event.preventDefault();
        setSection("settings");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setSection]);

  const handleCommand = useCallback(
    (action: CommandAction) => {
      if (action.type === "section") {
        setSection(action.section);
      } else if (action.type === "note") {
        openNote(action.path);
      } else if (action.type === "search") {
        setSearchOpen(true);
      } else if (action.type === "switch-workspace") {
        closeWorkspace();
      } else if (action.type === "theme") {
        updateSettings({ theme: action.theme });
      }
    },
    [setSection, openNote, closeWorkspace, updateSettings],
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full flex-col bg-background" data-theme={workspace.settings.theme}>
        <Titlebar
          workspaceName={workspace.name}
          onCloseWorkspace={closeWorkspace}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenCommands={() => setCommandOpen(true)}
          onOpenSettings={() => setSection("settings")}
        />
        <div className="flex min-h-0 flex-1">
          <IconRail
            active={workspace.currentSection}
            onChange={setSection}
            onSearch={() => setSearchOpen(true)}
          />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <ContentArea
              section={workspace.currentSection}
              pendingNote={pendingNote}
              onPendingNoteHandled={clearPendingNote}
            />
          </div>
        </div>
        <SearchPalette
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          onOpenNote={openNote}
        />
        <CommandPalette
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          onAction={handleCommand}
        />
      </div>
    </TooltipProvider>
  );
}
