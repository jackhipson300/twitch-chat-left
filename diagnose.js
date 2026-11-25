// Paste this into the browser console (F12 -> Console) on a Twitch channel page.
// It copies a description of the page layout to your clipboard. No personal
// data is included: only tag names, classes, data-a-target values and sizes.
(() => {
  const describe = (el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return [
      el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''),
      el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '',
      el.dataset.aTarget ? `[data-a-target=${el.dataset.aTarget}]` : '',
      el.dataset.tcl ? `[data-tcl=${el.dataset.tcl}]` : '',
      `display:${cs.display} dir:${cs.flexDirection} pos:${cs.position} order:${cs.order}`,
      `left:${cs.left} right:${cs.right} x:${Math.round(r.left)} w:${Math.round(r.width)}`,
      `margin:${cs.marginLeft}/${cs.marginRight} padding:${cs.paddingLeft}/${cs.paddingRight}`,
      `transform:${cs.transform} translate:${cs.translate}`,
      el.style.cssText ? `inline:{${el.style.cssText}}` : '',
    ].filter(Boolean).join(' ');
  };
  const chain = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return `${sel}: NOT FOUND`;
    const lines = [];
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const siblings = n.parentElement ? n.parentElement.children.length : 0;
      lines.push(`${'  '.repeat(lines.length)}${describe(n)} (siblings: ${siblings - 1})`);
    }
    return `${sel}:\n${lines.join('\n')}`;
  };
  // Walks down the tree, skipping the player and chat (they're already covered)
  // and anything that is invisible.
  const tree = (el, depth) => {
    if (!el) return 'NOT FOUND';
    if (depth > 7) return '';
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return '';
    let s = `${'  '.repeat(depth)}${describe(el)} y:${Math.round(r.top)} h:${Math.round(r.height)}\n`;
    if (el.matches('.channel-root__player, .persistent-player, .channel-root__right-column, video')) return s;
    for (const c of el.children) s += tree(c, depth + 1);
    return s;
  };
  const out = [
    `url path: ${location.pathname}  viewport: ${innerWidth}x${innerHeight}`,
    ...['#side-nav', '[data-a-target="side-nav-bar"]', '.side-nav',
        '.channel-root__right-column', '.right-column',
        '[data-a-target="right-column-chat-bar"]', '.chat-shell',
        '.channel-root__player', '.persistent-player', 'main'].map(chain),
    'elements with --with-chat:\n' +
      [...document.querySelectorAll('[class*="--with-chat"]')].map(describe).join('\n'),
    'tree under .channel-root (content below the stream):\n' + tree(document.querySelector('.channel-root'), 0),
  ].join('\n\n');
  copy(out);
  console.log(out);
  console.log('Copied to clipboard.');
})();
