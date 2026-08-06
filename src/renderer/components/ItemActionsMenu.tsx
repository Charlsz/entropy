export interface ItemAction {
  label: string;
  onSelect?: () => void;
  destructive?: boolean;
  /** Hover/click opens a nested menu (e.g. Show in → Folders). */
  children?: ItemAction[];
}
