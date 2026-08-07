/** Titlebar storage-map control ↔ Library right panel (File Intelligence ↔ treemap). */

const TOGGLE_EVENT = "entropy:treemap-panel-toggle";
const CHROME_EVENT = "entropy:treemap-chrome-active";

export function requestTreemapPanelToggle(): void {
  window.dispatchEvent(new Event(TOGGLE_EVENT));
}

export function onTreemapPanelToggle(handler: () => void): () => void {
  window.addEventListener(TOGGLE_EVENT, handler);
  return () => window.removeEventListener(TOGGLE_EVENT, handler);
}

/** True only while the storage map is the visible right-panel content. */
export function setTreemapChromeActive(active: boolean): void {
  window.dispatchEvent(new CustomEvent(CHROME_EVENT, { detail: { active } }));
}

export function onTreemapChromeActive(handler: (active: boolean) => void): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ active: boolean }>).detail;
    handler(Boolean(detail?.active));
  };
  window.addEventListener(CHROME_EVENT, listener);
  return () => window.removeEventListener(CHROME_EVENT, listener);
}
