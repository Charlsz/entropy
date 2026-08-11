import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Folder, PanelLeftClose } from "lucide-react";
import type { FileEntry } from "../../shared/types";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { figma } from "../lib/figmaTokens";
import { isUnderPath, samePath } from "../lib/platform";
import { cn } from "../lib/utils";

interface InventoryFolderTreeProps {
  rootPath: string;
  rootLabel: string;
  currentFolder: string;
  selectedFilePath: string | null;
  /** Bumps when the open folder changes on disk so expanded nodes reload. */
  diskEpoch: number;
  onOpenFolder: (folderPath: string) => void;
  onSelectFile: (entry: FileEntry) => void;
  onCollapse: () => void;
}

function ancestorPaths(rootPath: string, folderPath: string): string[] {
  if (!rootPath || !folderPath) return rootPath ? [rootPath] : [];
  if (samePath(rootPath, folderPath)) return [rootPath];
  if (!isUnderPath(folderPath, rootPath)) return [rootPath];

  const rootNorm = rootPath.replace(/[/\\]+$/, "");
  const folderNorm = folderPath.replace(/[/\\]+$/, "");
  const relative = folderNorm.slice(rootNorm.length).replace(/^[/\\]+/, "");
  if (!relative) return [rootPath];

  const parts = relative.split(/[/\\]/).filter(Boolean);
  const useBackslash = folderPath.includes("\\");
  const paths = [rootPath];
  let cursor = rootNorm;
  for (const part of parts) {
    cursor = useBackslash ? `${cursor}\\${part}` : `${cursor}/${part}`;
    paths.push(cursor);
  }
  return paths;
}

