# Mineradio Web

Mineradio Web is a GitHub Pages friendly version of Mineradio. The web UI is static and can be hosted from this repository, while online music sources are handled by a small local Bridge running on the user's machine.

## Architecture

```text
GitHub Pages Web UI
  -> http://127.0.0.1:37891
      -> Netease / QQ Music APIs
      -> audio and cover proxy
      -> lyrics, playlists, podcasts, login state
```

The browser UI keeps local-file playback, queueing, lyrics, covers, visual effects, and theme controls. Desktop-only Electron features such as desktop lyrics, wallpaper mode, global hotkeys, and installer updates are intentionally disabled in the web build.

## Run Locally

For source testing:

```powershell
npm install
npm run bridge
```

For a simpler local run, double-click `Start-Mineradio-Bridge.cmd`. Packaged Windows builds include `node\node.exe`, so users do not need to install Node.js.

In another terminal:

```powershell
npm run build:web
npm run preview:web
```

Open `http://127.0.0.1:4173/`, then open `http://127.0.0.1:37891/pair` to pair the web page with the Bridge token.

The web page also includes `bridge.html`, which explains the same flow for GitHub Pages users. After a packaged Bridge is available, replace that page's source-run instructions with the installer download link.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` builds `web/public` into `web/dist` and deploys it to GitHub Pages.

Expected public URL:

```text
https://mrchenyh.github.io/Mineradio-Web/
```

Users should:

1. Open the GitHub Pages player.
2. Download the Windows Bridge zip from the release/build artifact, unzip it, and double-click `Start-Mineradio-Bridge.cmd`.
3. Visit `http://127.0.0.1:37891/pair`.
4. Return to the player and use online music sources.

Optional: run `Install-Mineradio-Bridge-Startup.cmd` from the unzipped Bridge folder to start the Bridge automatically after Windows login.

## Platform Login

Bridge pairing is not the same as NetEase or QQ Music login. Platform accounts are still separate.

- NetEase Web mode uses cookie import by default because the old QR login API can trigger warnings in the NetEase app.
- QQ Music Web mode also uses cookie import because GitHub Pages cannot read `y.qq.com` cookies.
- The Bridge does not read login state from locally installed NetEase Cloud Music or QQ Music desktop apps.

For NetEase, paste a cookie from `music.163.com` that includes `MUSIC_U`. For QQ Music, paste a cookie from `y.qq.com` that includes `uin` and `qqmusic_key` or `qm_keyst`.

## Bridge Security

- The Bridge listens only on `127.0.0.1:37891`.
- `/health` and `/pair` are public; `/api/*` requires `X-Mineradio-Token` or a `token` query parameter for media URLs.
- CORS is limited to `https://mrchenyh.github.io` and local development origins.
- Private Network Access preflight is supported with `Access-Control-Allow-Private-Network: true`.
- `/api/audio` and `/api/cover` only proxy supported music-platform domains.
- Update and patch APIs are disabled in the Bridge. The web UI is updated by GitHub Pages.

## Upstream And License

This project is based on [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio). The upstream GPL-3.0 license and notices are preserved in `LICENSE`, `NOTICE.md`, `UPSTREAM_README.md`, `PRIVACY.md`, and `SECURITY.md`.

Mineradio Web is not an official NetEase Cloud Music, QQ Music, or Tencent Music Entertainment client. Third-party platform access is intended for personal learning, local client experience, and playback with the user's own account. It does not provide bypasses for paid content, memberships, audio quality restrictions, or redistribution of music content.
