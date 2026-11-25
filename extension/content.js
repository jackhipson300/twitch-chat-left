(() => {
  'use strict';

  const DEBUG = false;
  const log = (...args) => DEBUG && console.log('[twitch-chat-left]', ...args);

  // Tried in order; the first match wins.
  const SIDE_NAV_SELECTORS = [
    '#side-nav',
    '[data-a-target="side-nav-bar"]',
    '[data-a-target="side-nav-bar-collapsed"]',
    '.side-nav',
  ];

  // The floating chat box. Twitch positions it absolutely over the right edge
  // of the page; its in-flow placeholder is 0px wide.
  const CHAT_SELECTORS = ['.channel-root__right-column'];

  // Elements that keep space clear for the chat on their right side (via
  // `right`, margin or padding). These get that space moved to the left side.
  const RESERVER_SELECTORS = ['[class*="--with-chat"]', '.persistent-player'];

  const ATTR = 'data-tcl';
  const MIRRORED = 'data-tcl-mirrored';

  function find(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  const isOutOfFlow = (el) => {
    const pos = getComputedStyle(el).position;
    return pos === 'absolute' || pos === 'fixed';
  };

  // ---- Side nav: reorder inside its flex row ------------------------------

  // Walk up from `el` to the nearest horizontal flex container that also holds
  // other real content, then tag the child of that container holding `el` so
  // CSS `order` puts it on the requested edge.
  function placeAtEdge(el, edge, marked) {
    let child = el;
    let parent = el.parentElement;
    while (parent && parent !== document.documentElement) {
      const cs = getComputedStyle(parent);
      if (cs.display.includes('flex') && cs.flexDirection.startsWith('row')) {
        const hasContentSiblings = [...parent.children].some(
          (c) => c !== child && !isOutOfFlow(c) && c.getBoundingClientRect().width > 50
        );
        if (hasContentSiblings) {
          const reversed = cs.flexDirection === 'row-reverse';
          const value = (edge === 'left') !== reversed ? 'first' : 'last';
          if (child.getAttribute(ATTR) !== value) child.setAttribute(ATTR, value);
          marked.add(child);
          return;
        }
      }
      child = parent;
      parent = parent.parentElement;
    }
    log(`no flex row found for ${edge}`, el);
  }

  // ---- Chat: mirror the space Twitch keeps clear for it -------------------

  const SIDE_PAIRS = [
    ['left', 'right'],
    ['margin-left', 'margin-right'],
    ['padding-left', 'padding-right'],
  ];

  // If `el` keeps more space on its right than its left, swap the two sides.
  // Our overrides are removed first so we always read Twitch's own values;
  // that way the result stays right when Twitch changes them (theatre mode,
  // collapsing chat, and so on).
  // The values we set are recorded as JSON in the MIRRORED attribute on the
  // element itself, so any copy of this script can undo them.
  // Remove only the inline values this add-on set, never Twitch's own.
  function clearOurStyles(el) {
    const raw = el.getAttribute(MIRRORED);
    if (raw === null) return;
    let ours = {};
    try {
      ours = JSON.parse(raw) || {};
    } catch {}
    for (const [prop, value] of Object.entries(ours)) {
      if (el.style.getPropertyValue(prop) === value && el.style.getPropertyPriority(prop) === 'important') {
        el.style.removeProperty(prop);
      }
    }
    el.removeAttribute(MIRRORED);
  }

  function mirrorReservation(el) {
    clearOurStyles(el);
    const cs = getComputedStyle(el);
    const positioned = cs.position === 'absolute' || cs.position === 'fixed';
    const ours = {};
    for (const [l, r] of SIDE_PAIRS) {
      if (l === 'left' && !positioned) continue;
      const lv = parseFloat(cs.getPropertyValue(l)) || 0;
      const rv = parseFloat(cs.getPropertyValue(r)) || 0;
      if (rv > lv + 1) {
        ours[l] = `${rv}px`;
        ours[r] = `${lv}px`;
      }
    }
    setOurStyles(el, ours);
  }

  function setOurStyles(el, ours) {
    if (Object.keys(ours).length === 0) return;
    for (const [prop, value] of Object.entries(ours)) el.style.setProperty(prop, value, 'important');
    el.setAttribute(MIRRORED, JSON.stringify(ours));
  }

  // Some content (e.g. .channel-info-content below the stream) is made
  // narrower by the chat's width but stays pinned to the left edge of its
  // container. Push such children over to the right edge instead.
  function alignNarrowChildren(el) {
    if (isOutOfFlow(el)) return;
    const parentRect = el.getBoundingClientRect();
    for (const child of el.children) {
      clearOurStyles(child);
      if (isOutOfFlow(child)) continue;
      const r = child.getBoundingClientRect();
      if (r.width > 0 && r.width < parentRect.width - 50 && Math.abs(r.left - parentRect.left) < 2) {
        setOurStyles(child, { 'margin-left': 'auto' });
      }
    }
  }

  // Slide the chat box so its left edge lines up with the main content area's
  // left edge. Uses the `translate` property, which stacks on top of whatever
  // transform Twitch already applies.
  function moveChatLeft(chat) {
    const main = document.querySelector('main.twilight-main') || document.querySelector('main');
    const rect = chat.getBoundingClientRect();
    if (!main || rect.width === 0) return;
    const target = main.getBoundingClientRect().left;
    const current = parseFloat(chat.style.getPropertyValue('translate')) || 0;
    const delta = target - rect.left;
    if (Math.abs(delta) < 1) return;
    chat.style.setProperty('translate', `${current + delta}px 0`, 'important');
    chat.setAttribute(MOVED, '');
    log('moved chat by', delta);
  }

  // ---- Main loop ----------------------------------------------------------

  // ---- On/off toggle ------------------------------------------------------

  const BUTTON_ID = 'tcl-toggle';
  const MOVED = 'data-tcl-moved';
  let enabled = true;

  // When the add-on is reloaded, Firefox can inject a new copy of this script
  // into a page where the old copy is still running. Each copy stamps the page
  // with its own id; a copy that finds a newer id stops itself.
  const INSTANCE = Math.random().toString(36).slice(2);
  let observer = null;
  const isCurrent = () => document.documentElement.dataset.tclInstance === INSTANCE;

  // Put the page back exactly as Twitch laid it out.
  function resetAll() {
    for (const el of document.querySelectorAll(`[${ATTR}]`)) el.removeAttribute(ATTR);
    for (const el of document.querySelectorAll(`[${MIRRORED}]`)) clearOurStyles(el);
    for (const el of document.querySelectorAll(`[${MOVED}]`)) {
      el.style.removeProperty('translate');
      el.removeAttribute(MOVED);
    }
    // Twitch never sets an !important translate on the chat, so one there is ours
    // (possibly from an older copy that didn't tag it).
    for (const el of document.querySelectorAll(CHAT_SELECTORS.join(','))) {
      if (el.style.getPropertyPriority('translate') === 'important') el.style.removeProperty('translate');
    }
  }

  function setEnabled(value) {
    enabled = value;
    document.documentElement.classList.toggle('tcl-on', enabled);
    browser.storage.local.set({ enabled }).catch(() => {});
    apply();
  }

  function updateButton(btn) {
    const label = enabled ? 'Move chat to the right' : 'Move chat to the left';
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.classList.toggle('tcl-toggle--on', enabled);
  }

  // Add the toggle button to the chat header, next to Twitch's collapse
  // button. Re-added automatically whenever Twitch re-renders the header.
  function ensureButton() {
    const existing = document.getElementById(BUTTON_ID);
    if (existing && existing.dataset.instance === INSTANCE) {
      updateButton(existing);
      return;
    }
    if (existing) existing.remove(); // left behind by an older copy
    const collapse = document.querySelector('[data-a-target="right-column__toggle-collapse-btn"]');
    const header =
      document.querySelector('.stream-chat-header') ||
      (collapse && collapse.closest('[class*="chat-header"]'));
    if (!header) return;

    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.type = 'button';
    btn.dataset.instance = INSTANCE;
    btn.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">' +
      '<path fill="currentColor" d="M4.5 6.5 7 4l1.4 1.4L7.3 6.5H16v2H7.3l1.1 1.1L7 11zM15.5 13.5 13 16l-1.4-1.4 1.1-1.1H4v-2h8.7l-1.1-1.1L13 9z"/>' +
      '</svg>';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setEnabled(!enabled);
    });
    updateButton(btn);

    // Insert right after the header child that holds the collapse button.
    let anchor = collapse && header.contains(collapse) ? collapse : null;
    while (anchor && anchor.parentElement !== header) anchor = anchor.parentElement;
    if (anchor) anchor.after(btn);
    else header.prepend(btn);
  }

  // ---- Main loop ----------------------------------------------------------

  function apply() {
    if (!isCurrent()) {
      if (observer) observer.disconnect();
      return;
    }
    ensureButton();
    if (!enabled) {
      resetAll();
      return;
    }
    if (document.fullscreenElement) return;

    const marked = new Set();
    const sideNav = find(SIDE_NAV_SELECTORS);
    if (sideNav) placeAtEdge(sideNav, 'right', marked);
    for (const el of document.querySelectorAll(`[${ATTR}]`)) {
      if (!marked.has(el)) el.removeAttribute(ATTR);
    }

    const chat = find(CHAT_SELECTORS);
    if (chat) {
      for (const el of document.querySelectorAll(RESERVER_SELECTORS.join(','))) {
        if (chat.contains(el)) continue;
        mirrorReservation(el);
        alignNarrowChildren(el);
      }
      moveChatLeft(chat);
    } else {
      // Not on a channel page (or chat removed): undo any mirroring.
      for (const el of document.querySelectorAll(`[${MIRRORED}]`)) clearOurStyles(el);
    }
  }

  // Twitch is a single-page app, so re-apply whenever the page changes.
  // Throttled, because chat messages cause a constant stream of mutations.
  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(() => {
      pending = false;
      apply();
    }, 300);
  }

  function start() {
    document.documentElement.dataset.tclInstance = INSTANCE;
    resetAll(); // clear anything an older copy left behind
    document.documentElement.classList.toggle('tcl-on', enabled);
    observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    window.addEventListener('resize', schedule);
    document.addEventListener('fullscreenchange', schedule);
    apply();
  }

  // Load the saved choice first (defaults to chat on the left).
  browser.storage.local
    .get('enabled')
    .then(({ enabled: saved }) => {
      enabled = saved !== false;
    })
    .catch(() => {})
    .then(start);
})();
