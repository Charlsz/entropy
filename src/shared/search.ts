export interface SearchHit {
  pageId: string;
  title: string;
  fileName: string;
  snippet: string;
  matchCount: number;
}

export interface SearchQuery {
  query: string;
  limit?: number;
}
