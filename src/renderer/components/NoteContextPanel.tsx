import { useEffect, useState } from "react";
import { ExternalLink, Link2, X } from "lucide-react";
import type { FileEntry, NoteSearchResult } from "../../shared/types";
import { FilePreview } from "../pages/FilePreview";
import { EntryPreview } from "./EntryPreview";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { useWorkspace } from "../state/useWorkspace";

const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;

interface NoteContextPanelProps {
  notePath: string | null;
  previewEntry?: FileEntry | null;
  onOpenNote: (path: string) => void;
  onReference?: (entry: FileEntry) => void;
  onClearPreview?: () => void;
}

export function NoteContextPanel({
  notePath,
  previewEntry = null,
  onOpenNote,
  onReference,
  onClearPreview,
}: NoteContextPanelProps) {
  const { workspace } = useWorkspace();
  const [links, setLinks] = useState<Array<{ label: string; href: string }>>([]);
  const [backlinks, setBacklinks] = useState<NoteSearchResult[]>([]);
  const [linkedFile, setLinkedFile] = useState<FileEntry | null>(null);
  const [meta, setMeta] = useState<{ title: string; words: number; chars: number } | null>(null);

  useEffect(() => {
    if (!notePath) {
      setLinks([]);
      setBacklinks([]);
      setLinkedFile(null);
      setMeta(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const content = await window.entropy.fs.readText(notePath);
        if (cancelled) return;
        const found: Array<{ label: string; href: string }> = [];
        LINK_RE.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = LINK_RE.exec(content)) !== null) {
          found.push({ label: match[1], href: match[2] });
        }
        setLinks(found);
        const words = content.trim() ? content.trim().split(/\s+/).length : 0;
        setMeta({
          title: notePath.split(/[/\\]/).pop()?.replace(/\.md$/i, "") ?? "Note",
          words,
          chars: content.length,
        });
        const related = await window.entropy.fs.findBacklinks(workspace.path, notePath);
        if (!cancelled) setBacklinks(related);
      } catch {
        if (!cancelled) {
          setLinks([]);
          setBacklinks([]);
          setMeta(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [notePath, workspace.path]);

  const preview = previewEntry ?? linkedFile;

  async function openLinked(href: string): Promise<void> {
    if (!notePath) return;
    try {
      const noteDir = await window.entropy.fs.dirname(notePath);
      const absolute = await window.entropy.fs.join(noteDir, href);
      if (!(await window.entropy.fs.exists(absolute))) {
        setLinkedFile(null);
        return;
      }
      const info = await window.entropy.fs.stat(absolute);
      if (info.extension.toLowerCase() === ".md") {
        onOpenNote(info.path);
        return;
      }
      setLinkedFile(info);
      onClearPreview?.();
    } catch {
      setLinkedFile(null);
    }
  }

  if (!notePath && !previewEntry) return null;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="min-w-0 px-4 py-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {preview && !notePath ? "Selection" : "Context"}
        </h2>
        {notePath && meta ? (
          <>
            <p className="mt-2 truncate text-sm text-paper" title={meta.title}>
              {meta.title}
            </p>
            <p className="mt-1 text-xs text-paper-2">
              {meta.words} words · {meta.chars} characters
            </p>
          </>
        ) : null}
        {notePath && !meta ? <p className="mt-2 text-xs text-muted-foreground">Loading…</p> : null}
      </div>

      <Separator />

      <ScrollArea className="min-h-0 min-w-0 flex-1">
        <div className="min-w-0 space-y-5 p-4">
          {preview ? (
            <section className="min-w-0">
              <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
                <h3 className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Media
                </h3>
                <div className="flex items-center gap-0.5">
                  {onReference ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="Reference in note"
                      onClick={() => onReference(preview)}
                    >
                      <Link2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Open externally"
                    onClick={() => void window.entropy.fs.openExternal(preview.path)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </Button>
                  {onClearPreview && previewEntry ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="Clear selection"
                      onClick={onClearPreview}
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </Button>
                  ) : null}
                </div>
              </div>
              <p className="mb-2 min-w-0 truncate text-sm text-foreground" title={preview.name}>
                {preview.name}
              </p>
              <div className="min-w-0 w-full overflow-hidden">
                {preview.isDirectory ? (
                  <div className="w-full max-w-full overflow-hidden rounded-lg">
                    <EntryPreview entry={preview} size="lg" className="max-h-40" />
                  </div>
                ) : (
                  <FilePreview file={preview} compact />
                )}
              </div>
            </section>
          ) : notePath ? (
            <p className="text-xs text-muted-foreground">
              Select a file in the library to preview it here, or click a link in the note.
            </p>
          ) : null}

          {notePath ? (
            <>
              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  In this note
                </h3>
                {links.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No links yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {links.map((link) => (
                      <li key={`${link.label}-${link.href}`}>
                        <button
                          type="button"
                          className="flex w-full flex-col rounded-md px-2 py-2 text-left hover:bg-accent"
                          onClick={() => void openLinked(link.href)}
                        >
                          <span className="truncate text-sm text-foreground">{link.label}</span>
                          <span className="truncate text-[11px] text-muted-foreground">{link.href}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Linked from
                </h3>
                {backlinks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nothing links here yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {backlinks.map((item) => (
                      <li key={item.path}>
                        <button
                          type="button"
                          className="flex w-full flex-col rounded-md px-2 py-2 text-left hover:bg-accent"
                          onClick={() => onOpenNote(item.path)}
                        >
                          <span className="truncate text-sm text-foreground">
                            {item.name.replace(/\.md$/i, "")}
                          </span>
                          {item.excerpt ? (
                            <span className="line-clamp-2 text-[11px] text-muted-foreground">
                              {item.excerpt}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
