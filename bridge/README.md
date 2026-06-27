# Mineradio Bridge

The Bridge is the local service used by Mineradio Web for online music APIs and media proxying.

## Start

```powershell
npm install
npm run bridge
```

Default address:

```text
http://127.0.0.1:37891
```

Pairing page:

```text
http://127.0.0.1:37891/pair
```

## Environment

- `MINERADIO_BRIDGE_PORT`: override the local Bridge port.
- `MINERADIO_WEB_URL`: override the web app URL used by `/pair`.
- `MINERADIO_WEB_ORIGINS`: comma-separated CORS allowlist.
- `MINERADIO_BRIDGE_TOKEN`: provide a fixed token instead of generating one.
- `MINERADIO_BRIDGE_TOKEN_FILE`: token file path.

## API

- `GET /health`
- `GET /pair`
- `GET/POST /api/*` with `X-Mineradio-Token`
- `GET /api/audio?url=...&token=...`
- `GET /api/cover?url=...&token=...`

Update and patch APIs return `WEB_BRIDGE_UPDATE_DISABLED`.
