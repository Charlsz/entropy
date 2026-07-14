import type { EntropyApi } from './api';

declare global {
  interface Window {
    entropy: EntropyApi;
  }
}

export {};