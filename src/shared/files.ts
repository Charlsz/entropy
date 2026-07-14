export type FileKind = 'image' | 'pdf' | 'video' | 'audio' | 'other';

export interface FileRef {
  path: string;
  name: string;
  href: string;
  kind: FileKind;
  exists: boolean;
  isInsideWorkspace: boolean;
}
