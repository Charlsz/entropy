import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode2,
  FileText,
  Folder,
  Image,
} from "lucide-react";
import type { FileEntry } from "../../shared/types";
import { ScrollArea } from "./ui/scroll-area";
import { figma } from "../lib/figmaTokens";
import { samePath } from "../lib/platform";
import { cn } from "../lib/utils";

interface WorkspaceExplorerTreeProps {
  rootPath: string;
  rootLabel: string;
  activeFilePath: string | null;
  createFolderPath: string;
  diskEpoch: number;
  onOpenFolder: (folderPath: string) => void;
  onOpenFile: (entry: FileEntry) => void;
}

function fileIcon(entry: FileEntry) {
  if (entry.isDirectory) {
    return <Folder className="size-[14px] shrink-0" style={{ color: figma.muted }} strokeWidth={1.75} />;
  }
  const ext = entry.extension.toLowerCase();
  if (ext === ".md") {
    return <FileText className="size-[14px] shrink-0" style={{ color: figma.muted }} strokeWidth={1.75} />;
  }
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif", ".bmp"].includes(ext)) {
    return <Image className="size-[14px] shrink-0" style={{ color: figma.muted }} strokeWidth={1.75} />;
  }
  if (
    [".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go", ".java", ".c", ".cpp", ".css", ".json"].includes(
      ext,
    )
  ) {
    return <FileCode2 className="size-[14px] shrink-0" style={{ color: figma.muted }} strokeWidth={1.75} />;
  }
  return <File className="size-[14px] shrink-0" style={{ color: figma.muted }} strokeWidth={1.75} />;
}

export function WorkspaceExplorerTree({
  rootPath,
  rootLabel,
  activeFilePath,
  createFolderPath,
  diskEpoch,
  onOpenFolder,
  onOpenFile,
}: WorkspaceExplorerTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([rootPath]));
  const [childrenByPath, setChildrenByPath] = useState<Record<string, FileEntry[]>>({});
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(() => new Set());

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

  useEffect(() => {
    setExpanded(new Set(rootPath ? [rootPath] : []));
    setChildrenByPath({});
    setLoadingPaths(new Set());
    if (rootPath) void loadChildren(rootPath);
  }, [rootPath, loadChildren]);

  useEffect(() => {
    if (!diskEpoch) return;
    for (const path of expanded) {
      void loadChildren(path);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when diskEpoch bumps
  }, [diskEpoch]);

  // Expand ancestors when an active file is under the workspace.
  useEffect(() => {
    if (!activeFilePath || !rootPath) return;
    const rootNorm = rootPath.replace(/[/\\]+$/, "");
    const fileNorm = activeFilePath.replace(/[/\\]+$/, "");
    const rootKey = rootNorm.replace(/\\/g, "/").toLowerCase();
    const fileKey = fileNorm.replace(/\\/g, "/").toLowerCase();
    if (!fileKey.startsWith(rootKey)) return;

    const sep = activeFilePath.includes("\\") ? "\\" : "/";
    const relative = fileNorm.slice(rootNorm.length).replace(/^[/\\]+/, "");
    const parts = relative.split(/[/\\]/).filter(Boolean);
    if (parts.length <= 1) return;

    const folders: string[] = [];
    let cursor = rootNorm;
    for (let i = 0; i < parts.length - 1; i += 1) {
      cursor = `${cursor}${sep}${parts[i]}`;
      folders.push(cursor);
    }

    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(rootPath);
      for (const folder of folders) next.add(folder);
      return next;
    });
    for (const folder of folders) {
      void loadChildren(folder);
    }
  }, [activeFilePath, rootPath, loadChildren]);

  function toggleFolder(folderPath: string): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) next.delete(folderPath);
      else {
        next.add(folderPath);
        if (!childrenByPath[folderPath]) void loadChildren(folderPath);
      }
      return next;
    });
  }

  function activateFolder(folderPath: string): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(folderPath);
      return next;
    });
    if (!childrenByPath[folderPath]) void loadChildren(folderPath);
    onOpenFolder(folderPath);
  }

  return (
    <ScrollArea className="min-h-0 flex-1" type="hover">
      <div className="px-1 py-1.5 pb-6" aria-label="Workspace files">
        <TreeFolderRow
          name={rootLabel}
          path={rootPath}
          depth={0}
          expanded={expanded.has(rootPath)}
          selected={samePath(createFolderPath, rootPath)}
          loading={loadingPaths.has(rootPath)}
          onToggle={() => toggleFolder(rootPath)}
          onActivate={() => activateFolder(rootPath)}
        />
        {expanded.has(rootPath) ? (
          <TreeChildren
            folderPath={rootPath}
            depth={1}
            expanded={expanded}
            childrenByPath={childrenByPath}
            loadingPaths={loadingPaths}
            activeFilePath={activeFilePath}
            createFolderPath={createFolderPath}
            onToggle={toggleFolder}
            onOpenFolder={activateFolder}
            onOpenFile={onOpenFile}
          />
        ) : null}
      </div>
    </ScrollArea>
  );
}

