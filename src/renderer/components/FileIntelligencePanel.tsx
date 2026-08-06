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
import { findFileConnections } from "../lib/fileConnections";
import { formatBytes, formatModifiedLabel } from "../lib/format";
import { isPreviewableEntry, mediaKind } from "../lib/media";
import { figma } from "../lib/figmaTokens";
import { useWorkspace } from "../state/useWorkspace";
import { EntryPreview } from "./EntryPreview";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface FileIntelligencePanelProps {
  entry: FileEntry;
  scanRoot: string;
  onClose: () => void;
}

export function FileIntelligencePanel({
  entry,
  scanRoot,
  onClose,
}: FileIntelligencePanelProps) {
  const { workspace } = useWorkspace();
  const [noteCount, setNoteCount] = useState<number | null>(null);
  const [dupBytes, setDupBytes] = useState<number | null>(null);
  const [relatedCount, setRelatedCount] = useState<number | null>(null);
  const [osPreview, setOsPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const connections = await findFileConnections(entry.path, {
        path: workspace.path,
        name: workspace.name,
      });
      if (!cancelled) setNoteCount(connections.length);
    })();
    return () => {
      cancelled = true;
    };
  }, [entry.path, workspace.name, workspace.path]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (entry.isDirectory || !scanRoot) {
        setDupBytes(null);
        setRelatedCount(null);
        return;
      }
      const dups = await window.entropy.fs
        .findDuplicates(scanRoot, entry.path)
        .catch(() => [] as FileEntry[]);
      if (cancelled) return;
      const others = dups.filter((item) => item.path !== entry.path);
      setRelatedCount(others.length);
      setDupBytes(others.reduce((sum, item) => sum + (item.size || entry.size), 0));
    })();
    return () => {
      cancelled = true;
    };
  }, [entry.isDirectory, entry.path, entry.size, scanRoot]);

  useEffect(() => {
    let cancelled = false;
    setOsPreview(false);
    if (!isPreviewableEntry(entry)) return;
    void window.entropy.fs.canOsPreview(entry.path).then((ok) => {
      if (!cancelled) setOsPreview(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [entry]);

  const parentName =
    entry.path.replace(/\\/g, "/").split("/").slice(-2, -1)[0] ||
    workspace.inventoryRootLabel ||
    "Home";
  const kind = mediaKind(entry.extension);
  const previewLabel =
    kind === "image" ? "Image Analysis - Preview" : "Preview";
  const modified = formatModifiedLabel(entry.modifiedAt);

  return (
    <aside
      className="flex h-full min-h-0 w-full flex-col"
      style={{ backgroundColor: figma.surface, borderLeft: `1px solid ${figma.border}` }}
      aria-label="File Intelligence"
    >
      <div
        className="flex items-start gap-2 p-5"
        style={{ borderBottom: `1px solid ${figma.border}` }}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase" style={{ color: figma.muted }}>
            File Intelligence
          </p>
          <p className="break-all text-[14px] font-semibold" style={{ color: figma.ink }}>
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
              <X className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Close</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-col gap-4 p-5">
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
                    : `${relatedCount} document${relatedCount === 1 ? "" : "s"}`}
                </strong>
              </>
            }
          />
          <IntelRow
            icon={DatabaseBackup}
            text={
              <>
                Consuming{" "}
                <strong className="font-semibold">
                  {dupBytes == null ? "…" : formatBytes(dupBytes || entry.size)}
                </strong>{" "}
                with similar files
              </>
            }
          />
        </div>
      </div>

      {osPreview ? (
        <div className="flex flex-col gap-2.5 p-5 pt-0">
          <p className="text-[11px] font-semibold uppercase" style={{ color: figma.muted }}>
            {previewLabel}
          </p>
          <div
            className="relative h-[140px] overflow-hidden rounded-[6px]"
            style={{ border: `1px solid ${figma.border}` }}
          >
            <EntryPreview entry={entry} size="lg" className="!h-full !w-full object-cover" />
          </div>
        </div>
      ) : null}
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