export function InventoryFolderTree({
  rootPath,
  rootLabel,
  currentFolder,
  selectedFilePath,
  diskEpoch,
  onOpenFolder,
  onSelectFile,
  onCollapse,
}: InventoryFolderTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([rootPath]));
  const [childrenByPath, setChildrenByPath] = useState<Record<string, FileEntry[]>>({});
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setExpanded(new Set(rootPath ? [rootPath] : []));
    setChildrenByPath({});
    setLoadingPaths(new Set());
  }, [rootPath]);

  const loadChildren = useCallback(async (folderPath: string) => {
    setLoadingPaths((prev) => {
      const next = new Set(prev);
      next.add(folderPath);
      return next;
    });
    try {
      const listing = await window.entropy.fs.listDir(folderPath);
      setChildrenByPath((prev) => ({ ...prev, [folderPath]: listing }));
    } catch {
      setChildrenByPath((prev) => ({ ...prev, [folderPath]: [] }));
    } finally {
      setLoadingPaths((prev) => {
        const next = new Set(prev);
        next.delete(folderPath);
        return next;
      });
    }
  }, []);

  // Keep the path to the current folder expanded and ensure children are loaded.
  useEffect(() => {
    if (!rootPath) return;
    const chain = ancestorPaths(rootPath, currentFolder || rootPath);
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const path of chain) next.add(path);
      return next;
    });
    for (const path of chain) {
      void loadChildren(path);
    }
  }, [rootPath, currentFolder, loadChildren, diskEpoch]);

  // Reload every expanded node when the watched folder tree changes on disk.
  useEffect(() => {
    if (!diskEpoch) return;
    for (const path of expanded) {
      void loadChildren(path);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only when diskEpoch bumps
  }, [diskEpoch]);

  const rootSelected = samePath(currentFolder, rootPath);

  function toggleExpanded(folderPath: string): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
        if (!childrenByPath[folderPath]) void loadChildren(folderPath);
      }
      return next;
    });
  }

  function handleFolderActivate(folderPath: string): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(folderPath);
      return next;
    });
    if (!childrenByPath[folderPath]) void loadChildren(folderPath);
    onOpenFolder(folderPath);
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      style={{ backgroundColor: figma.surface, borderRight: `1px solid ${figma.border}` }}
      aria-label="Folder tree"
    >
      <div
        className="flex h-10 shrink-0 items-center justify-between gap-2 px-3"
        style={{ borderBottom: `1px solid ${figma.border}` }}
      >
        <span
          className="truncate text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: figma.muted }}
        >
          Folders
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 bg-transparent text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground"
              aria-label="Hide folder tree"
              onClick={onCollapse}
            >
              <PanelLeftClose className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Hide folder tree</TooltipContent>
        </Tooltip>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-1 py-1.5">
          <TreeRow
            name={rootLabel}
            path={rootPath}
            isDirectory
            depth={0}
            expanded={expanded.has(rootPath)}
            selected={rootSelected}
            activeFolder={rootSelected}
            loading={loadingPaths.has(rootPath)}
            onToggle={() => toggleExpanded(rootPath)}
            onActivate={() => handleFolderActivate(rootPath)}
          />
          {expanded.has(rootPath) ? (
            <TreeChildren
              folderPath={rootPath}
              depth={1}
              expanded={expanded}
              childrenByPath={childrenByPath}
              loadingPaths={loadingPaths}
              currentFolder={currentFolder}
              selectedFilePath={selectedFilePath}
              onToggle={toggleExpanded}
              onOpenFolder={handleFolderActivate}
              onSelectFile={onSelectFile}
            />
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

function TreeChildren({
  folderPath,
  depth,
  expanded,
  childrenByPath,
  loadingPaths,
  currentFolder,
  selectedFilePath,
  onToggle,
  onOpenFolder,
  onSelectFile,
}: {
  folderPath: string;
  depth: number;
  expanded: Set<string>;
  childrenByPath: Record<string, FileEntry[]>;
  loadingPaths: Set<string>;
  currentFolder: string;
  selectedFilePath: string | null;
  onToggle: (path: string) => void;
  onOpenFolder: (path: string) => void;
  onSelectFile: (entry: FileEntry) => void;
}) {
  const children = childrenByPath[folderPath];
  if (!children) {
    if (loadingPaths.has(folderPath)) {
      return (
        <p className="px-3 py-1 text-[11px]" style={{ color: figma.muted, paddingLeft: 8 + depth * 12 }}>
          Loading…
        </p>
      );
    }
    return null;
  }

  return (
    <>
      {children.map((entry) => {
        const isDir = entry.isDirectory;
        const isExpanded = isDir && expanded.has(entry.path);
        const isActiveFolder = isDir && samePath(currentFolder, entry.path);
        const isSelectedFile =
          !isDir && selectedFilePath != null && samePath(selectedFilePath, entry.path);

        return (
          <div key={entry.path}>
            <TreeRow
              name={entry.name}
              path={entry.path}
              isDirectory={isDir}
              depth={depth}
              expanded={isExpanded}
              selected={isSelectedFile || isActiveFolder}
              activeFolder={isActiveFolder}
              loading={isDir && loadingPaths.has(entry.path)}
              onToggle={() => onToggle(entry.path)}
              onActivate={() => {
                if (isDir) onOpenFolder(entry.path);
                else onSelectFile(entry);
              }}
            />
            {isDir && isExpanded ? (
              <TreeChildren
                folderPath={entry.path}
                depth={depth + 1}
                expanded={expanded}
                childrenByPath={childrenByPath}
                loadingPaths={loadingPaths}
                currentFolder={currentFolder}
                selectedFilePath={selectedFilePath}
                onToggle={onToggle}
                onOpenFolder={onOpenFolder}
                onSelectFile={onSelectFile}
              />
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function TreeRow({
  name,
  path,
  isDirectory,
  depth,
  expanded,
  selected,
  activeFolder,
  loading,
  onToggle,
  onActivate,
}: {
  name: string;
  path: string;
  isDirectory: boolean;
  depth: number;
  expanded: boolean;
  selected: boolean;
  activeFolder: boolean;
  loading: boolean;
  onToggle: () => void;
  onActivate: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex w-full min-w-0 items-center gap-0.5 rounded-md py-1 pr-2 text-left text-[13px]",
        selected && "font-medium",
      )}
      style={{
        paddingLeft: 4 + depth * 12,
        backgroundColor: selected ? figma.select : "transparent",
        color: figma.ink,
      }}
      title={path}
    >
      {isDirectory ? (
        <button
          type="button"
          className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
          aria-label={expanded ? `Collapse ${name}` : `Expand ${name}`}
          aria-expanded={expanded}
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
        >
          {expanded ? (
            <ChevronDown className="size-3.5" strokeWidth={1.75} />
          ) : (
            <ChevronRight className="size-3.5" strokeWidth={1.75} />
          )}
        </button>
      ) : (
        <span className="size-5 shrink-0" aria-hidden />
      )}

      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-1.5 truncate rounded-sm text-left"
        onClick={onActivate}
        onDoubleClick={onActivate}
      >
        {isDirectory ? (
          <Folder className="size-[14px] shrink-0" style={{ color: figma.muted }} strokeWidth={1.75} />
        ) : (
          <FileText className="size-[14px] shrink-0" style={{ color: figma.muted }} strokeWidth={1.75} />
        )}
        <span className="truncate" style={{ color: activeFolder || selected ? figma.ink : undefined }}>
          {name}
        </span>
        {loading ? (
          <span className="ml-auto shrink-0 text-[10px]" style={{ color: figma.muted }}>
            …
          </span>
        ) : null}
      </button>
    </div>
  );
}
