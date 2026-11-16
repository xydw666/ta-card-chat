/* 拼音打字动画：把一张字卡的文字，用「拼音 → 候选字 → 上屏」的过程逐字打出来。
   字库里没有的字会退化成普通逐字出现，不会卡住。
   悬浮窗可拖动、可最小化，位置记在 localStorage。 */
(function (global) {
  'use strict';

  var CJK = /^[\u3400-\u9fff]$/;
  var POS_KEY = 'ta_typer_pos_v1';
  var MIN_KEY = 'ta_typer_min_v1';

  var dictLoading = null;
  var token = 0;
  var hiddenForRun = false;

  var bar, head, lettersEl, candsEl, hintEl;

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, Math.max(0, ms)); });
  }

  function refs() {
    bar = bar || document.getElementById('typer');
    head = head || document.getElementById('typerHead');
    lettersEl = lettersEl || document.getElementById('typerLetters');
    candsEl = candsEl || document.getElementById('typerCands');
    hintEl = hintEl || document.getElementById('typerHint');
  }

  function hasDict() {
    return !!(global.SHEX_PINYIN_DICT && global.SHEX_CHAR_PINYIN);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = function () { resolve(true); };
      script.onerror = function () { reject(new Error(src)); };
      document.head.appendChild(script);
    });
  }

  function ensureDicts() {
    if (hasDict()) return Promise.resolve(true);
    if (dictLoading) return dictLoading;
    dictLoading = Promise.all([
      loadScript('./js/dict/pinyin-dictionary.js'),
      loadScript('./js/dict/pinyin-char-map.js')
    ]).then(hasDict).catch(function () { return false; });
    return dictLoading;
  }

  /* ---------- 拖动 ---------- */

  function applyPos(x, y) {
    refs();
    var width = bar.offsetWidth || 220;
    var height = bar.offsetHeight || 120;
    var maxX = Math.max(0, window.innerWidth - width);
    var maxY = Math.max(0, window.innerHeight - height);
    var left = Math.min(Math.max(0, x), maxX);
    var top = Math.min(Math.max(0, y), maxY);
    bar.style.left = left + 'px';
    bar.style.top = top + 'px';
    bar.style.right = 'auto';
    bar.style.bottom = 'auto';
  }

  function restorePos() {
    refs();
    var stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
    } catch (_) {}
    if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) {
      applyPos(stored.x, stored.y);
    }
  }

  function initDrag() {
    refs();
    if (!head || head.dataset.dragReady === '1') return;
    head.dataset.dragReady = '1';

    var dragging = false;
    var startX = 0;
    var startY = 0;
    var originX = 0;
    var originY = 0;

    head.addEventListener('pointerdown', function (event) {
      if (event.target.closest('button')) return;
      var rect = bar.getBoundingClientRect();
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      originX = rect.left;
      originY = rect.top;
      bar.style.transition = 'none';
      try { head.setPointerCapture(event.pointerId); } catch (_) {}
    });

    head.addEventListener('pointermove', function (event) {
      if (!dragging) return;
      event.preventDefault();
      applyPos(originX + event.clientX - startX, originY + event.clientY - startY);
    });

    function end(event) {
      if (!dragging) return;
      dragging = false;
      bar.style.transition = '';
      try {
        localStorage.setItem(POS_KEY, JSON.stringify({
          x: parseFloat(bar.style.left) || 0,
          y: parseFloat(bar.style.top) || 0
        }));
      } catch (_) {}
      try { head.releasePointerCapture(event.pointerId); } catch (_) {}
    }

    head.addEventListener('pointerup', end);
    head.addEventListener('pointercancel', end);
  }

  /* ---------- 最小化 / 关闭 ---------- */

  function setMinimized(type) {
    refs();
    var minimized = type !== false;
    bar.classList.toggle('is-min', minimized);
    try { localStorage.setItem(MIN_KEY, minimized ? '1' : '0'); } catch (_) {}
    // 尺寸变了重新校验位置，防止跑到屏幕外
    applyPos(parseFloat(bar.style.left) || 0, parseFloat(bar.style.top) || 0);
  }

  function initButtons() {
    refs();
    var minBtn = document.getElementById('typerMin');
    var closeBtn = document.getElementById('typerClose');
    if (minBtn) {
      minBtn.addEventListener('click', function () {
        setMinimized(!bar.classList.contains('is-min'));
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        hiddenForRun = true;
        bar.hidden = true;
      });
    }
    try {
      if (localStorage.getItem(MIN_KEY) === '1') bar.classList.add('is-min');
    } catch (_) {}
  }

  function show() {
    refs();
    if (hiddenForRun) return;
    bar.hidden = false;
    bar.classList.add('is-visible');
    if (!bar.style.left) restorePos();
  }

  function hide() {
    refs();
    if (!bar) return;
    bar.classList.remove('is-visible');
  }

  function clearStrip() {
    refs();
    if (lettersEl) lettersEl.textContent = '';
    if (candsEl) candsEl.innerHTML = '';
    if (hintEl) hintEl.textContent = 'TA 正在敲键盘…';
  }

  /* ---------- 主流程 ---------- */

  async function run(target, text, options) {
    var settings = options || {};
    var letterMs = Number(settings.letterSpeed) || 70;
    var candMs = Number(settings.candidateSpeed) || 300;
    var current = ++token;
    hiddenForRun = false;

    target.textContent = '';
    target.classList.add('is-typing');

    var ready = await ensureDicts();
    if (current !== token) {
      target.textContent = text;
      target.classList.remove('is-typing');
      return;
    }

    if (!ready) {
      // 词库不可用：退化成普通逐字打字
      for (var i = 0; i < text.length; i += 1) {
        if (current !== token) { target.textContent = text; break; }
        target.textContent = text.slice(0, i + 1);
        await sleep(28);
      }
      target.textContent = text;
      target.classList.remove('is-typing');
      return;
    }

    refs();
    clearStrip();
    if (!bar) { target.textContent = text; return; }
    show();

    var dict = global.SHEX_PINYIN_DICT || {};
    var charMap = global.SHEX_CHAR_PINYIN || {};
    var chars = Array.from(text);
    var output = '';

    try {
      for (var index = 0; index < chars.length; index += 1) {
        if (current !== token) { target.textContent = text; break; }
        var ch = chars[index];

        if (CJK.test(ch) && charMap[ch] && dict[charMap[ch]]) {
          var pinyin = charMap[ch];
          if (!hiddenForRun && hintEl) hintEl.textContent = 'TA 正在敲拼音…';
          if (!hiddenForRun && candsEl) candsEl.innerHTML = '';

          var typed = '';
          for (var p = 0; p < pinyin.length; p += 1) {
            typed += pinyin[p];
            if (!hiddenForRun && lettersEl) lettersEl.textContent = typed;
            await sleep(letterMs * (0.75 + Math.random() * 0.5));
            if (current !== token) break;
          }
          if (current !== token) { target.textContent = text; break; }

          var list = (dict[pinyin] || []).slice(0, 6);
          if (list.indexOf(ch) === -1) {
            if (list.length >= 7) list.pop();
            list.push(ch);
          }
          if (!hiddenForRun && candsEl) {
            candsEl.innerHTML = list.map(function (item) {
              return '<span class="cand' + (item === ch ? ' is-target' : '') + '">' + item + '</span>';
            }).join('');
            if (hintEl) hintEl.textContent = '正在候选字里选字…';
          }
          await sleep(candMs * (0.8 + Math.random() * 0.5));
          if (current !== token) { target.textContent = text; break; }

          if (!hiddenForRun && candsEl) {
            var picked = candsEl.querySelector('.cand.is-target');
            if (picked) picked.classList.add('is-picked');
          }
          await sleep(120);
          if (!hiddenForRun && lettersEl) lettersEl.textContent = '';
          if (!hiddenForRun && candsEl) candsEl.innerHTML = '';
        } else if (ch === '\n') {
          await sleep(160);
        } else {
          await sleep(Math.min(letterMs, 60));
        }

        if (current !== token) { target.textContent = text; break; }

        output += ch;
        target.textContent = output;
        await sleep(70 * (0.8 + Math.random() * 0.5));
      }
    } finally {
      if (current === token) {
        target.textContent = text;
        target.classList.remove('is-typing');
        clearStrip();
        hide();
      }
    }
  }

  function cancel() {
    token += 1;
    clearStrip();
    hide();
  }

  refs();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      refs();
      initDrag();
      initButtons();
    }, { once: true });
  } else {
    initDrag();
    initButtons();
  }

  global.TATyping = {
    run: run,
    cancel: cancel,
    ensureDicts: ensureDicts,
    hasDict: hasDict,
    showPanel: function () { hiddenForRun = false; show(); },
    hidePanel: hide,
    clearStrip: clearStrip
  };
})(window);
