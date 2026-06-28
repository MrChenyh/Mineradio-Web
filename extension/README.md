# Mineradio Connector

Optional Chrome/Edge Manifest V3 extension for Mineradio Web.

It lets the web player ask the extension background worker to use the browser's NetEase Cloud Music web session for:

- connection status
- song search
- lyrics
- playback URL tests

The extension does not send NetEase cookies to the web page.

## Edge Install For Testing

1. Open `edge://extensions`.
2. Enable Developer mode.
3. Click **Load unpacked**.
4. Select this `extension` folder.
5. Open or refresh Mineradio Web.

For an isolated test profile:

```powershell
npm run build:web
npm run preview:web
npm run test:edge-extension
```

Then open `https://music.163.com/` in the same Edge test window and log in if needed.
