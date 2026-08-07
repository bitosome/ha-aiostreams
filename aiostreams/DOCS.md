# AIOStreams add-on documentation

This add-on runs the official AIOStreams `v2.32.1` container and stores all
persistent state in Home Assistant's add-on data volume.

## Required configuration

### `base_url`

The exact public URL through which Stremio reaches AIOStreams. Examples:

- LAN-only browser testing: `http://homeassistant.local:3000`
- Reverse proxy: `https://aiostreams.example.com`

The value must not end with `/`. The launcher removes a trailing slash for you.

Stremio requires HTTPS for an add-on that is not hosted on `localhost`. For
normal Stremio use, place AIOStreams behind an HTTPS reverse proxy or tunnel,
forward it to Home Assistant port 3000, and set `base_url` to that HTTPS URL.
Home Assistant Cloud does not automatically publish add-on ports.

### `admin_username` and `admin_password`

These create the local AIOStreams administrator. The same credentials protect
the dashboard and, by default, `/stremio/configure`. The password may contain a
colon, but cannot contain a comma or line break because AIOStreams represents
local credentials as comma-separated `username:password` pairs.

### `protect_configure_page`

When enabled, users must sign in before configuring a Stremio installation.
Already-installed manifest and stream URLs continue to work normally.

### `secret_key`

Leave this empty for a new installation. On first start the add-on generates a
cryptographically random key and stores it at `/data/secret_key`.

Supply a 64-character hexadecimal key only when migrating an existing
AIOStreams installation. The launcher refuses to replace a persisted key,
because changing it makes existing encrypted configurations unreadable.

## Starting and configuring AIOStreams

1. Save the add-on configuration and start it.
2. Check the log for `Starting with BASE_URL=...` and a successful AIOStreams
   startup.
3. Select **Open Web UI**, or browse to
   `http://HOME_ASSISTANT_HOST:3000/stremio/configure`.
4. Sign in with the configured administrator credentials.
5. Configure sources, debrid services, filters, and other runtime settings in
   the AIOStreams interface.

## Persistence and backups

The following live in the add-on's automatically backed-up `/data` volume:

- `/data/db.sqlite` — configurations and runtime settings
- `/data/secret_key` — encryption key for saved configurations
- `/data/cache` — disk-backed cache

Back up both the database and secret together. A Home Assistant backup that
includes this add-on does that automatically. Restoring only the database
without its original secret makes encrypted configurations unusable.

## Network and security

Port 3000 is exposed directly because Stremio must be able to reach manifest and
stream endpoints without a Home Assistant ingress session. Do not expose the
plain HTTP port directly to the internet. Use a trusted HTTPS reverse proxy and
keep the administrator password strong.

If port 3000 conflicts with another service, change the host-side port in the
add-on Network section. Keep the public port in `base_url` synchronized with
that setting.

## Updating

The wrapper pins AIOStreams to `v2.32.1` so rebuilding the same add-on version is
deterministic. A future wrapper release must bump both the image tag in the
Dockerfile and the add-on version.

Before upgrading across a major AIOStreams migration, create a Home Assistant
backup and consult the [upstream AIOStreams documentation](https://docs.aiostreams.viren070.me/).

## Support boundary

- Packaging or Home Assistant startup problems:
  [ha-aiostreams issues](https://github.com/bitosome/ha-aiostreams/issues)
- AIOStreams behavior and configuration:
  [AIOStreams documentation](https://docs.aiostreams.viren070.me/)

AIOStreams aggregates third-party services and does not provide media. You are
responsible for how you configure it and for complying with applicable laws and
service terms.
