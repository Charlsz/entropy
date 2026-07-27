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
  createEmptyCanvas,
  defaultSize,
  detectCanvasType,
  type CanvasObject,
} from "../canvas/types";
import { CanvasObjectView } from "../canvas/CanvasObjectView";

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
  const [camera, setCamera] = useState<Camera>(createEmptyCanvas().camera);
  const [objects, setObjects] = useState<CanvasObject[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selection, setSelection] = useState<SelectionBox | null>(null);
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
    function onKeyDown(event: KeyboardEvent): void {
      if (event.code === "Space") spaceDown.current = true;
      if (event.key === "Delete" || event.key === "Backspace") {
        setObjects((prev) => prev.filter((item) => !selectedIds.includes(item.id)));
        setSelectedIds([]);
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
        <span className="canvas-hint">
          Drop files from Files · References only · Delete removes canvas cards, not files
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
          {objects.map((object) => (
            <CanvasObjectView
              key={object.id}
              object={object}
              selected={selectedIds.includes(object.id)}
              scale={camera.scale}
              onSelect={(id) => setSelectedIds([id])}
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
