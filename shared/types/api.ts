export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ReadyinessPillarView = {
  pillar: "health" | "finance" | "caregiving";
  score: number;
  interpretation: string;
};

export type StreamEvent =
  | { type: "meta"; classification: string; riskClass: string; messagePublicId: string }
  | { type: "token"; text: string }
  | { type: "ready" }
  | {
      type: "sources";
      sources: Array<{
        key: string;
        title: string;
        issuer: string;
        date?: string;
        url?: string;
        snippet?: string;
      }>;
    }
  | { type: "done"; abstained: boolean }
  | { type: "error"; code: string; message: string };
