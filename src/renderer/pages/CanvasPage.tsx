import { useCallback, useEffect, useRef, useState, type PointerEvent, type WheelEvent } from "react";

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

export function CanvasPage() {
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 1 });
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
  }, []);

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

  function onPointerDown(event: PointerEvent<HTMLDivElement>): void {
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);

    const rect = target.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
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
      const worldX = (localX - camera.x) / camera.scale;
      const worldY = (localY - camera.y) / camera.scale;
      setSelection({ x: worldX, y: worldY, width: 0, height: 0 });
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

    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const worldX = (localX - camera.x) / camera.scale;
    const worldY = (localY - camera.y) / camera.scale;
    const startWorldX = (drag.startX - rect.left - camera.x) / camera.scale;
    const startWorldY = (drag.startY - rect.top - camera.y) / camera.scale;

    setSelection({
      x: Math.min(startWorldX, worldX),
      y: Math.min(startWorldY, worldY),
      width: Math.abs(worldX - startWorldX),
      height: Math.abs(worldY - startWorldY),
    });
  }

  function onPointerUp(): void {
    dragRef.current = null;
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
        <span className="canvas-hint">
          Scroll to zoom · Drag to select · Space/Shift-drag or middle-click to pan
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
      >
        <div
          className="canvas-world"
          style={{
            transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`,
          }}
        >
          <div className="canvas-grid" />
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
