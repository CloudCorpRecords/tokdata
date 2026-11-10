/**
 * tokdata core: a forwarding client for the hosted
 * HasData TikTok MCP server.
 *
 * Nothing is scraped or searched locally. tools/list is
 * answered from the literal definitions below, taken
 * verbatim from a live capture of the upstream server
 * (name, title, description and inputSchema exactly as
 * captured, title key included). A tools/call travels
 * upstream over a streamable-HTTP JSON-RPC session: an
 * initialize POST, a notifications/initialized POST,
 * then the tools/call POST, carrying the Mcp-Session-Id
 * response header on later requests when the upstream
 * issues one. The session opens lazily on the first
 * forwarded call and is reused for the client's life.
 *
 * The endpoint is pinned to
 * https://mcp.hasdata.com/api/mcp?apis=tiktok — note the
 * /api/ segment; the path and query string belong to
 * the pinned URL — and may be replaced with the
 * HASDATA_TIKTOK_MCP_URL environment variable (that
 * override is a labelled reconstruction). When
 * HASDATA_API_KEY is set, every upstream request carries
 * an `x-api-key: <key>` header (header name pinned by the
 * registry record's remote declaration; forwarding the
 * key from this env var is a labelled reconstruction, as
 * the capture was taken keyless). When it is unset, no
 * key header goes out, and no Authorization header is
 * sent in either case.
 *
 * A successful upstream result is returned exactly as
 * received, isError flag and extra fields included.
 * Failures — an upstream JSON-RPC error, a non-2xx
 * status, a body that cannot be parsed, or a fetch that
 * throws or times out — become an isError result whose
 * text begins with `tokdata error:` (that rendering is
 * a labelled reconstruction). Replies may be plain JSON
 * or SSE (`data:` lines); the JSON-RPC message whose id
 * matches the request wins.
 */
import type {
  FetchFn,
  FetchResponseLike,
  ForwardDeps,
  ToolArgs,
  ToolDef,
  ToolResult,
} from "./types.js";

export const VERSION = "0.1.0";

export const DEFAULT_ENDPOINT_URL = "https://mcp.hasdata.com/api/mcp?apis=tiktok";

export const DEFAULT_TIMEOUT_MS = 30000;

export const PROTOCOL_VERSION = "2025-03-26";

/* ------------------------------------------------------------------ */
/* Tool definitions (tools/list literals, verbatim from the live       */
/* capture in harness/fixtures/hasdata-tiktok-tools-original.json)     */
/* ------------------------------------------------------------------ */

