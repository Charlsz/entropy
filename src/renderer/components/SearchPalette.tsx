import { useEffect, useMemo, useRef, useState } from "react";
import type { NoteSearchResult } from "../../shared/types";
import { useWorkspace } from "../state/WorkspaceContext";

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
    <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Search notes">
      <button type="button" className="search-backdrop" aria-label="Close search" onClick={onClose} />
      <div className="search-palette">
        <input
          ref={inputRef}
          type="search"
          className="search-input"
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
        <p className="search-status">{status}</p>
        <ul className="search-results">
          {results.map((result, index) => (
            <li key={result.path}>
              <button
                type="button"
                className={`search-result${index === activeIndex ? " is-active" : ""}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(result.path)}
              >
                <span className="search-result-name">{result.name.replace(/\.md$/i, "")}</span>
                <span className="search-result-path">{result.path}</span>
                {result.excerpt ? (
                  <span className="search-result-excerpt">{result.excerpt}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
