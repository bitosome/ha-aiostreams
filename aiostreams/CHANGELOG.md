# Changelog

## 0.2.0

- Upgrade AIOStreams to `v2.35.8` with the Jellyfin-compatible API at `/jellyfin`.
- Existing configuration credentials and persisted data remain in use.
- With media proxies disabled, playback redirects clients to provider URLs.

## 0.1.0

- Initial Home Assistant add-on packaging.
- Pin the official AIOStreams image to `v2.32.1`.
- Persist SQLite data, cache, and an automatically generated encryption key.
- Add guarded key migration and administrator authentication.
