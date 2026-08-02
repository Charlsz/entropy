import { useEffect, useMemo, useRef, useState } from "react";
import type { GlobalSearchHit } from "../../shared/types";
import { useWorkspace } from "../state/useWorkspace";
import { Input } from "./ui/input";
import { cn } from "../lib/utils";

interface SearchPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenNote: (path: string) => void;
}

export function SearchPalette({ open, onClose, onOpenNote }: SearchPaletteProps) {
  const { workspace, openFolder, openFileLocation } = useWorkspace();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchHit[]>([]);
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

    let cancelled = false;
    setSearching(true);
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const inventoryRoot = workspace.inventoryScanRoot || workspace.currentFolder;
          const [notes, files] = await Promise.all([
            window.entropy.fs.searchMarkdown(workspace.path, trimmed),
            inventoryRoot
              ? window.entropy.fs.searchInventoryNames(inventoryRoot, trimmed)
              : Promise.resolve([]),
          ]);
          if (cancelled) return;
          const noteHits: GlobalSearchHit[] = notes.map((note) => ({
            path: note.path,
            name: note.name,
            excerpt: note.excerpt,
            source: "note" as const,
          }));
          setResults([...noteHits, ...files]);
          setActiveIndex(0);
        } catch {
          if (!cancelled) setResults([]);
        } finally {
          if (!cancelled) setSearching(false);
        }
      })();
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, open, workspace.path, workspace.inventoryScanRoot, workspace.currentFolder]);

  const status = useMemo(() => {
    if (!query.trim()) return "Search notes, files, and folders";
    if (searching) return "Searching…";
    if (results.length === 0) return "No matches";
    const notes = results.filter((item) => item.source === "note").length;
    const folders = results.filter((item) => item.source === "folder").length;
    const files = results.filter((item) => item.source === "file").length;
    const parts = [
      notes ? `${notes} note${notes === 1 ? "" : "s"}` : null,
      folders ? `${folders} folder${folders === 1 ? "" : "s"}` : null,
      files ? `${files} file${files === 1 ? "" : "s"}` : null,
    ].filter(Boolean);
    return parts.join(" · ");
  }, [query, searching, results]);

  if (!open) return null;

  function choose(hit: GlobalSearchHit): void {
    if (hit.source === "note") onOpenNote(hit.path);
    else if (hit.source === "folder") openFolder(hit.path);
    else void openFileLocation(hit.path);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <button
        type="button"
        className="absolute inset-0 bg-ink/60"
        aria-label="Close search"
        onClick={onClose}
      />
      <div className="relative z-10 mx-4 w-full max-w-xl overflow-hidden rounded-xl border border-border bg-ink-2">
        <Input
          ref={inputRef}
          type="search"
          className="h-12 rounded-none border-0 border-b border-border bg-transparent px-4 text-base focus-visible:ring-0"
          placeholder="Search notes, files, and folders…"
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
              choose(results[activeIndex]);
            }
          }}
        />
        <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">{status}</p>
        <ul className="max-h-[50vh] overflow-auto p-1">
          {results.map((result, index) => (
            <li key={`${result.source}-${result.path}`}>
              <button
                type="button"
                className={cn(
                  "flex w-full flex-col rounded-lg px-3 py-2 text-left hover:bg-accent",
                  index === activeIndex && "bg-accent",
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(result)}
              >
                <span className="flex items-center gap-2 text-sm text-foreground">
                  <span className="rounded bg-background/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {result.source}
                  </span>
                  <span className="truncate">
                    {result.source === "note" ? result.name.replace(/\.md$/i, "") : result.name}
                  </span>
                </span>
                <span className="truncate text-[11px] text-muted-foreground">{result.path}</span>
                {result.source === "note" && result.excerpt ? (
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
