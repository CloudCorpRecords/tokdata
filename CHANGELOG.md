# Changelog

## 0.1.0 (2026-10-28)

- First release: a forwarding client for the hosted HasData TikTok MCP server, serving the four captured tools locally for tools/list and forwarding every tools/call upstream over a streamable-HTTP JSON-RPC session (initialize, notifications/initialized, tools/call, honouring the Mcp-Session-Id header when issued).
- Tools: `hasdata_tiktok_comments_getTikTokComments`, `hasdata_tiktok_posts_getTikTokPosts`, `hasdata_tiktok_profile_getTikTokProfile`, and `hasdata_tiktok_search_getTikTokSearch`.
- Upstream results pass through verbatim; upstream failures surface as `tokdata error:` text results.
- One bin serves the CLI (one subcommand per tool, plus `--version`) and the stdio MCP server (`mcp` subcommand). Upstream endpoint overridable via `HASDATA_TIKTOK_MCP_URL`; when `HASDATA_API_KEY` is set it is sent as an `x-api-key` header.
