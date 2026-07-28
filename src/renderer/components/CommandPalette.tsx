import { useEffect, useMemo, useRef, useState } from "react";
import type { NoteSearchResult } from "../../shared/types";
import type { SectionId } from "../types/section";
import { useWorkspace } from "../state/useWorkspace";
import { Input } from "./ui/input";
import { cn } from "../lib/utils";

export type CommandAction =
  | { type: "section"; section: SectionId }
  | { type: "note"; path: string }
  | { type: "search" }
  | { type: "switch-workspace" }
  | { type: "theme"; theme: "dark" | "light" };

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onAction: (action: CommandAction) => void;
}

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  action: CommandAction;
}

export function CommandPalette({ open, onClose, onAction }: CommandPaletteProps) {
  const { workspace } = useWorkspace();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NoteSearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<CommandItem[]>(() => {
    const base: CommandItem[] = [
      { id: "nav-notebook", label: "Go to Notebook", hint: "⌘1", action: { type: "section", section: "notebook" } },
      { id: "nav-files", label: "Go to Files", hint: "⌘2", action: { type: "section", section: "files" } },
      { id: "nav-canvas", label: "Go to Canvas", hint: "⌘3", action: { type: "section", section: "canvas" } },
      { id: "nav-settings", label: "Go to Settings", hint: "⌘,", action: { type: "section", section: "settings" } },
      { id: "search-notes", label: "Search notes", hint: "⌘K", action: { type: "search" } },
      { id: "switch", label: "Switch workspace", action: { type: "switch-workspace" } },
      { id: "theme-dark", label: "Use dark theme", action: { type: "theme", theme: "dark" } },
      { id: "theme-light", label: "Use light theme", action: { type: "theme", theme: "light" } },
    ];

    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((item) => item.label.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setActiveIndex(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const handle = window.setTimeout(() => {
      void window.entropy.fs
        .searchMarkdown(workspace.path, trimmed)
        .then((items) => {
          setResults(items.slice(0, 20));
          setActiveIndex(0);
        })
        .finally(() => setSearching(false));
    }, 120);

    return () => window.clearTimeout(handle);
  }, [query, open, workspace.path]);

  const items = useMemo(() => {
    const noteItems: CommandItem[] = results.map((result) => ({
      id: `note-${result.path}`,
      label: result.name.replace(/\.md$/i, ""),
      hint: result.excerpt || result.path,
      action: { type: "note", path: result.path },
    }));
    return [...commands, ...noteItems];
  }, [commands, results]);

  if (!open) return null;

  function run(item: CommandItem): void {
    onAction(item.action);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <button
        type="button"
        className="absolute inset-0 bg-ink/60"
        aria-label="Close commands"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <Input
          ref={inputRef}
          type="search"
          className="h-12 rounded-none border-0 border-b border-border bg-transparent px-4 text-base focus-visible:ring-0"
          placeholder="Type a command or search notes…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((index) => Math.min(index + 1, Math.max(items.length - 1, 0)));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter" && items[activeIndex]) {
              event.preventDefault();
              run(items[activeIndex]);
            }
          }}
        />
        <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
          {searching ? "Searching…" : `${items.length} command${items.length === 1 ? "" : "s"}`}
        </p>
        <ul className="max-h-[50vh] overflow-auto p-1">
          {items.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent",
                  index === activeIndex && "bg-accent",
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => run(item)}
              >
                <span className="text-sm text-foreground">{item.label}</span>
                {item.hint ? (
                  <span className="truncate text-[11px] text-muted-foreground">{item.hint}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