function TreeChildren({
  folderPath,
  depth,
  expanded,
  childrenByPath,
  loadingPaths,
  activeFilePath,
  createFolderPath,
  onToggle,
  onOpenFolder,
  onOpenFile,
}: {
  folderPath: string;
  depth: number;
  expanded: Set<string>;
  childrenByPath: Record<string, FileEntry[]>;
  loadingPaths: Set<string>;
  activeFilePath: string | null;
  createFolderPath: string;
  onToggle: (path: string) => void;
  onOpenFolder: (path: string) => void;
  onOpenFile: (entry: FileEntry) => void;
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

  if (children.length === 0) {
    return (
      <p className="px-3 py-1 text-[11px]" style={{ color: figma.muted, paddingLeft: 8 + depth * 12 }}>
        Empty
      </p>
    );
  }

  return (
    <>
      {children.map((entry) => {
        if (entry.isDirectory) {
          const isExpanded = expanded.has(entry.path);
          return (
            <div key={entry.path}>
              <TreeFolderRow
                name={entry.name}
                path={entry.path}
                depth={depth}
                expanded={isExpanded}
                selected={samePath(createFolderPath, entry.path)}
                loading={loadingPaths.has(entry.path)}
                onToggle={() => onToggle(entry.path)}
                onActivate={() => onOpenFolder(entry.path)}
              />
              {isExpanded ? (
                <TreeChildren
                  folderPath={entry.path}
                  depth={depth + 1}
                  expanded={expanded}
                  childrenByPath={childrenByPath}
                  loadingPaths={loadingPaths}
                  activeFilePath={activeFilePath}
                  createFolderPath={createFolderPath}
                  onToggle={onToggle}
                  onOpenFolder={onOpenFolder}
                  onOpenFile={onOpenFile}
                />
              ) : null}
            </div>
          );
        }

        const active = activeFilePath != null && samePath(activeFilePath, entry.path);
        return (
          <button
            key={entry.path}
            type="button"
            className="entropy-quiet-row flex w-full min-w-0 items-center gap-1.5 py-1.5 pr-3 text-left text-[13px]"
            style={{
              paddingLeft: 8 + depth * 12 + 28,
              backgroundColor: active ? figma.select : "transparent",
              color: figma.ink,
            }}
            title={entry.path}
            onClick={() => onOpenFile(entry)}
          >
            {fileIcon(entry)}
            <span className={cn("truncate", active && "font-medium")}>{entry.name}</span>
          </button>
        );
      })}
    </>
  );
}

function TreeFolderRow({
  name,
  path,
  depth,
  expanded,
  selected,
  loading,
  onToggle,
  onActivate,
}: {
  name: string;
  path: string;
  depth: number;
  expanded: boolean;
  selected: boolean;
  loading: boolean;
  onToggle: () => void;
  onActivate: () => void;
}) {
  return (
    <div
      className="entropy-quiet-row flex w-full min-w-0 items-center gap-0.5 py-1 pr-2"
      style={{
        paddingLeft: 4 + depth * 12,
        backgroundColor: selected ? figma.select : "transparent",
      }}
      title={path}
    >
      <button
        type="button"
        className="flex size-5 shrink-0 items-center justify-center text-muted-foreground"
        aria-label={expanded ? `Collapse ${name}` : `Expand ${name}`}
        aria-expanded={expanded}
        onClick={onToggle}
      >
        {expanded ? (
          <ChevronDown className="size-3.5" strokeWidth={1.75} />
        ) : (
          <ChevronRight className="size-3.5" strokeWidth={1.75} />
        )}
      </button>
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[13px]"
        style={{ color: figma.ink }}
        onClick={onActivate}
      >
        <Folder className="size-[14px] shrink-0" style={{ color: figma.muted }} strokeWidth={1.75} />
        <span className={cn("truncate", selected && "font-medium")}>{name}</span>
        {loading ? (
          <span className="ml-auto shrink-0 text-[10px]" style={{ color: figma.muted }}>
            …
          </span>
        ) : null}
      </button>
    </div>
  );
}
