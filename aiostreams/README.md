# AIOStreams

Self-host the official AIOStreams container as a Home Assistant add-on.

The add-on supports `amd64` and `aarch64`, persists its SQLite database and
encryption key in Home Assistant backups, and provides a direct web and Stremio
endpoint on port 3000.

Before first start, configure the public `base_url` and administrator password.
For Stremio clients outside the Home Assistant host, publish the service through
HTTPS and use that external URL as `base_url`.

See the **Documentation** tab for setup and backup details.
