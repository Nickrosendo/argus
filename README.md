# Argus

Argus is a free, open-source Chrome and Firefox extension that counts the time you actively spend on each website, lets you block distractions and run focus sessions.

There is no account and no server. Everything Argus records stays in your browser.

## Features

- Time per website, counted only while you are active (it pauses when you are idle or the browser is in the background)
- Today's stats, an hourly chart, categories, and a daily goal
- History for the last 90 days
- Website blocking with no limit on the number of sites, plus 3 temporary unblocks a day
- Focus sessions
- Backup and restore: export your data to a file and restore it after a reinstall or on another computer
- Light (Paper) and dark (Dusk) themes, following your system by default

## Privacy

Argus makes no network requests of its own; in Firefox the popup shows site icons from the address the browser recorded for each site. Nothing is collected or sent anywhere. The only links out are ones you click: Donate, Source code and Privacy.

## Install from source

Requires Node 20 and npm.

```bash
npm install
npm run build              # both browsers, into dist/chrome and dist/firefox
npm run build:chrome       # or build:firefox
npm test                   # Jest, with coverage
npm run release:check      # after `rm -rf dist && npm run build`
npm run package            # zip files for the stores
```

Load it in Chrome from `chrome://extensions` (Developer mode, Load unpacked, `dist/chrome/`), or in Firefox from `about:debugging` (Load Temporary Add-on, `dist/firefox/manifest.json`).

See [CLAUDE.md](./CLAUDE.md) for the architecture.

## Support

Argus is free and made by one person. If it helps you, you can support it with the Donate button in the extension, which opens the Ko-fi page.

## Contributing

Issues and pull requests are welcome at https://github.com/Nickrosendo/argus.

## License

MIT, see [LICENSE](LICENSE).
