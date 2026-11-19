/* HUST Assistant embed loader. No dependencies or access to host-page content. */
(function () {
  'use strict';
  var script = document.currentScript;
  if (!script || document.getElementById('hust-assistant-widget')) return;
  var widgetOrigin = new URL(script.src, window.location.href).origin;
  var left = script.getAttribute('data-position') === 'bottom-left';
  var open = script.getAttribute('data-open') === 'true';
  var expanded = false;
  var historyOpen = false;
  var frame = document.createElement('iframe');
  frame.id = 'hust-assistant-widget';
  frame.title = 'HUST Assistant';
  frame.setAttribute('referrerpolicy', 'origin');
  frame.setAttribute(
    'sandbox',
    'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox',
  );
  var url = new URL('/embed', widgetOrigin);
  url.searchParams.set('parentOrigin', window.location.origin);
  url.searchParams.set('open', String(open));
  frame.src = url.href;
  // Important styles protect positioning from broad iframe rules on the host.
  function style(name, value) {
    frame.style.setProperty(name, value, 'important');
  }
  style('position', 'fixed');
  style('border', '0');
  style('display', 'block');
  style('background', 'transparent');
  style('color-scheme', 'light');
  style('z-index', '2147483000');
  style('margin', '0');
  style('padding', '0');
  style('min-width', '0');
  style('min-height', '0');
  style('max-width', 'none');
  style('max-height', 'none');
  style('box-shadow', 'none');
  style('border-radius', '0');
  style('top', 'auto');
  function resize() {
    var viewport = window.visualViewport;
    var width = viewport ? viewport.width : window.innerWidth;
    var height = viewport ? viewport.height : window.innerHeight;
    var gap = (open && expanded) || width <= 480 ? 0 : 12;
    style(
      'width',
      Math.max(
        0,
        Math.min(open ? (expanded ? width : historyOpen ? 642 : 392) : 114, width - gap * 2),
      ) + 'px',
    );
    style(
      'height',
      Math.max(0, Math.min(open ? (expanded ? height : 614) : 114, height - gap * 2)) + 'px',
    );
    style(
      'bottom',
      gap +
        (viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0) +
        'px',
    );
    style(left ? 'left' : 'right', gap + 'px');
    style(left ? 'right' : 'left', 'auto');
  }
  window.addEventListener('message', function (event) {
    if (event.origin !== widgetOrigin || event.source !== frame.contentWindow) return;
    var data = event.data;
    if (
      !data ||
      data.type !== 'hust:state' ||
      typeof data.open !== 'boolean' ||
      typeof data.expanded !== 'boolean'
    )
      return;
    open = data.open;
    expanded = data.expanded;
    historyOpen = data.historyOpen === true;
    resize();
  });
  frame.addEventListener('load', function () {
    frame.contentWindow.postMessage({ type: 'hust:request-state' }, widgetOrigin);
  });
  window.addEventListener('resize', resize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
  resize();
  function mount() {
    if (!document.getElementById(frame.id)) document.body.appendChild(frame);
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });
})();
