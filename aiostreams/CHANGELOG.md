# Changelog

## 0.1.1

- Make the existing encryption key field genuinely optional so Home Assistant
  no longer displays it as required.

## 0.1.0

- Initial Home Assistant add-on packaging.
- Pin the official AIOStreams image to `v2.32.1`.
- Persist SQLite data, cache, and an automatically generated encryption key.
- Add guarded key migration and administrator authentication.
