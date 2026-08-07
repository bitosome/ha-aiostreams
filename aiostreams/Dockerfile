ARG AIOSTREAMS_VERSION=v2.32.1
FROM ghcr.io/viren070/aiostreams:${AIOSTREAMS_VERSION}

ARG BUILD_ARCH=unknown
ARG BUILD_VERSION=dev

LABEL \
  io.hass.name="AIOStreams" \
  io.hass.description="Self-hosted AIOStreams for Home Assistant" \
  io.hass.arch="${BUILD_ARCH}" \
  io.hass.type="app" \
  io.hass.version="${BUILD_VERSION}" \
  org.opencontainers.image.source="https://github.com/bitosome/ha-aiostreams"

COPY run-addon.mjs /app/run-addon.mjs

ENTRYPOINT ["/nodejs/bin/node"]
CMD ["/app/run-addon.mjs"]
