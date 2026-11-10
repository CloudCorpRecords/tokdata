# tokdata

tokdata is a small local bridge to the hosted HasData
TikTok MCP server, which returns public TikTok data as
JSON. It can look up a public profile from its handle,
walk the videos a public account has posted page by
page, read the comments on a public video (or the
replies to one comment), and search TikTok by keyword
for videos or for users.

The bridge keeps no TikTok data of its own. It answers
the tool list locally, exactly as captured from the
live endpoint, and forwards each tool call upstream,
returning whatever comes back untouched. The captured
surface is four read-only fetches over public content:
nothing is posted, sent, or stored by any tool, and no
tool in the surface carries contact details for any
individual.

## Tools

- `hasdata_tiktok_profile_getTikTokProfile` — fetch a
  public profile. Required: `handle` (the username,
  with or without the `@`). Returns nickname, biography,
  bio link, avatar URLs, verified and private flags,
  account creation time, and the followers, follows,
  likes, videos, and friends counts.
- `hasdata_tiktok_posts_getTikTokPosts` — fetch one
  page of an account's videos. Required: `handle`.
  Optional: `nextPageToken` to walk further back through
  the account's history. Each video comes back with its
  description, hashtags, mentions, like, comment, share,
  play, and collect counts, cover and playable URLs,
  music, duration, and timestamp.
- `hasdata_tiktok_comments_getTikTokComments` — fetch
  the comments on a public video. Required: `videoId`
  (the numeric id from the video's URL). Optional:
  `commentId` (return the replies to that comment
  instead of the top-level comments) and
  `nextPageToken` for paging. The first page of
  top-level comments also carries the video itself.
- `hasdata_tiktok_search_getTikTokSearch` — search by
  keyword. Required: `keyword`. Optional: `type`
  (`video` or `user`; videos are the default) and
  `nextPageToken` for paging. Video results carry the
  usual counts, URLs, music, and author; user results
  carry nickname, bio, avatar, verified flag, and
  follower count.

## Configuration

- `HASDATA_TIKTOK_MCP_URL` (optional) — override the
  upstream endpoint. Defaults to
  `https://mcp.hasdata.com/api/mcp?apis=tiktok` — note
  the `/api/` segment, which is part of the pinned URL.
  (The override hook is this rebuild's own labelled
  reconstruction.)
- `HASDATA_API_KEY` (optional) — when set, every
  upstream request carries an `x-api-key: <key>`
  header, for the caller's own HasData API key. When
  it is not set, no key header is sent. (The header
  name and the env name are pinned by the original's
  registry record; forwarding the key from this env
  var is a labelled reconstruction — the original
  surface was captured keyless.)

### Forwarding mechanics

On the first tool call the client opens a streamable
HTTP session upstream: a JSON-RPC `initialize` request
(protocolVersion `2025-03-26`, clientInfo name
`tokdata`), then a `notifications/initialized`
notification, then the `tools/call` request carrying
the caller's arguments unchanged. When the upstream
answers `initialize` with an `Mcp-Session-Id` header,
that value rides on every later request of the
session, which is reused for the life of the process.
Replies may arrive as plain JSON or as server-sent
events; both are read.

Successful upstream results pass through verbatim,
including any `isError` flag the upstream sets.
Failures — a JSON-RPC error, a non-2xx status, an
unreadable response, or a request that cannot be
completed — come back as an `isError` result whose
text starts with `tokdata error:` (this rendering is
this rebuild's own labelled reconstruction).

## CLI

Each tool is also a subcommand taking one JSON
argument string:

```bash
npx @reneturcios/tokdata hasdata_tiktok_profile_getTikTokProfile '{"handle":"tiktok"}'
npx @reneturcios/tokdata hasdata_tiktok_posts_getTikTokPosts '{"handle":"tiktok"}'
npx @reneturcios/tokdata hasdata_tiktok_comments_getTikTokComments '{"videoId":"0000000000000000000"}'
npx @reneturcios/tokdata hasdata_tiktok_search_getTikTokSearch '{"keyword":"dance","type":"video"}'
npx @reneturcios/tokdata --version
```

Exit codes: `0` on success, `1` on an `isError`
result, `2` on a usage error.

## MCP server

```bash
npx -y @reneturcios/tokdata mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "tokdata": {
      "command": "npx",
      "args": ["-y", "@reneturcios/tokdata", "mcp"]
    }
  }
}
```

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/tokdata
docker run --rm ghcr.io/cloudcorprecords/tokdata --version
```

The container's default command is `mcp`, so the first
form is a stdio MCP server; any other arguments reach
the CLI normally.

## Development

```bash
npm install
npm run build
npm test
npm run dev
```

The test suite runs entirely against a stubbed
JSON-RPC upstream — no live network calls.

## License

MIT — see `LICENSE`.
