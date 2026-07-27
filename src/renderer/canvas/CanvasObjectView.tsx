import { useEffect, useState } from "react";
import type { CanvasObject } from "./types";

interface CanvasObjectViewProps {
  object: CanvasObject;
  selected: boolean;
  scale: number;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onChangeText?: (id: string, text: string) => void;
}

export function CanvasObjectView({
  object,
  selected,
  scale,
  onSelect,
  onMove,
  onChangeText,
}: CanvasObjectViewProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!object.path || (object.type !== "image" && object.type !== "video" && object.type !== "pdf")) {
      setUrl(null);
      return;
    }
    void window.entropy.fs.toUrl(object.path).then((next) => {
      if (!cancelled) setUrl(next);
    });
    return () => {
      cancelled = true;
    };
  }, [object.path, object.type]);

  return (
    <div
      className={`canvas-object canvas-object-${object.type}${selected ? " is-selected" : ""}`}
      style={{
        left: object.x,
        top: object.y,
        width: object.width,
        height: object.height,
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect(object.id);
        const startX = event.clientX;
        const startY = event.clientY;
        const originX = object.x;
        const originY = object.y;

        function onMovePointer(moveEvent: PointerEvent): void {
          onMove(
            object.id,
            originX + (moveEvent.clientX - startX) / scale,
            originY + (moveEvent.clientY - startY) / scale,
          );
        }

        function onUp(): void {
          window.removeEventListener("pointermove", onMovePointer);
          window.removeEventListener("pointerup", onUp);
        }

        window.addEventListener("pointermove", onMovePointer);
        window.addEventListener("pointerup", onUp);
      }}
    >
      <div className="canvas-object-title">{object.title}</div>
      {object.type === "image" && url ? <img src={url} alt={object.title} draggable={false} /> : null}
      {object.type === "video" && url ? <video src={url} controls /> : null}
      {object.type === "pdf" && url ? <iframe title={object.title} src={url} /> : null}
      {object.type === "note" ? <p className="canvas-object-body">Markdown reference</p> : null}
      {object.type === "folder" ? <p className="canvas-object-body">Folder reference</p> : null}
      {object.type === "file" ? <p className="canvas-object-body">File reference</p> : null}
      {object.type === "text" ? (
        <textarea
          className="canvas-object-text"
          value={object.text ?? ""}
          onChange={(event) => onChangeText?.(object.id, event.target.value)}
          onPointerDown={(event) => event.stopPropagation()}
          placeholder="Write a thought…"
        />
      ) : null}
    </div>
  );
}
