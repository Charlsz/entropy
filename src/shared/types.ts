export interface EntropyApi {
  platform: string;
  versions: {
    electron: string;
    chrome: string;
    node: string;
  };
  workspace: {
    open: () => Promise<string | null>;
    create: () => Promise<string | null>;
    remember: (path: string) => Promise<void>;
    getRecent: () => Promise<RecentWorkspace[]>;
    clearRecent: () => Promise<void>;
    removeRecent: (path: string) => Promise<void>;
  };
}

export interface RecentWorkspace {
  path: string;
  name: string;
  openedAt: number;
}

declare global {
  interface Window {
    entropy: EntropyApi;
  }
}

export {};
