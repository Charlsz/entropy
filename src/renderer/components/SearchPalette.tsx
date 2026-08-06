import { useEffect, useMemo, useRef, useState } from "react";
import type { GlobalSearchHit } from "../../shared/types";
import { useWorkspace } from "../state/useWorkspace";
import { Input } from "./ui/input";
import { cn } from "../lib/utils";
import { figma } from "../lib/figmaTokens";
import searchIcon from "../assets/icons/search.svg";
import { samePath } from "../lib/platform";

interface SearchPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenNote: (path: string) => void;
}

function baseName(filePath: string): string {
  return filePath.split(/[/\\]/).pop() || filePath;
}

export function SearchPalette({ open, onClose, onOpenNote }: SearchPaletteProps) {
  const { workspace, openFolder, openFileLocation, openInWorkspace } = useWorkspace();
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
          const recent = await window.entropy.workspace.getRecent();
          const workspaceRoots = new Map<string, string>();
          workspaceRoots.set(workspace.path, workspace.name || baseName(workspace.path));
          for (const item of recent) {
            if (!workspaceRoots.has(item.path)) {
              workspaceRoots.set(item.path, item.name || baseName(item.path));
            }
          }

          const inventoryRoot = workspace.inventoryScanRoot || workspace.currentFolder;
          const noteSearches = [...workspaceRoots.entries()].map(async ([root, name]) => {
            const notes = await window.entropy.fs.searchMarkdown(root, trimmed).catch(() => []);
            return notes.map(
              (note): GlobalSearchHit => ({
                path: note.path,
                name: note.name,
                excerpt: note.excerpt,
                source: "note",
                workspacePath: root,
                workspaceName: name,
              }),
            );
          });

          const [noteLists, files] = await Promise.all([
            Promise.all(noteSearches),
            inventoryRoot
              ? window.entropy.fs.searchInventoryNames(inventoryRoot, trimmed)
              : Promise.resolve([] as GlobalSearchHit[]),
          ]);
          if (cancelled) return;

          const seenNotes = new Set<string>();
          const noteHits: GlobalSearchHit[] = [];
          for (const list of noteLists) {
            for (const hit of list) {
              const key = hit.path.replace(/\\/g, "/").toLowerCase();
              if (seenNotes.has(key)) continue;
              seenNotes.add(key);
              noteHits.push(hit);
            }
          }

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
  }, [
    query,
    open,
    workspace.path,
    workspace.name,
    workspace.inventoryScanRoot,
    workspace.currentFolder,
  ]);

  const status = useMemo(() => {
    if (!query.trim()) return "Search notes across workspaces, plus Library files";
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
    if (hit.source === "note") {
      const targetWorkspace = hit.workspacePath ?? workspace.path;
      if (!samePath(targetWorkspace, workspace.path)) {
        openInWorkspace(targetWorkspace, hit.path);
      } else {
        onOpenNote(hit.path);
      }
    } else if (hit.source === "folder") {
      openFolder(hit.path);
    } else {
      void openFileLocation(hit.path);
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search index"
    >
      <button
        type="button"
        className="absolute inset-0"
        style={{ backgroundColor: "color-mix(in srgb, #131413 45%, transparent)" }}
        aria-label="Close search"
        onClick={onClose}
      />
      <div
        className="relative z-10 mx-4 w-full max-w-xl overflow-hidden rounded-[8px] border"
        style={{ backgroundColor: figma.canvas, borderColor: figma.border }}
      >
        <div
          className="flex items-center gap-2 border-b px-[10px] py-[6px]"
          style={{ borderColor: figma.border }}
        >
          <span className="relative size-3 shrink-0 overflow-hidden" aria-hidden>
            <img src={searchIcon} alt="" className="absolute inset-0 size-full" width={12} height={12} />
          </span>
          <Input
            ref={inputRef}
            type="search"
            className="h-8 flex-1 rounded-none border-0 bg-transparent px-0 text-[12px] shadow-none focus-visible:ring-0"
            style={{ color: figma.ink }}
            placeholder="Search index..."
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
        </div>
        <p className="border-b px-4 py-2 text-[11px]" style={{ borderColor: figma.border, color: figma.muted }}>
          {status}
        </p>
        <ul className="max-h-[50vh] overflow-auto p-1">
          {results.map((result, index) => (
            <li key={`${result.source}-${result.workspacePath ?? ""}-${result.path}`}>
              <button
                type="button"
                className={cn("flex w-full flex-col rounded-[6px] px-3 py-2 text-left")}
                style={{
                  backgroundColor: index === activeIndex ? figma.select : "transparent",
                }}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(result)}
              >
                <span className="flex items-center gap-2 text-[13px]" style={{ color: figma.ink }}>
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide"
                    style={{ backgroundColor: figma.surface, color: figma.muted }}
                  >
                    {result.source}
                  </span>
                  <span className="truncate">
                    {result.source === "note" ? result.name.replace(/\.md$/i, "") : result.name}
                  </span>
                </span>
                <span className="truncate text-[11px]" style={{ color: figma.muted }}>
                  {result.source === "note" && result.workspaceName
                    ? `${result.workspaceName} · ${result.path}`
                    : result.path}
                </span>
                {result.source === "note" && result.excerpt ? (
                  <span className="mt-0.5 line-clamp-2 text-[11px]" style={{ color: figma.muted }}>
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
