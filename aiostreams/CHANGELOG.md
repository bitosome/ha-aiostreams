# Changelog

## 0.2.2

- **Open Web UI** now works from anywhere Home Assistant is reachable. It
  opens a small page through Home Assistant ingress with links to the
  AIOStreams dashboard and configure page at `base_url`. Previously it pointed
  at `http://<the host you opened Home Assistant on>:3000/stremio/configure`,
  which fails when Home Assistant is opened through a domain or proxy that
  does not forward port 3000. AIOStreams cannot be embedded through ingress
  itself, because it expects to be served from the root of its host.

## 0.2.1

- Upgrade AIOStreams to `v2.38.1`: Jellyfin Live TV, ordered audio/subtitle
  language lists, watch-state fixes, catalog walk background lane and a new
  Xtream builtin. Existing configuration and data carry over unchanged.

## 0.2.0

- Upgrade AIOStreams to `v2.35.8` with the Jellyfin-compatible API at `/jellyfin`.
- Existing configuration credentials and persisted data remain in use.
- With media proxies disabled, playback redirects clients to provider URLs.

## 0.1.0

- Initial Home Assistant add-on packaging.
- Pin the official AIOStreams image to `v2.32.1`.
- Persist SQLite data, cache, and an automatically generated encryption key.
- Add guarded key migration and administrator authentication.
