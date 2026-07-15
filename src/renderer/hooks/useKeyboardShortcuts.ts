import { useEffect } from 'react';

export interface ShortcutHandlers {
  onNewPage?: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  onNextPage?: () => void;
  onPrevPage?: () => void;
  onLinkFile?: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers, enabled = true): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (mod && key === 'n') {
        event.preventDefault();
        handlers.onNewPage?.();
        return;
      }

      if (mod && key === 's') {
        event.preventDefault();
        handlers.onSave?.();
        return;
      }

      if (mod && key === 'l') {
        event.preventDefault();
        handlers.onLinkFile?.();
        return;
      }

      if ((mod && key === 'backspace') || (mod && key === 'delete')) {
        // Avoid eating delete while typing in inputs unless explicitly intended
        if (isEditableTarget(event.target) && !(event.metaKey || event.ctrlKey)) {
          return;
        }
        event.preventDefault();
        handlers.onDelete?.();
        return;
      }

      if (mod && event.altKey && event.key === 'ArrowDown') {
        event.preventDefault();
        handlers.onNextPage?.();
        return;
      }

      if (mod && event.altKey && event.key === 'ArrowUp') {
        event.preventDefault();
        handlers.onPrevPage?.();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, handlers]);
}
