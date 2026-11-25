# Twitch Chat Left

A Firefox add-on that swaps Twitch's layout: chat goes on the **left**, the
followed-channels side panel goes on the **right**.

A ⇄ button in the chat header (next to the collapse arrow) switches between the
swapped layout and Twitch's normal one. The choice is remembered.

## Install

1. Open the [latest release](https://github.com/jackhipson300/twitch-chat-left/releases/latest).
2. Click the `.xpi` file and let Firefox install it.

That's the only manual install. Firefox checks for updates and installs new
releases automatically (or immediately via `about:addons` → gear icon →
*Check for Updates*).

## Releasing

Push to the default branch. That's it.

The [Release workflow](.github/workflows/release.yml) then:

1. stamps the version as `<major>.<minor>.<run number>` (major/minor come from
   `extension/manifest.json`; bump those by hand only for a big change),
2. lints the extension,
3. has Mozilla sign it as an unlisted add-on (usually a few minutes),
4. publishes a GitHub release with the signed `.xpi` and an `updates.json`.

The manifest's `update_url` points at the latest release's `updates.json`, which
is how installed copies find new versions. That URL is fetched anonymously, so
the repo must stay public.

Signing uses the repo secrets `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` (API keys
from https://addons.mozilla.org/developers/addon/api/key/). Mozilla refuses a
version it has already signed, so re-running a run whose signing step succeeded
will fail; use *Run workflow* or push again instead.

## Development

```sh
npm install
npm run dev    # opens Firefox with the add-on loaded; reloads on every file change
npm run lint
```

`npm run dev` uses a dedicated Firefox profile (`twitch-chat-left-dev`) that keeps
your Twitch login and settings between runs.

## How it works

- **Side panel:** `content.js` walks up from the side nav to the horizontal flex
  row it sits in and tags it, and `styles.css` uses CSS `order` to move it to the
  right end.
- **Chat:** Twitch floats the chat box over the right of the page and keeps that
  space clear by giving the player and the `--with-chat` elements a right-hand
  offset, margin or padding. The add-on moves that spacing to the left side and
  shifts the chat box (with the CSS `translate` property) so it lines up with
  the left edge of the main content.

Nothing in the page is removed or rebuilt, so Twitch keeps working normally. A
`MutationObserver` re-applies the change as you move between pages, since Twitch
never does a full page reload.

## If something looks wrong

Run [`diagnose.js`](diagnose.js) in the console on the broken page (F12 →
Console, paste, Enter). It copies a description of the layout to your clipboard,
which is enough to fix the selectors. You can also set `DEBUG = true` at the top
of `extension/content.js` to log what the add-on is doing.
