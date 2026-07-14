export interface PageSummary {
  id: string;
  title: string;
  fileName: string;
  relativePath: string;
  updatedAt: string;
}

export interface Page extends PageSummary {
  content: string;
}

export interface CreatePageInput {
  title?: string;
}

export interface WritePageInput {
  content: string;
  title?: string;
}
