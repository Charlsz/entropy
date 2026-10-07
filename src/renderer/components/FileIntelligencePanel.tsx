import { useEffect, useState } from "react";
import {
  ChartNetwork,
  Clock,
  DatabaseBackup,
  File,
  FolderOpen,
  X,
} from "lucide-react";
import type { FileEntry } from "../../shared/types";
import { findFileConnections, type FileConnection } from "../lib/fileConnections";
import { formatModifiedLabel, formatSimilarConsumption } from "../lib/format";
import { isPreviewableEntry, mediaKind } from "../lib/media";
import { figma } from "../lib/figmaTokens";
import { samePath } from "../lib/platform";
import { useWorkspace } from "../state/useWorkspace";
import { EntryPreview } from "./EntryPreview";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface FileIntelligencePanelProps {
  entry: FileEntry;
  scanRoot: string;
  onClose: () => void;
  /** Open a similar file in Library (select / navigate). */
  onOpenSimilar?: (filePath: string) => void;
}

export function FileIntelligencePanel({
  entry,
  scanRoot,
  onClose,
  onOpenSimilar,
}: FileIntelligencePanelProps) {
  const { workspace, openNote, openInWorkspace } = useWorkspace();
  const [connections, setConnections] = useState<FileConnection[] | null>(null);
  const [similar, setSimilar] = useState<FileEntry[] | null>(null);
  const [dupBytes, setDupBytes] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setConnections(null);
    void (async () => {
      const found = await findFileConnections(entry.path, {
        path: workspace.path,
        name: workspace.name,
      });
      if (!cancelled) setConnections(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [entry.path, workspace.name, workspace.path]);

  useEffect(() => {
    let cancelled = false;
    setSimilar(null);
    setDupBytes(null);
    void (async () => {
      if (entry.isDirectory || !scanRoot) {
        if (!cancelled) {
          setSimilar([]);
          setDupBytes(0);
        }
        return;
      }
      const dups = await window.entropy.fs
        .findDuplicates(scanRoot, entry.path)
        .catch(() => [] as FileEntry[]);
      if (cancelled) return;
      const others = dups.filter((item) => item.path !== entry.path);
      setSimilar(others);
      setDupBytes(others.reduce((sum, item) => sum + item.size, 0));
    })();
    return () => {
      cancelled = true;
    };
  }, [entry.isDirectory, entry.path, entry.size, scanRoot]);

  const noteCount = connections?.length ?? null;
  const relatedCount = similar?.length ?? null;
  const showPreview = isPreviewableEntry(entry);

  const parentName =
    entry.path.replace(/\\/g, "/").split("/").slice(-2, -1)[0] ||
    workspace.inventoryRootLabel ||
    "Home";
  const kind = mediaKind(entry.extension);
  const previewLabel =
    kind === "image" ? "Image Analysis - Preview" : "Preview";
  const modified = formatModifiedLabel(entry.modifiedAt);

  function openConnection(connection: FileConnection): void {
    if (samePath(connection.workspacePath, workspace.path)) {
      openNote(connection.notePath);
      return;
    }
    openInWorkspace(connection.workspacePath, connection.notePath);
  }

  return (
    <aside
      className="flex h-full min-h-0 w-full flex-col"
      style={{ backgroundColor: figma.surface, borderLeft: `1px solid ${figma.border}` }}
      aria-label="File Intelligence"
    >
      <div
        className="flex h-9 shrink-0 items-center gap-2 px-4"
        style={{ borderBottom: `1px solid ${figma.border}` }}
      >
        <div className="flex min-w-0 flex-1 flex-col justify-center leading-tight">
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: figma.muted }}>
            File Intelligence
          </p>
          <p className="truncate text-[12px] font-semibold" style={{ color: figma.ink }} title={entry.name}>
            {entry.name}
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground"
              aria-label="Close File Intelligence"
              onClick={onClose}
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Close</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
        <p className="text-[12px] font-semibold uppercase" style={{ color: figma.muted }}>
          Connections & context
        </p>
        <div className="flex flex-col gap-3">
          <IntelRow
            icon={ChartNetwork}
            text={
              <>
                Referenced by{" "}
                <strong className="font-semibold">
                  {noteCount == null
                    ? "…"
                    : `${noteCount} note${noteCount === 1 ? "" : "s"}`}
                </strong>
              </>
            }
          />
          {connections && connections.length > 0 ? (
            <ul className="ml-[22px] flex flex-col gap-1">
              {connections.slice(0, 8).map((connection) => (
                <li key={`${connection.workspacePath}\0${connection.notePath}`}>
                  <button
                    type="button"
                    className="max-w-full truncate text-left text-[12px] underline-offset-2 hover:underline"
                    style={{ color: figma.ink }}
                    title={connection.notePath}
                    onClick={() => openConnection(connection)}
                  >
                    {connection.noteName}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <IntelRow
            icon={FolderOpen}
            text={
              <>
                Belongs to <strong className="font-semibold">{parentName}</strong>
              </>
            }
          />
          <IntelRow
            icon={Clock}
            text={
              modified.startsWith("Yesterday") || modified.startsWith("Today")
                ? `Modified ${modified.toLowerCase()}`
                : `Modified ${modified}`
            }
          />
          <IntelRow
            icon={File}
            text={
              <>
                Related to{" "}
                <strong className="font-semibold">
                  {relatedCount == null
                    ? "…"
                    : `${relatedCount} file${relatedCount === 1 ? "" : "s"}`}
                </strong>
              </>
            }
          />
          {similar && similar.length > 0 ? (
            <ul className="ml-[22px] flex flex-col gap-1">
              {similar.slice(0, 8).map((item) => (
                <li key={item.path}>
                  <button
                    type="button"
                    className="max-w-full truncate text-left text-[12px] underline-offset-2 hover:underline"
                    style={{ color: figma.ink }}
                    title={item.path}
                    onClick={() => onOpenSimilar?.(item.path)}
                  >
                    {item.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <IntelRow
            icon={DatabaseBackup}
            text={
              <>
                Consuming{" "}
                <strong className="font-semibold">
                  {formatSimilarConsumption(dupBytes)}
                </strong>{" "}
                with similar files
              </>
            }
          />
        </div>

        {showPreview ? (
          <div className="flex flex-col gap-2.5 pt-1">
            <p className="text-[11px] font-semibold uppercase" style={{ color: figma.muted }}>
              {previewLabel}
            </p>
            <div
              className="relative h-[220px] w-full overflow-hidden rounded-[6px]"
              style={{ border: `1px solid ${figma.border}`, backgroundColor: figma.canvas }}
            >
              <EntryPreview
                entry={entry}
                size="lg"
                fit="contain"
                className="!aspect-auto !h-full !w-full !rounded-[6px]"
              />
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function IntelRow({
  icon: Icon,
  text,
}: {
  icon: typeof Clock;
  text: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="size-[14px] shrink-0" style={{ color: figma.ink }} strokeWidth={1.75} />
      <p className="text-[13px]" style={{ color: figma.ink }}>
        {text}
      </p>
    </div>
  );
}
