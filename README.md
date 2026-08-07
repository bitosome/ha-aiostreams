# AIOStreams Home Assistant Add-on

Run a private [AIOStreams](https://github.com/Viren070/AIOStreams) instance on
Home Assistant OS or a supervised Home Assistant installation.

[![Open your Home Assistant instance and add this repository.](https://my.home-assistant.io/badges/supervisor_store.svg)](https://my.home-assistant.io/redirect/supervisor_store/?repository_url=https%3A%2F%2Fgithub.com%2Fbitosome%2Fha-aiostreams)

This repository contains a thin Home Assistant wrapper around the official
AIOStreams container. It persists the database, cache, and generated encryption
key in the add-on's `/data` volume and exposes the AIOStreams web interface on
port 3000.

## Install

1. In Home Assistant, open **Settings → Apps → App store** (called **Add-ons**
   on older versions).
2. Open **Repositories** and add:
   `https://github.com/bitosome/ha-aiostreams`
3. Install **AIOStreams**.
4. Set the required `base_url` and administrator password in the Configuration
   tab, then start the add-on.
5. Open `http://HOME_ASSISTANT_HOST:3000/stremio/configure` or use **Open Web
   UI**.

See [the add-on documentation](aiostreams/DOCS.md) for HTTPS, reverse proxy,
backup, and migration guidance.

## Supported systems

- Home Assistant OS
- Home Assistant Supervised
- `amd64` and `aarch64`

This project is an independent packaging of AIOStreams and is not affiliated
with the AIOStreams or Home Assistant projects.
