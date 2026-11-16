/* 表情面板：系统默认表情 + 自定义表情（从本地相册上传，压缩后存在本地）。
   自定义表情既能插入聊天，也能被做成字卡，让 TA 也发出来。 */
(function (global) {
  'use strict';

  var EMOJIS = [
    '😀', '😄', '😁', '😆', '😊', '😇', '🙂', '🙃',
    '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
    '😋', '😜', '🤪', '😝', '🤗', '🤭', '🤫', '🤔',
    '😐', '😑', '😶', '😏', '😒', '🙄', '😴', '😔',
    '😪', '🤤', '😵', '🥺', '😢', '😭', '😤', '😠',
    '😊', '🥲', '😷', '🤒', '🤕', '🤢', '🥴', '😵‍💫',
    '❤️', '💔', '💕', '💞', '💘', '💝', '✨', '🌟',
    '🌙', '☁️', '🌸', '🍬', '🎀', '🐻', '🐱', '🫧'
  ];

  var panelEl = null;
  var emojiGrid = null;
  var customGrid = null;
  var tab = 'emoji';
  var pickerCallback = null;
  var fileInput = null;

  function el(id) { return document.getElementById(id); }

  function renderEmoji() {
    if (!emojiGrid) return;
    emojiGrid.innerHTML = EMOJIS.map(function (emoji) {
      return '<button type="button" class="sp-emoji" data-emoji="' + emoji + '">' + emoji + '</button>';
    }).join('');
  }

  function renderCustom() {
    if (!customGrid) return;
    var stickers = global.TAStore.state.stickers;
    var tiles = stickers.map(function (sticker) {
      return '<button type="button" class="sp-sticker" data-sticker="' + sticker.id + '">' +
        '<img src="' + sticker.dataUrl + '" alt="表情">' +
        '</button>';
    });

    tiles.push('<button type="button" class="sp-add" id="spAddTile" aria-label="从相册添加">＋<span>相册</span></button>');
    if (!stickers.length) {
      tiles.unshift('<p class="sp-empty">还没有自定义表情，点「＋」从相册选一张。</p>');
    }
    customGrid.innerHTML = tiles.join('');
  }

  function switchTab(name) {
    tab = name === 'custom' ? 'custom' : 'emoji';
    var tabs = panelEl.querySelectorAll('.sp-tabs button');
    tabs.forEach(function (button) {
      button.classList.toggle('is-active', button.dataset.tab === tab);
    });
    if (emojiGrid) emojiGrid.hidden = tab !== 'emoji';
    if (customGrid) customGrid.hidden = tab !== 'custom';
  }

  function open(forceTab) {
    if (!panelEl) return;
    panelEl.hidden = false;
    requestAnimationFrame(function () { panelEl.classList.add('is-open'); });
    switchTab(forceTab || tab);
    renderCustom();
    setTimeout(function () {
      var chat = el('chatLog');
      if (chat) chat.scrollTop = chat.scrollHeight;
    }, 60);
  }

  function close() {
    if (!panelEl) return;
    panelEl.classList.remove('is-open');
    setTimeout(function () {
      if (!panelEl.classList.contains('is-open')) panelEl.hidden = true;
    }, 180);
  }

  function toggle() {
    if (!panelEl) return;
    if (panelEl.hidden) open();
    else close();
  }

  function isOpen() {
    return !!panelEl && !panelEl.hidden;
  }

  /* ---------- 图片压缩 ---------- */

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () { resolve(image); };
      image.onerror = reject;
      image.src = src;
    });
  }

  function compress(file, maxSize) {
    return readFile(file).then(function (src) {
      return loadImage(src).then(function (image) {
        var max = Number(maxSize) || 240;
        var width = image.naturalWidth || image.width;
        var height = image.naturalHeight || image.height;
        var scale = Math.min(1, max / Math.max(width, height));
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        var ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        var type = 'image/webp';
        var dataUrl = canvas.toDataURL(type, 0.9);
        if (!/^data:image\/webp/.test(dataUrl)) dataUrl = canvas.toDataURL('image/jpeg', 0.86);
        return dataUrl;
      });
    });
  }

  function addFiles(files) {
    var list = Array.prototype.slice.call(files || []).filter(function (file) {
      return file && /^image\//.test(file.type);
    });
    if (!list.length) {
      if (global.TAToast) global.TAToast('请选择图片文件');
      return Promise.resolve(0);
    }
    var added = 0;
    var failed = 0;

    return list.reduce(function (chain, file) {
      return chain.then(function () {
        return compress(file).then(function (dataUrl) {
          var result = global.TAStore.addSticker(dataUrl);
          if (!result || result.error) {
            failed += 1;
            if (global.TAToast) {
              global.TAToast('空间不足，换张小一点的图片');
            }
            return;
          }
          added += 1;
        }).catch(function () { failed += 1; });
      });
    }, Promise.resolve()).then(function () {
      renderCustom();
      if (added && global.TAToast) {
        global.TAToast('已添加 ' + added + ' 个表情' + (failed ? '，' + failed + ' 个失败' : ''));
      }
      return added;
    });
  }

  function pickFromAlbum() {
    if (!fileInput) return;
    fileInput.value = '';
    fileInput.click();
  }

  /* ---------- 选择表情当字卡 ---------- */

  function openPicker(callback) {
    pickerCallback = typeof callback === 'function' ? callback : null;
    open('custom');
  }

  function closePicker() {
    pickerCallback = null;
    close();
  }

  function init() {
    panelEl = el('stickerPanel');
    emojiGrid = el('spEmoji');
    customGrid = el('spCustom');
    fileInput = el('stickerFile');
    if (!panelEl) return;

    renderEmoji();
    renderCustom();

    panelEl.addEventListener('click', function (event) {
      var tabBtn = event.target.closest('.sp-tabs button');
      if (tabBtn) { switchTab(tabBtn.dataset.tab); return; }

      var emojiBtn = event.target.closest('.sp-emoji');
      if (emojiBtn) {
        if (global.TAComposer && global.TAComposer.insertText) {
          global.TAComposer.insertText(emojiBtn.dataset.emoji);
        }
        return;
      }

      var stickerBtn = event.target.closest('.sp-sticker');
      if (stickerBtn) {
        var id = stickerBtn.dataset.sticker;
        if (pickerCallback) {
          var callback = pickerCallback;
          pickerCallback = null;
          close();
          callback(id);
          return;
        }
        if (global.TAChat) global.TAChat.sendSticker(id);
        return;
      }

      if (event.target.closest('#spAddTile')) pickFromAlbum();
    });

    if (fileInput) {
      fileInput.addEventListener('change', function () {
        addFiles(fileInput.files);
      });
    }
  }

  global.TAStickers = {
    init: init,
    open: open,
    close: close,
    toggle: toggle,
    isOpen: isOpen,
    addFiles: addFiles,
    pickFromAlbum: pickFromAlbum,
    openPicker: openPicker,
    closePicker: closePicker,
    renderCustom: renderCustom,
    compressFile: compress,
    emojis: EMOJIS
  };
})(window);
