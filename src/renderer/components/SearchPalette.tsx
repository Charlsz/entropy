import { useEffect, useMemo, useRef, useState } from "react";
import type { NoteSearchResult } from "../../shared/types";
import { useWorkspace } from "../state/useWorkspace";
import { Input } from "./ui/input";
import { cn } from "../lib/utils";

interface SearchPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenNote: (path: string) => void;
}

export function SearchPalette({ open, onClose, onOpenNote }: SearchPaletteProps) {
  const { workspace } = useWorkspace();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NoteSearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const handle = window.setTimeout(() => {
      void window.entropy.fs
        .searchMarkdown(workspace.path, trimmed)
        .then((items) => {
          setResults(items);
          setActiveIndex(0);
        })
        .finally(() => setSearching(false));
    }, 120);

    return () => window.clearTimeout(handle);
  }, [query, open, workspace.path]);

  const status = useMemo(() => {
    if (!query.trim()) return "Type to search markdown notes";
    if (searching) return "Searching…";
    if (results.length === 0) return "No matches";
    return `${results.length} result${results.length === 1 ? "" : "s"}`;
  }, [query, searching, results.length]);

  if (!open) return null;

  function choose(path: string): void {
    onOpenNote(path);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search notes">
      <button
        type="button"
        className="absolute inset-0 bg-ink/60"
        aria-label="Close search"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border border-border bg-ink-2">
        <Input
          ref={inputRef}
          type="search"
          className="h-12 rounded-none border-0 border-b border-border bg-transparent px-4 text-base focus-visible:ring-0"
          placeholder="Search notes across workspace…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter" && results[activeIndex]) {
              event.preventDefault();
              choose(results[activeIndex].path);
            }
          }}
        />
        <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">{status}</p>
        <ul className="max-h-[50vh] overflow-auto p-1">
          {results.map((result, index) => (
            <li key={result.path}>
              <button
                type="button"
                className={cn(
                  "flex w-full flex-col rounded-lg px-3 py-2 text-left hover:bg-accent",
                  index === activeIndex && "bg-accent",
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(result.path)}
              >
                <span className="text-sm text-foreground">
                  {result.name.replace(/\.md$/i, "")}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">{result.path}</span>
                {result.excerpt ? (
                  <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {result.excerpt}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