export const TOOL_DEFS: ToolDef[] = [
  {
    "name": "hasdata_tiktok_comments_getTikTokComments",
    "title": "tiktok_comments: GET /",
    "description": "Get TikTok Comments\n\nFetches the comments on a public TikTok video by its numeric video id, or the replies to a specific comment when commentId is given. Each comment returns text, like count, timestamp, reply count, and author (username, nickname, avatar, plus hasdataLink to the profile endpoint and hasdataPostsLink to the posts endpoint). The first page of top-level comments also returns `post` with the video's description, author, music, cover and video URLs, duration, hashtags, and its like, comment, share, play, and save counts. Supports token-based pagination via nextPageToken. Use for sentiment analysis, engagement research, or building comment datasets from a video discovered via the posts or search APIs.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "videoId": {
          "type": "string",
          "description": "The numeric id of the video (the number after `/video/` in a TikTok URL)."
        },
        "commentId": {
          "type": "string",
          "description": "When provided, returns the replies to this comment instead of the video's top-level comments."
        },
        "nextPageToken": {
          "type": "string",
          "description": "Defines the next page token. Use the `nextPageToken` value returned by the previous response. Omit it to fetch the first page."
        }
      },
      "required": [
        "videoId"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "hasdata_tiktok_posts_getTikTokPosts",
    "title": "tiktok_posts: GET /",
    "description": "Get TikTok Posts\n\nFetches a page of videos for a public TikTok account by username (handle) and returns each video with description, hashtags, mentions, like/comment/share/play/collect counts, cover and playable video URLs, music, duration, and timestamp. Returns a page of ~30 videos plus a `nextPageToken`; pass that token back to walk the account history one page at a time. Use to monitor competitor content, track engagement of creator videos, or build datasets of account content for vetting and analytics.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "handle": {
          "type": "string",
          "description": "The TikTok username of the account whose videos you want to scrape, with or without the `@` symbol."
        },
        "nextPageToken": {
          "type": "string",
          "description": "Defines the next page token. It is used for retrieving the next page of results. Use the `nextPageToken` value returned by the previous response. Omit it to fetch the first page."
        }
      },
      "required": [
        "handle"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "hasdata_tiktok_profile_getTikTokProfile",
    "title": "tiktok_profile: GET /",
    "description": "Get TikTok Profile\n\nFetches a public TikTok profile by username (handle) and returns nickname, biography, bio link, avatar URLs, verified/private flags, account creation time, and followers, follows, likes, videos, and friends counts. Use to enrich CRM/lead records, verify influencer reach before outreach, monitor competitor accounts, or build datasets of creator metadata for vetting and analytics.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "handle": {
          "type": "string",
          "description": "The TikTok username of the profile you want to scrape, with or without the `@` symbol."
        }
      },
      "required": [
        "handle"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "hasdata_tiktok_search_getTikTokSearch",
    "title": "tiktok_search: GET /",
    "description": "Search TikTok\n\nSearches TikTok by keyword and returns either videos (with description, hashtags, mentions, like/comment/share/play counts, cover and playable video URLs, music, and author) or users (nickname, bio, avatar, verified flag, follower count). Each author and each user carries a hasdataLink to their profile endpoint and a hasdataPostsLink to their posts endpoint. Supports token-based pagination via nextPageToken. Use for content discovery, trend research, influencer discovery, or building datasets from a keyword.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "keyword": {
          "type": "string",
          "description": "The phrase to search for on TikTok."
        },
        "type": {
          "type": "string",
          "enum": [
            "video",
            "user"
          ],
          "description": "What to search for — videos or users. Defaults to video."
        },
        "nextPageToken": {
          "type": "string",
          "description": "Defines the next page token. Use the `nextPageToken` value returned by the previous response. Omit it to fetch the first page."
        }
      },
      "required": [
        "keyword"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  }
];

export const TOOL_NAMES = TOOL_DEFS.map((t) => t.name);

/** Whether `name` belongs to the captured surface. */
export function isKnownTool(name: string): boolean {
  return TOOL_NAMES.includes(name);
}

/* ------------------------------------------------------------------ */
/* Forwarding client                                                   */
/* ------------------------------------------------------------------ */

function errorResult(detail: string): ToolResult {
  return {
    content: [{ type: "text", text: `tokdata error: ${detail}` }],
    isError: true,
  };
}

function rpcErrorMessage(error: unknown): string {
  if (error !== null && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message !== "") return message;
    return JSON.stringify(error);
  }
  return String(error);
}

/**
 * Read a JSON-RPC response body, tolerating SSE framing.
 * Returns the message whose id matches `expectedId` when
 * present, otherwise the last parseable message, otherwise
 * null when nothing in the body parses.
 */
export function parseRpcBody(
  text: string,
  expectedId?: number,
): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const candidates: Record<string, unknown>[] = [];
  const tryPush = (payload: string): void => {
    try {
      const parsed: unknown = JSON.parse(payload);
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        candidates.push(parsed as Record<string, unknown>);
      }
    } catch {
      // Not a JSON payload; skip this candidate.
    }
  };
  if (trimmed.includes("data:")) {
    for (const line of trimmed.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice("data:".length).trim();
      if (payload !== "" && payload !== "[DONE]") tryPush(payload);
    }
  } else {
    tryPush(trimmed);
  }
  if (candidates.length === 0) return null;
  if (expectedId !== undefined) {
    const match = candidates.find((c) => c.id === expectedId);
    if (match !== undefined) return match;
  }
  return candidates[candidates.length - 1];
}

async function defaultFetch(
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
): Promise<FetchResponseLike> {
  return fetch(url, init) as unknown as FetchResponseLike;
}

/**
 * A forwarding client that holds a single upstream
 * session, opened lazily on first use and reused from
 * then on (for the process lifetime in the MCP server,
 * or for a single invocation in the CLI).
 */
export class TokdataClient {
  private readonly deps: ForwardDeps;
  private sessionId: string | null = null;
  private ready = false;
  private sessionPromise: Promise<void> | null = null;
  private idCounter = 0;

