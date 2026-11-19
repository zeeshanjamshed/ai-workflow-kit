export type Edit = { path: string; before: string | null; after: string | null };
export type Transaction = {
  id: string;
  action: string;
  edits: Edit[];
  inputs?: Record<string, string | null>;
};
export type SetupInput = { path: string; content: string | null };
