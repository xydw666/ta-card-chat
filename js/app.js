/* 启动与全局绑定：顶栏菜单、输入栏、表情面板、发送。 */
(function (global) {
  'use strict';

  var inputEl = null;
  var sendBtn = null;
  var composerEl = null;
  var menuEl = null;
  var pinyinBtn = null;
  var toastTimer = 0;
  var keepPanel = false;

  function toast(text) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    requestAnimationFrame(function () { el.classList.add('is-open'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('is-open');
      setTimeout(function () { el.hidden = true; }, 200);
    }, 1600);
  }

  function paintHeader() {
    var nameEl = document.getElementById('taName');
    if (nameEl) nameEl.textContent = global.TAStore.state.taName;
    document.title = global.TAStore.state.taName + ' · 私人聊天';
  }

  function syncComposerState() {
    if (!composerEl || !inputEl) return;
    composerEl.classList.toggle('has-text', !!inputEl.value.trim());
    if (sendBtn) sendBtn.disabled = !inputEl.value.trim();
  }

  function autoGrow() {
    if (!inputEl) return;
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 108) + 'px';
    syncComposerState();
  }

  function submit() {
    if (!inputEl) return;
    var text = inputEl.value;
    if (!text.trim()) return;
    var ok = global.TAChat.send(text);
    if (!ok) return;
    inputEl.value = '';
    autoGrow();
    inputEl.focus();
  }

  function insertText(text) {
    if (!inputEl || !text) return;
    var start = inputEl.selectionStart || inputEl.value.length;
    var end = inputEl.selectionEnd || start;
    inputEl.value = inputEl.value.slice(0, start) + text + inputEl.value.slice(end);
    autoGrow();
    keepPanel = true;
    try {
      inputEl.focus();
      var pos = start + text.length;
      inputEl.setSelectionRange(pos, pos);
    } catch (_) {}
    keepPanel = false;
  }

  /* ---------- 「···」菜单 ---------- */

  function closeMenu() {
    if (menuEl) menuEl.hidden = true;
  }

  function toggleMenu() {
    if (!menuEl) return;
    menuEl.hidden = !menuEl.hidden;
  }

  function init() {
    inputEl = document.getElementById('input');
    sendBtn = document.getElementById('sendBtn');
    composerEl = document.getElementById('composer');
    menuEl = document.getElementById('wxMenu');

    global.TAPanel.init();
    global.TAStickers.init();
    global.TAChat.init();
    if (global.TAPinyin) global.TAPinyin.init();
    global.TAShell.init();
    if (global.TAMail) global.TAMail.init();
    if (global.TAProfile) global.TAProfile.init();
    paintHeader();

    global.TAStore.on('taName', paintHeader);
    global.TAStore.on('profile', paintHeader);
    global.TAStore.on('cards', paintHeader);
    global.TAStore.on('reset', paintHeader);

    var activeBtn = document.getElementById('btnActive');
    if (activeBtn) {
      activeBtn.addEventListener('click', function () {
        if (global.TAChat) global.TAChat.active();
      });
    }

    if (composerEl) {
      composerEl.addEventListener('submit', function (event) {
        event.preventDefault();
        submit();
      });
    }

    if (inputEl) {
      inputEl.addEventListener('input', autoGrow);
      inputEl.addEventListener('focus', function () {
        if (keepPanel) return;
        if (global.TAStickers) global.TAStickers.close();
      });
      inputEl.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
          event.preventDefault();
          submit();
        }
      });
      autoGrow();
    }

    var btnMore = document.getElementById('btnMore');
    if (btnMore) btnMore.addEventListener('click', function (event) {
      event.stopPropagation();
      toggleMenu();
    });

    if (menuEl) {
      menuEl.addEventListener('click', function (event) {
        var btn = event.target.closest('button[data-act]');
        if (!btn) return;
        closeMenu();
        if (btn.dataset.act === 'cards') global.TAPanel.openCards();
        if (btn.dataset.act === 'stickers') global.TAPanel.openStickers();
        if (btn.dataset.act === 'settings') global.TAPanel.openSettings();
      });
    }

    document.addEventListener('click', function (event) {
      if (!menuEl || menuEl.hidden) return;
      if (event.target.closest('#wxMenu') || event.target.closest('#btnMore')) return;
      closeMenu();
    });

    var btnPlus = document.getElementById('btnPlus');
    if (btnPlus) btnPlus.addEventListener('click', function (event) {
      event.stopPropagation();
      global.TAPanel.openPlusMenu();
    });

    /* 表情按钮：打开表情面板 */
    var btnEmoji = document.getElementById('btnEmoji');
    if (btnEmoji) {
      btnEmoji.addEventListener('click', function (event) {
        event.stopPropagation();
        if (inputEl) inputEl.blur();
        global.TAStickers.toggle();
      });
    }

    /* 左侧键盘按钮 = 拼音打字开关 */
    pinyinBtn = document.getElementById('btnPinyin');
    if (pinyinBtn) {
      pinyinBtn.classList.toggle('is-on', global.TAStore.state.settings.typing);
      pinyinBtn.addEventListener('click', function () {
        var next = !global.TAStore.state.settings.typing;
        global.TAStore.updateSettings({ typing: next });
        pinyinBtn.classList.toggle('is-on', next);
        toast(next ? '已开启：TA 会用拼音打字' : '已关闭拼音打字');
        if (next && global.TATyping) {
          global.TATyping.ensureDicts().then(function (ok) {
            if (!ok) toast('词库加载失败，将退化为逐字显示');
          });
        }
      });
    }

    /* 聊天区空白处点击：收起表情面板 */
    var chatLog = document.getElementById('chatLog');
    if (chatLog) {
      chatLog.addEventListener('click', function () {
        if (global.TAStickers && global.TAStickers.isOpen()) global.TAStickers.close();
      });
    }

    global.TAToast = toast;
    global.TAComposer = { insertText: insertText };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(window);