  constructor(deps: ForwardDeps = {}) {
    this.deps = deps;
  }

  private fetchFn(): FetchFn {
    return this.deps.fetchFn ?? defaultFetch;
  }

  private endpointUrl(): string {
    if (this.deps.url && this.deps.url.trim() !== "") return this.deps.url.trim();
    const raw = (this.deps.env ?? process.env).HASDATA_TIKTOK_MCP_URL;
    if (raw && raw.trim() !== "") return raw.trim();
    return DEFAULT_ENDPOINT_URL;
  }

  private apiKey(): string | null {
    const raw = (this.deps.env ?? process.env).HASDATA_API_KEY;
    if (raw && raw.trim() !== "") return raw.trim();
    return null;
  }

  private timeoutMs(): number {
    if (typeof this.deps.timeoutMs === "number" && this.deps.timeoutMs > 0) {
      return this.deps.timeoutMs;
    }
    return DEFAULT_TIMEOUT_MS;
  }

  private nextId(): number {
    this.idCounter += 1;
    return this.idCounter;
  }

  private async post(
    body: unknown,
    withSession: boolean,
  ): Promise<FetchResponseLike> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    const key = this.apiKey();
    if (key !== null) headers["x-api-key"] = key;
    if (withSession && this.sessionId !== null) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs());
    try {
      return await this.fetchFn()(this.endpointUrl(), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async ensureSession(): Promise<void> {
    if (this.ready) return;
    if (this.sessionPromise === null) {
      this.sessionPromise = (async () => {
        const initId = this.nextId();
        const initRes = await this.post(
          {
            jsonrpc: "2.0",
            id: initId,
            method: "initialize",
            params: {
              protocolVersion: PROTOCOL_VERSION,
              capabilities: {},
              clientInfo: { name: "tokdata", version: VERSION },
            },
          },
          false,
        );
        const sessionId = initRes.headers.get("mcp-session-id");
        if (sessionId) this.sessionId = sessionId;
        const initText = await initRes.text();
        const initParsed = parseRpcBody(initText, initId);
        if (initParsed !== null && initParsed.error) {
          throw new Error(rpcErrorMessage(initParsed.error));
        }
        if (initRes.status < 200 || initRes.status >= 300) {
          throw new Error(`HTTP ${initRes.status}`);
        }
        if (initParsed === null && initText.trim() !== "") {
          throw new Error("malformed response");
        }
        const initializedRes = await this.post(
          { jsonrpc: "2.0", method: "notifications/initialized" },
          true,
        );
        try {
          await initializedRes.text();
        } catch {
          // Nothing needed from the notification response body.
        }
        this.ready = true;
      })();
    }
    try {
      await this.sessionPromise;
    } catch (err) {
      this.sessionPromise = null;
      this.sessionId = null;
      throw err;
    }
  }

  /** Forward one tool call; upstream failures come back as isError results. */
  async callTool(name: string, args: ToolArgs): Promise<ToolResult> {
    try {
      await this.ensureSession();
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }

    const callId = this.nextId();
    let callRes: FetchResponseLike;
    try {
      callRes = await this.post(
        {
          jsonrpc: "2.0",
          id: callId,
          method: "tools/call",
          params: { name, arguments: args ?? {} },
        },
        true,
      );
    } catch (err) {
      return errorResult(
        `request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const parsed = parseRpcBody(await callRes.text(), callId);
    if (parsed !== null && parsed.error) {
      return errorResult(rpcErrorMessage(parsed.error));
    }
    if (callRes.status < 200 || callRes.status >= 300) {
      return errorResult(`HTTP ${callRes.status}`);
    }
    if (parsed === null) return errorResult("malformed response");
    const result = parsed.result as ToolResult | undefined;
    if (result === undefined || result === null || typeof result !== "object") {
      return errorResult("malformed response");
    }
    // Hand the upstream result back exactly as received.
    return result;
  }
}

/** Build a forwarding client; tests inject a fake fetch and env through deps. */
export function createClient(deps: ForwardDeps = {}): TokdataClient {
  return new TokdataClient(deps);
}

/** One-shot helper: a fresh client for a single call (the CLI path). */
export async function callTool(
  name: string,
  args: ToolArgs,
  deps: ForwardDeps = {},
): Promise<ToolResult> {
  return new TokdataClient(deps).callTool(name, args);
}
