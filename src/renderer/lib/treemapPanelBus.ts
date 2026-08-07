/** Titlebar storage-map control → Library right panel (File Intelligence ↔ treemap). */

const EVENT = "entropy:treemap-panel-toggle";

export function requestTreemapPanelToggle(): void {
  window.dispatchEvent(new Event(EVENT));
}

export function onTreemapPanelToggle(handler: () => void): () => void {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
