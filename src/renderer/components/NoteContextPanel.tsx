import { useEffect, useState } from "react";
import { ExternalLink, FolderOpen, Link2, Trash2, X } from "lucide-react";
import type { FileEntry, NoteSearchResult } from "../../shared/types";
import { FilePreview } from "../pages/FilePreview";
import { EntryPreview } from "./EntryPreview";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { useWorkspace } from "../state/useWorkspace";
import { rewriteMarkdownHref } from "../lib/linkRepair";

const LINK_RE = /\!?\[([^\]]*)\]\((<[^>]+>|[^)\s]+)\)/g;

function normalizeHref(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/** Prefer a single calm line when alt text duplicates the path/filename. */
function linkDisplayLabel(link: NoteLink): string {
  const hrefBase = link.href.split(/[/\\]/).pop() ?? link.href;
  const label = link.label.trim();
  if (!label || label === link.href || label === hrefBase) return hrefBase;
  return label;
}

function linkHrefAddsInfo(link: NoteLink): boolean {
  const label = linkDisplayLabel(link);
  const href = link.href.trim();
  const hrefBase = href.split(/[/\\]/).pop() ?? href;
  return href !== label && hrefBase !== label;
}

interface NoteLink {
  label: string;
  href: string;
  missing: boolean;
}

interface NoteContextPanelProps {
  notePath: string | null;
  previewEntry?: FileEntry | null;
  onOpenNote: (path: string) => void;
  onReference?: (entry: FileEntry) => void;
  onClearPreview?: () => void;
  onRewriteHref?: (from: string, to: string | null) => void;
}

export function NoteContextPanel({
  notePath,
  previewEntry = null,
  onOpenNote,
  onReference,
  onClearPreview,
  onRewriteHref,
}: NoteContextPanelProps) {
  const { workspace } = useWorkspace();
  const [links, setLinks] = useState<NoteLink[]>([]);
  const [rawContent, setRawContent] = useState("");
  const [backlinks, setBacklinks] = useState<NoteSearchResult[]>([]);
  const [linkedFile, setLinkedFile] = useState<FileEntry | null>(null);
  const [meta, setMeta] = useState<{ title: string; words: number; chars: number } | null>(null);

  useEffect(() => {
    if (!notePath) {
      setLinks([]);
      setRawContent("");
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
        setRawContent(content);
        const found = await resolveLinks(notePath, content);
        if (cancelled) return;
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
          setRawContent("");
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
  const broken = links.filter((link) => link.missing);

  async function openLinked(href: string): Promise<void> {
    if (!notePath) return;
    try {
      const absolute = await resolveAbsolute(notePath, href);
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

  async function removeLink(href: string): Promise<void> {
    const next = rewriteMarkdownHref(rawContent, href, null);
    setRawContent(next);
    onRewriteHref?.(href, null);
    if (notePath) setLinks(await resolveLinks(notePath, next));
  }

  async function locateLink(href: string): Promise<void> {
    if (!notePath) return;
    const picked = await window.entropy.fs.pickFile();
    if (!picked) return;
    const noteDir = await window.entropy.fs.dirname(notePath);
    const relative = await window.entropy.fs.relative(noteDir, picked);
    const nextHref = relative.replace(/\\/g, "/");
    const wrapped = /\s/.test(nextHref) ? `<${nextHref}>` : nextHref;
    const next = rewriteMarkdownHref(rawContent, href, wrapped);
    setRawContent(next);
    onRewriteHref?.(href, wrapped);
    setLinks(await resolveLinks(notePath, next));
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
            Drag a library file here, or click a link.
          </p>
          ) : null}

          {notePath && broken.length > 0 ? (
            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Missing
              </h3>
              <ul className="space-y-1">
                {broken.map((link) => (
                  <li
                    key={`broken-${link.label}-${link.href}`}
                    className="flex min-w-0 items-start gap-1 rounded-md px-1 py-1"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">
                        {linkDisplayLabel(link)}
                      </p>
                      {linkHrefAddsInfo(link) ? (
                        <p className="truncate text-[11px] text-muted-foreground" title={link.href}>
                          {link.href}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      aria-label="Locate file"
                      title="Locate"
                      onClick={() => void locateLink(link.href)}
                    >
                      <FolderOpen className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      aria-label="Remove link"
                      title="Remove"
                      onClick={() => void removeLink(link.href)}
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {notePath ? (
            <>
              {links.length === 0 || links.some((link) => !link.missing) ? (
                <section>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    In this note
                  </h3>
                  {links.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No links yet.</p>
                  ) : (
                    <ul className="space-y-1">
                      {links
                        .filter((link) => !link.missing)
                        .map((link) => {
                          const title = linkDisplayLabel(link);
                          const showHref = linkHrefAddsInfo(link);
                          return (
                            <li key={`${link.label}-${link.href}`}>
                              <button
                                type="button"
                                className="flex w-full flex-col rounded-md px-2 py-2 text-left hover:bg-accent"
                                title={link.href}
                                onClick={() => void openLinked(link.href)}
                              >
                                <span className="truncate text-sm text-foreground">{title}</span>
                                {showHref ? (
                                  <span className="truncate text-[11px] text-muted-foreground">
                                    {link.href}
                                  </span>
                                ) : null}
                              </button>
                            </li>
                          );
                        })}
                    </ul>
                  )}
                </section>
              ) : null}

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

async function resolveAbsolute(notePath: string, href: string): Promise<string> {
  const clean = normalizeHref(href);
  if (/^[a-zA-Z]:[\\/]/.test(clean) || clean.startsWith("\\\\") || clean.startsWith("/")) {
    return clean;
  }
  const noteDir = await window.entropy.fs.dirname(notePath);
  return window.entropy.fs.join(noteDir, clean);
}

async function resolveLinks(notePath: string, content: string): Promise<NoteLink[]> {
  const found: NoteLink[] = [];
  const seen = new Set<string>();
  LINK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LINK_RE.exec(content)) !== null) {
    const label = match[1];
    const href = normalizeHref(match[2]);
    if (/^(https?:|mailto:|data:)/i.test(href)) continue;
    const key = `${label}\0${href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    let missing = true;
    try {
      const absolute = await resolveAbsolute(notePath, href);
      missing = !(await window.entropy.fs.exists(absolute));
    } catch {
      missing = true;
    }
    found.push({ label, href, missing });
  }
  return found;
}
