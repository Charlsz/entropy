import {
  Copy,
  ExternalLink,
  FolderOpen,
  Pencil,
  Trash2,
} from "lucide-react";
import type { FileEntry } from "../../shared/types";
import { FilePreview } from "../pages/FilePreview";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { Badge } from "./ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(value: number): string {
  return new Date(value).toLocaleString();
}

interface FileContextPanelProps {
  selected: FileEntry;
  renaming: boolean;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function FileContextPanel({
  selected,
  renaming,
  renameValue,
  onRenameValueChange,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDuplicate,
  onDelete,
}: FileContextPanelProps) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="space-y-4 p-4">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {selected.isDirectory ? "Folder" : "Details"}
          </h2>
          {renaming ? (
            <Input
              className="mt-2"
              value={renameValue}
              autoFocus
              onChange={(event) => onRenameValueChange(event.target.value)}
              onBlur={() => onCommitRename()}
              onKeyDown={(event) => {
                if (event.key === "Enter") onCommitRename();
                if (event.key === "Escape") onCancelRename();
              }}
            />
          ) : (
            <p className="mt-2 break-all text-sm font-medium text-foreground">{selected.name}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {selected.isDirectory ? "Folder" : selected.extension || "File"}
          </Badge>
          {!selected.isDirectory ? (
            <Badge variant="secondary">{formatBytes(selected.size)}</Badge>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-8 w-8"
                aria-label="Rename"
                onClick={onStartRename}
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Rename</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-8 w-8"
                aria-label="Duplicate"
                onClick={onDuplicate}
              >
                <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Duplicate</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-8 w-8"
                aria-label="Delete"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Reveal in folder"
                onClick={() => void window.entropy.fs.reveal(selected.path)}
              >
                <FolderOpen className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reveal</TooltipContent>
          </Tooltip>
          {!selected.isDirectory ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Open externally"
                  onClick={() => void window.entropy.fs.openExternal(selected.path)}
                >
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open</TooltipContent>
            </Tooltip>
          ) : null}
        </div>

        {!selected.isDirectory ? (
          <>
            <Separator />
            <FilePreview file={selected} />
            <dl className="space-y-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Path</dt>
                <dd className="break-all text-foreground">{selected.path}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Type</dt>
                <dd>{selected.extension || "File"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Size</dt>
                <dd>{formatBytes(selected.size)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Modified</dt>
                <dd>{formatDate(selected.modifiedAt)}</dd>
              </div>
            </dl>
          </>
        ) : null}
      </div>
    </ScrollArea>
  );
}
