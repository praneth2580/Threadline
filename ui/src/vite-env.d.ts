/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  api?: {
    db?: {
      getTables(): Promise<string[]>;
      query(table: string): Promise<{ columns: string[]; rows: Record<string, unknown>[] }>;
    };
    scraper?: {
      getSessions(): Promise<string[]>;
      scrape(options: { url: string; session: string; interactive: boolean }): Promise<unknown>;
    };
  };
}
