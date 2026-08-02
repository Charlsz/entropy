import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, FolderOpen, Link2, Trash2, X } from "lucide-react";
import type { FileEntry, NoteSearchResult } from "../../shared/types";
import { FilePreview } from "../pages/FilePreview";
import { EntryPreview } from "./EntryPreview";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./ui/tooltip";
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

/** Prefer the real filename for linked / embedded files. */
function linkDisplayLabel(link: NoteLink): string {
  const hrefBase = link.href.split(/[/\\]/).pop() ?? link.href;
  const label = link.label.trim();
  if (
    label &&
    label !== link.href &&
    label !== hrefBase &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(label)
  ) {
    return label;
  }
  return hrefBase;
}

interface NoteLink {
  label: string;
  href: string;
  missing: boolean;
}

interface NoteContextPanelProps {
  notePath: string | null;
  previewEntry?: FileEntry | null;
  /** Live editor buffer for the active note — preferred over disk reads. */
  liveContent?: string | null;
  onOpenNote: (path: string) => void;
  onReference?: (entry: FileEntry) => void;
  onClearPreview?: () => void;
  onRewriteHref?: (from: string, to: string | null) => void;
}

export function NoteContextPanel({
  notePath,
  previewEntry = null,
  liveContent = null,
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
  const [previewHistory, setPreviewHistory] = useState<FileEntry[]>([]);
  const [meta, setMeta] = useState<{ title: string; words: number; chars: number } | null>(null);

  useEffect(() => {
    setPreviewHistory([]);
    setLinkedFile(null);
  }, [notePath]);

  useEffect(() => {
    if (!notePath) {
      setLinks([]);
      setRawContent("");
      setBacklinks([]);
      setLinkedFile(null);
      setPreviewHistory([]);
      setMeta(null);
      return;
    }

    let cancelled = false;
    // Short debounce so typing a path doesn't thrash exists() checks; file add/remove still feels instant.
    const delayMs = liveContent != null ? 100 : 0;
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const content =
            liveContent != null ? liveContent : await window.entropy.fs.readText(notePath);
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
    }, delayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [notePath, workspace.path, liveContent]);

  const preview = previewEntry ?? linkedFile;
  const canGoBack = Boolean(preview);
  const broken = links.filter((link) => link.missing);

  function dismissPreview(): void {
    setPreviewHistory([]);
    setLinkedFile(null);
    onClearPreview?.();
  }

  function goBack(): void {
    if (previewHistory.length > 0) {
      const prev = previewHistory[previewHistory.length - 1]!;
      setPreviewHistory((h) => h.slice(0, -1));
      setLinkedFile(prev);
      onClearPreview?.();
      return;
    }
    dismissPreview();
  }

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
      const current = previewEntry ?? linkedFile;
      if (current && current.path !== info.path) {
        setPreviewHistory((h) => [...h, current]);
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

  const okLinks = links.filter((link) => !link.missing);
  const hasUseful =
    Boolean(preview) || broken.length > 0 || okLinks.length > 0 || backlinks.length > 0;

  if (!notePath && !previewEntry) return null;
  if (!hasUseful && notePath) return null;

  return (
    <div className="entropy-note-context flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="entropy-chrome-bar shrink-0 border-b border-border">
        {canGoBack ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                aria-label="Back"
                onClick={goBack}
              >
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Back</TooltipContent>
          </Tooltip>
        ) : null}
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-medium leading-none text-foreground"
            title={
              preview && !notePath
                ? preview.name
                : (meta?.title ?? notePath?.split(/[/\\]/).pop()?.replace(/\.md$/i, "") ?? "Note")
            }
          >
            {preview && !notePath
              ? preview.name
              : (meta?.title ?? notePath?.split(/[/\\]/).pop()?.replace(/\.md$/i, "") ?? "Note")}
          </p>
          {preview && notePath && preview.name !== meta?.title ? (
            <p
              className="entropy-context-subtitle mt-1 truncate text-[11px] leading-none text-muted-foreground"
              title={preview.name}
            >
              {preview.name}
            </p>
          ) : null}
        </div>
      </div>

      <ScrollArea className="min-h-0 min-w-0 flex-1" type="hover">
        <div className="min-w-0 space-y-4 p-4 entropy-context-body">
          {preview ? (
            <section className="min-w-0 space-y-2">
              <div className="flex min-w-0 items-center justify-end gap-0.5">
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
                {preview ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Clear selection"
                    onClick={dismissPreview}
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </Button>
                ) : null}
              </div>
              <div className="min-w-0 w-full overflow-hidden rounded-lg">
                {preview.isDirectory ? (
                  <EntryPreview entry={preview} size="lg" className="max-h-40" />
                ) : (
                  <FilePreview file={preview} compact />
                )}
              </div>
            </section>
          ) : null}

          {broken.length > 0 ? (
            <section className="min-w-0 space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Missing
              </h3>
              <ul className="min-w-0 space-y-1">
                {broken.map((link) => {
                  const name = linkDisplayLabel(link);
                  return (
                  <li
                    key={`broken-${link.label}-${link.href}`}
                    className="flex min-w-0 items-center gap-1 rounded-md py-1"
                  >
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="truncate text-sm text-foreground" title={name}>
                        {name}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      aria-label="Locate file"
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
                      onClick={() => void removeLink(link.href)}
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </Button>
                  </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {okLinks.length > 0 ? (
            <section className="min-w-0 space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                In this note
              </h3>
              <ul className="min-w-0 space-y-0.5">
                {okLinks.map((link) => {
                  const name = linkDisplayLabel(link);
                  return (
                  <li key={`${link.label}-${link.href}`} className="min-w-0">
                    <button
                      type="button"
                      className="flex w-full min-w-0 max-w-full overflow-hidden rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-accent"
                      title={name}
                      onClick={() => void openLinked(link.href)}
                    >
                      <span className="block min-w-0 flex-1 truncate">{name}</span>
                    </button>
                  </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {backlinks.length > 0 ? (
            <section className="min-w-0 space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Linked from
              </h3>
              <ul className="min-w-0 space-y-0.5">
                {backlinks.map((item) => {
                  const name = item.name.replace(/\.md$/i, "");
                  return (
                  <li key={item.path} className="min-w-0">
                    <button
                      type="button"
                      className="flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-md px-2 py-1.5 text-left hover:bg-accent"
                      title={name}
                      onClick={() => onOpenNote(item.path)}
                    >
                      <span className="block min-w-0 truncate text-sm text-foreground">
                        {name}
                      </span>
                      {item.excerpt ? (
                        <span className="line-clamp-2 text-[11px] text-muted-foreground">
                          {item.excerpt}
                        </span>
                      ) : null}
                    </button>
                  </li>
                  );
                })}
              </ul>
            </section>
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
