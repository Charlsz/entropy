import { useEffect, useState } from "react";
import { ExternalLink, Link2 } from "lucide-react";
import type { FileEntry, NoteSearchResult } from "../../shared/types";
import { FilePreview } from "../pages/FilePreview";
import { EntryPreview } from "./EntryPreview";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { useWorkspace } from "../state/useWorkspace";
import { isMediaEntry } from "../lib/media";

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
    <div className="flex h-full min-h-0 flex-col">
      {notePath ? (
        <>
          <div className="px-4 py-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Properties
            </h2>
            {meta ? (
              <>
                <p className="mt-2 truncate text-sm text-paper">{meta.title}</p>
                <p className="mt-1 break-all text-[11px] text-paper-2">{notePath}</p>
                <p className="mt-3 text-xs text-paper-2">
                  {meta.words} words · {meta.chars} characters
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Loading…</p>
            )}
          </div>
          <Separator />
        </>
      ) : (
        <div className="px-4 py-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Reference
          </h2>
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          {preview ? (
            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Preview
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
                    aria-label="Open file"
                    onClick={() => void window.entropy.fs.openExternal(preview.path)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </Button>
                </div>
              </div>
              <p className="mb-2 truncate text-sm text-foreground">{preview.name}</p>
              {preview.isDirectory ? (
                <div className="overflow-hidden rounded-xl">
                  <EntryPreview entry={preview} size="lg" />
                </div>
              ) : isMediaEntry(preview) || preview.extension.toLowerCase() === ".gif" ? (
                <FilePreview file={preview} />
              ) : (
                <FilePreview file={preview} />
              )}
            </section>
          ) : null}

          {notePath ? (
            <>
              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Links
                </h3>
                {links.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No outbound links in this note.</p>
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
                  Backlinks
                </h3>
                {backlinks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No notes link here yet.</p>
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
