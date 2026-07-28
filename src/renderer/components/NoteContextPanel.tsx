import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { FileEntry, NoteSearchResult } from "../../shared/types";
import { FilePreview } from "../pages/FilePreview";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { useWorkspace } from "../state/useWorkspace";

const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;

interface NoteContextPanelProps {
  notePath: string | null;
  onOpenNote: (path: string) => void;
}

export function NoteContextPanel({ notePath, onOpenNote }: NoteContextPanelProps) {
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

  if (!notePath || !meta) return null;

  async function openLinked(href: string): Promise<void> {
    try {
      const noteDir = await window.entropy.fs.dirname(notePath!);
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
    } catch {
      setLinkedFile(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-4 py-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Properties
        </h2>
        <p className="mt-2 truncate text-sm text-paper">{meta.title}</p>
        <p className="mt-1 break-all text-[11px] text-paper-2">{notePath}</p>
        <p className="mt-3 text-xs text-paper-2">
          {meta.words} words · {meta.chars} characters
        </p>
      </div>

      <Separator />

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
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

          {linkedFile ? (
            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Preview
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Open linked file"
                  onClick={() => void window.entropy.fs.openExternal(linkedFile.path)}
                >
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
                </Button>
              </div>
              <FilePreview file={linkedFile} />
            </section>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
