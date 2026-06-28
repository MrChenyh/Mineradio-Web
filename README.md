# Mineradio Web

Mineradio Web is a GitHub Pages friendly visual music player. The current web build is local-first: users can open the page, import local music files, and use the visual player without installing a Bridge or logging in to music platforms.

An experimental public-source search is available in the UI. It tries public web endpoints directly from the browser, so availability depends on the third-party site's CORS, rate limits, and keyword rules. The home page also shows a few iTunes 30-second previews by default, so the first screen is usable before users import local files.

## Architecture

```text
GitHub Pages Web UI
  -> local file playback
  -> optional experimental public-source search
  -> visual effects, lyrics fallback, queue, local history
```

The browser UI keeps local-file playback, queueing, lyric fallback, covers, visual effects, and theme controls. Desktop-only Electron features such as desktop lyrics, wallpaper mode, global hotkeys, installer updates, platform login, and Bridge pairing are hidden in the web build.

## Browser Connector Prototype

`extension/` contains a Chrome/Edge Manifest V3 prototype named **Mineradio Connector**. It is optional. When loaded, the web player can ask the extension to use the browser's NetEase Cloud Music web session for search, lyrics, and playback URL tests.

Privacy boundary: the extension does not send music-site cookies to the page. It performs requests in the extension background worker and returns only status, song metadata, lyrics, and playback URL results.

Local Edge test:

```powershell
npm run build:web
npm run preview:web
powershell -ExecutionPolicy Bypass -File scripts/open-edge-extension-test.ps1
```

Then open `https://music.163.com/` in that Edge test window and log in if you want to test logged-in behavior. Refresh Mineradio Web; the search tab should show `试听源 + NE` when the connector is detected.

Manual install in your regular Edge:

1. Open `edge://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked**.
4. Select this repository's `extension` folder.
5. Refresh the Mineradio Web page.

## Run Locally

For source testing:

```powershell
npm install
npm run build:web
npm run preview:web
```

Open `http://127.0.0.1:4173/`, click the splash screen, then import local audio files from the upload button or home page.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` builds `web/public` into `web/dist` and deploys it to GitHub Pages.

Expected public URL:

```text
https://mrchenyh.github.io/Mineradio-Web/
```

Users should:

1. Open the GitHub Pages player.
2. Import local music files.
3. Optionally try the public-source search box. This is experimental and may fail when the source site blocks requests or rate-limits traffic.

## Public Source Notes

- iTunes Search API: used for default 30-second previews and fallback preview results.
- Audius API: used for open music search where available.
- LRCLIB: used as a browser-callable lyrics fallback for preview/open tracks.
- GD Music HK API: tested as browser-callable when the node is healthy, but it can return gateway errors; it remains experimental and is not required for the home previews.
- Buguyy: search JSON exists, but it does not return CORS headers and its download endpoint rejects unsupported User-Agent formats, so a pure GitHub Pages page cannot call it directly.
- tools.liumingye.cn: currently acts as a tools/navigation page, not a direct music API source for this app.

## Upstream And License

This project is based on [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio). The upstream GPL-3.0 license and notices are preserved in `LICENSE`, `NOTICE.md`, `UPSTREAM_README.md`, `PRIVACY.md`, and `SECURITY.md`.

Mineradio Web is not an official NetEase Cloud Music, QQ Music, Tencent Music Entertainment, or third-party public music site client. Public-source access is experimental and depends on the third-party site. This project does not provide bypasses for paid content, memberships, audio quality restrictions, or redistribution of music content.
