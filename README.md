# Mineradio Web

Mineradio Web is a GitHub Pages friendly visual music player. The current web build is local-first: users can open the page, import local music files, and use the visual player without installing a Bridge or logging in to music platforms.

An experimental public-source search is available in the UI. It tries public web endpoints directly from the browser, so availability depends on the third-party site's CORS, rate limits, and keyword rules.

## Architecture

```text
GitHub Pages Web UI
  -> local file playback
  -> optional experimental public-source search
  -> visual effects, lyrics fallback, queue, local history
```

The browser UI keeps local-file playback, queueing, lyric fallback, covers, visual effects, and theme controls. Desktop-only Electron features such as desktop lyrics, wallpaper mode, global hotkeys, installer updates, platform login, and Bridge pairing are hidden in the web build.

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

## Upstream And License

This project is based on [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio). The upstream GPL-3.0 license and notices are preserved in `LICENSE`, `NOTICE.md`, `UPSTREAM_README.md`, `PRIVACY.md`, and `SECURITY.md`.

Mineradio Web is not an official NetEase Cloud Music, QQ Music, Tencent Music Entertainment, or third-party public music site client. Public-source access is experimental and depends on the third-party site. This project does not provide bypasses for paid content, memberships, audio quality restrictions, or redistribution of music content.
