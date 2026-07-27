export interface EntropyApi {
  platform: string;
  versions: {
    electron: string;
    chrome: string;
    node: string;
  };
}

declare global {
  interface Window {
    entropy: EntropyApi;
  }
}

export {};
