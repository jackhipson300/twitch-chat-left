# Twitch Chat Left

A Firefox add-on that swaps Twitch's layout: chat goes on the **left**, the
followed-channels side panel goes on the **right**.

## How it works

- **Side panel:** `content.js` walks up from the side nav to the horizontal flex
  row it sits in and tags it, and `styles.css` uses CSS `order` to move it to the
  right end.
- **Chat:** Twitch floats the chat box over the right of the page and keeps that
  space clear by giving the player and the `--with-chat` elements a right-hand
  offset, margin or padding. The add-on moves that spacing to the left side and
  shifts the chat box (with the CSS `translate` property) so it lines up with
  the left edge of the main content.

Nothing in the page is removed or rebuilt, so Twitch keeps working normally.

A ⇄ button in the chat header (next to the collapse arrow) switches between the
swapped layout and Twitch's normal one. The choice is remembered. A `MutationObserver` re-applies the change as you
move between pages, since Twitch never does a full page reload.

## Install (temporary, for testing)

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Click **Load Temporary Add-on…** and select `manifest.json` in this folder.
3. Open or reload a Twitch channel.

A temporary add-on is removed when Firefox closes.

## Install (permanent)

Release Firefox only installs signed add-ons. Either:

- **Sign it for yourself (free):** zip the files (`manifest.json`, `content.js`,
  `styles.css`) and upload them to https://addons.mozilla.org/developers/ as
  **"On your own"** (unlisted). Mozilla signs it automatically and you get an
  `.xpi` to install. Or use `npx web-ext sign` with your AMO API keys.
- **Use Firefox Developer Edition or Nightly:** set
  `xpinstall.signatures.required` to `false` in `about:config`, then install the
  zipped `.xpi` from `about:addons` → gear icon → *Install Add-on From File*.

## If something looks wrong

Run `diagnose.js` in the console on the broken page (F12 → Console, paste,
Enter). It copies a description of the layout to your clipboard, which is enough
to fix the selectors. You can also set `DEBUG = true` at the top of `content.js`
to log what the add-on is doing.
