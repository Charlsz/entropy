import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";
import {
  defaultSize,
  detectCanvasType,
  type CanvasConnection,
  type CanvasObject,
  type CanvasObjectType,
} from "../canvas/types";
import { CanvasObjectView } from "../canvas/CanvasObjectView";
import { useWorkspace } from "../state/WorkspaceContext";

interface Camera {
  x: number;
  y: number;
  scale: number;
}

interface SelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MIN_SCALE = 0.2;
const MAX_SCALE = 3;

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function CanvasPage() {
  const { workspace } = useWorkspace();
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 1 });
  const [objects, setObjects] = useState<CanvasObject[]>([]);
  const [connections, setConnections] = useState<CanvasConnection[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selection, setSelection] = useState<SelectionBox | null>(null);
  const [linkFromId, setLinkFromId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const spaceDown = useRef(false);
  const dragRef = useRef<{
    mode: "pan" | "select";
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    void window.entropy.canvas.load(workspace.path).then((doc) => {
      if (cancelled) return;
      if (doc) {
        setCamera(doc.camera);
        setObjects(
          doc.objects.map((item) => ({
            ...item,
            type: item.type as CanvasObjectType,
          })),
        );
        setConnections(doc.connections);
      } else {
        setCamera({ x: 0, y: 0, scale: 1 });
        setObjects([]);
        setConnections([]);
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [workspace.path]);

  useEffect(() => {
    if (!ready) return;
    const handle = window.setTimeout(() => {
      void window.entropy.canvas.save({
        version: 1,
        workspacePath: workspace.path,
        camera,
        objects,
        connections,
      });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [ready, workspace.path, camera, objects, connections]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.code === "Space") spaceDown.current = true;
      if (event.key === "Delete" || event.key === "Backspace") {
        const target = event.target as HTMLElement | null;
        if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;
        setObjects((prev) => prev.filter((item) => !selectedIds.includes(item.id)));
        setConnections((prev) =>
          prev.filter(
            (link) => !selectedIds.includes(link.fromId) && !selectedIds.includes(link.toId),
          ),
        );
        setSelectedIds([]);
      }
      if (event.key.toLowerCase() === "l" && selectedIds.length === 1) {
        setLinkFromId(selectedIds[0]);
      }
    }
    function onKeyUp(event: KeyboardEvent): void {
      if (event.code === "Space") spaceDown.current = false;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [selectedIds]);

  const onWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;

    setCamera((prev) => {
      const direction = event.deltaY > 0 ? -1 : 1;
      const nextScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, prev.scale * (1 + direction * 0.08)),
      );
      const worldX = (cursorX - prev.x) / prev.scale;
      const worldY = (cursorY - prev.y) / prev.scale;
      return {
        scale: nextScale,
        x: cursorX - worldX * nextScale,
        y: cursorY - worldY * nextScale,
      };
    });
  }, []);

  function screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - camera.x) / camera.scale,
      y: (clientY - rect.top - camera.y) / camera.scale,
    };
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>): void {
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const pan =
      event.button === 1 ||
      event.altKey ||
      event.shiftKey ||
      spaceDown.current ||
      event.buttons === 4;

    if (pan) {
      dragRef.current = {
        mode: "pan",
        startX: event.clientX,
        startY: event.clientY,
        originX: camera.x,
        originY: camera.y,
      };
      return;
    }

    if (event.button === 0) {
      dragRef.current = {
        mode: "select",
        startX: event.clientX,
        startY: event.clientY,
        originX: camera.x,
        originY: camera.y,
      };
      const world = screenToWorld(event.clientX, event.clientY);
      setSelection({ x: world.x, y: world.y, width: 0, height: 0 });
      setSelectedIds([]);
      setLinkFromId(null);
    }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current;
    if (!drag) return;

    if (drag.mode === "pan") {
      setCamera((prev) => ({
        ...prev,
        x: drag.originX + (event.clientX - drag.startX),
        y: drag.originY + (event.clientY - drag.startY),
      }));
      return;
    }

    const world = screenToWorld(event.clientX, event.clientY);
    const start = screenToWorld(drag.startX, drag.startY);
    const box = {
      x: Math.min(start.x, world.x),
      y: Math.min(start.y, world.y),
      width: Math.abs(world.x - start.x),
      height: Math.abs(world.y - start.y),
    };
    setSelection(box);
    setSelectedIds(
      objects
        .filter(
          (item) =>
            item.x >= box.x &&
            item.y >= box.y &&
            item.x + item.width <= box.x + box.width &&
            item.y + item.height <= box.y + box.height,
        )
        .map((item) => item.id),
    );
  }

  function onPointerUp(): void {
    dragRef.current = null;
  }

  async function addFromPath(filePath: string, x: number, y: number): Promise<void> {
    try {
      const info = await window.entropy.fs.stat(filePath);
      const type = detectCanvasType(info);
      const size = defaultSize(type);
      const object: CanvasObject = {
        id: uid(),
        type,
        x,
        y,
        width: size.width,
        height: size.height,
        path: filePath,
        title: info.name,
      };
      setObjects((prev) => [...prev, object]);
      setSelectedIds([object.id]);
    } catch {
      // Ignore invalid drops.
    }
  }

  async function onDrop(event: DragEvent<HTMLDivElement>): Promise<void> {
    event.preventDefault();
    const filePath = event.dataTransfer.getData("application/x-entropy-path");
    const world = screenToWorld(event.clientX, event.clientY);
    if (filePath) {
      await addFromPath(filePath, world.x, world.y);
    }
  }

  function addTextCard(): void {
    const size = defaultSize("text");
    const object: CanvasObject = {
      id: uid(),
      type: "text",
      x: (200 - camera.x) / camera.scale,
      y: (160 - camera.y) / camera.scale,
      width: size.width,
      height: size.height,
      path: "",
      title: "Text",
      text: "",
    };
    setObjects((prev) => [...prev, object]);
    setSelectedIds([object.id]);
  }

  function selectObject(id: string): void {
    if (linkFromId && linkFromId !== id) {
      setConnections((prev) => [
        ...prev,
        { id: uid(), fromId: linkFromId, toId: id },
      ]);
      setLinkFromId(null);
      setSelectedIds([id]);
      return;
    }
    setSelectedIds([id]);
  }

  function objectCenter(id: string): { x: number; y: number } | null {
    const object = objects.find((item) => item.id === id);
    if (!object) return null;
    return { x: object.x + object.width / 2, y: object.y + object.height / 2 };
  }

  return (
    <main className="content-area canvas-page" aria-label="Canvas">
      <div className="canvas-toolbar">
        <span>Zoom {Math.round(camera.scale * 100)}%</span>
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={() => setCamera({ x: 0, y: 0, scale: 1 })}
        >
          Reset view
        </button>
        <button type="button" className="btn btn-secondary btn-small" onClick={addTextCard}>
          Add text card
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={() => setLinkFromId(selectedIds[0] ?? null)}
          disabled={selectedIds.length !== 1}
        >
          {linkFromId ? "Click target to connect" : "Connect"}
        </button>
        <span className="canvas-hint">
          Layout autosaves per workspace · Press L then another card to connect
        </span>
      </div>

      <div
        ref={viewportRef}
        className="canvas-viewport"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => void onDrop(event)}
      >
        <div
          className="canvas-world"
          style={{
            transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`,
          }}
        >
          <div className="canvas-grid" />
          <svg className="canvas-connections" aria-hidden="true">
            {connections.map((link) => {
              const from = objectCenter(link.fromId);
              const to = objectCenter(link.toId);
              if (!from || !to) return null;
              return (
                <line
                  key={link.id}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="rgba(180,180,180,0.45)"
                  strokeWidth={2}
                />
              );
            })}
          </svg>
          {objects.map((object) => (
            <CanvasObjectView
              key={object.id}
              object={object}
              selected={selectedIds.includes(object.id)}
              scale={camera.scale}
              onSelect={selectObject}
              onMove={(id, x, y) =>
                setObjects((prev) =>
                  prev.map((item) => (item.id === id ? { ...item, x, y } : item)),
                )
              }
              onChangeText={(id, text) =>
                setObjects((prev) =>
                  prev.map((item) => (item.id === id ? { ...item, text } : item)),
                )
              }
            />
          ))}
          {selection ? (
            <div
              className="canvas-selection"
              style={{
                left: selection.x,
                top: selection.y,
                width: selection.width,
                height: selection.height,
              }}
            />
          ) : null}
        </div>
      </div>
    </main>
  );
}
