/* 微信式外壳：微信 / 通讯录 / 发现 / 我，以及聊天页和朋友圈。 */
(function (global) {
  'use strict';

  var currentTab = 'list';

  function el(id) { return document.getElementById(id); }

  function pad(value) { return String(value).padStart(2, '0'); }

  function listTime(at) {
    if (!at) return '';
    var date = new Date(at);
    var now = new Date();
    var sameDay = date.getFullYear() === now.getFullYear()
      && date.getMonth() === now.getMonth()
      && date.getDate() === now.getDate();
    if (sameDay) return pad(date.getHours()) + ':' + pad(date.getMinutes());

    var yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (date.getFullYear() === yesterday.getFullYear()
      && date.getMonth() === yesterday.getMonth()
      && date.getDate() === yesterday.getDate()) return '昨天';

    var diff = (now.getTime() - date.getTime()) / 86400000;
    if (diff < 7) return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
    return (date.getMonth() + 1) + '月' + date.getDate() + '日';
  }

  function preview() {
    var state = global.TAStore.state;
    if (!state.messages.length) return '还没有消息，点进去说句话吧';
    var last = state.messages[state.messages.length - 1];
    if (last.stickerId) return '[表情]';
    return last.text;
  }

  function lastTime() {
    var messages = global.TAStore.state.messages;
    return messages.length ? messages[messages.length - 1].at : 0;
  }

  /* ---------- 会话列表 ---------- */

  function refreshList() {
    var list = el('convList');
    if (!list) return;
    var state = global.TAStore.state;
    var name = state.taName;
    var count = state.cards.length;

    list.innerHTML = [
      '<button type="button" class="conv-row" id="convTa">',
      '  <div class="conv-avatar" id="convAvatar"></div>',
      '  <div class="conv-main">',
      '    <div class="conv-top">',
      '      <span class="conv-name">' + escapeHtml(name) + '</span>',
      '      <span class="conv-time">' + listTime(lastTime()) + '</span>',
      '    </div>',
      '    <p class="conv-preview">' + escapeHtml(preview()) + '</p>',
      '  </div>',
      '</button>'
    ].join('');

    if (global.TAProfile) global.TAProfile.fill(el('convAvatar'), 'ta');

    var row = el('convTa');
    if (row) {
      row.addEventListener('click', openChat);
      row.addEventListener('contextmenu', function (event) {
        event.preventDefault();
        if (global.TAPanel) global.TAPanel.openCards();
      });
    }

    var subtitle = el('listSub');
    if (subtitle) subtitle.textContent = count + ' 张字卡';

    var contactsName = el('contactsTaName');
    if (contactsName) contactsName.textContent = name;
    var contactsAvatar = el('contactsTaAvatar');
    if (contactsAvatar) {
      if (global.TAProfile) global.TAProfile.fill(contactsAvatar, 'ta');
      else contactsAvatar.textContent = name.slice(0, 1) || 'T';
    }
    var meName = el('meName');
    if (meName) meName.textContent = state.myName || '我';
    var meAvatar = el('meAvatar');
    if (meAvatar && global.TAProfile) global.TAProfile.fill(meAvatar, 'me');

    var coverName = el('coverName');
    if (coverName) coverName.textContent = state.myName || '我';
    var coverAvatar = el('coverAvatar');
    if (coverAvatar && global.TAProfile) global.TAProfile.fill(coverAvatar, 'me');

    var cardsCount = el('meCardsCount');
    if (cardsCount) cardsCount.textContent = count + ' 张';
    var stickerCount = el('meStickerCount');
    if (stickerCount) stickerCount.textContent = state.stickers.length + ' 个';
    var mailCount = el('mailCount');
    if (mailCount) mailCount.textContent = state.mail.length ? state.mail.length + ' 封' : '';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  /* ---------- 页面切换 ---------- */

  var PAGES = ['pageList', 'pageChat', 'pageContacts', 'pageDiscover', 'pageMoments', 'pageMail', 'pageMe'];

  function hideAll() {
    PAGES.forEach(function (id) {
      var page = el(id);
      if (page) page.hidden = true;
    });
  }

  function showTab(tab) {
    currentTab = tab;
    hideAll();
    var map = { list: 'pageList', contacts: 'pageContacts', discover: 'pageDiscover', me: 'pageMe' };
    var page = el(map[tab] || 'pageList');
    if (page) page.hidden = false;

    var tabbar = el('tabbar');
    if (tabbar) tabbar.hidden = false;

    document.querySelectorAll('.wx-tab').forEach(function (button) {
      button.classList.toggle('is-active', button.dataset.tab === tab);
    });
  }

  function openChat() {
    hideAll();
    var page = el('pageChat');
    if (page) page.hidden = false;
    var tabbar = el('tabbar');
    if (tabbar) tabbar.hidden = true;
    if (global.TAChat) global.TAChat.renderAll();
    requestAnimationFrame(function () {
      if (page) page.classList.add('is-open');
    });
  }

  function closeChat() {
    var page = el('pageChat');
    if (page) page.classList.remove('is-open');
    setTimeout(function () {
      showTab('list');
      refreshList();
    }, 180);
  }

  function openMoments() {
    hideAll();
    var page = el('pageMoments');
    if (page) page.hidden = false;
    var tabbar = el('tabbar');
    if (tabbar) tabbar.hidden = true;
    renderMoments();
  }

  function closeMoments() {
    showTab('discover');
  }

  function openMail() {
    hideAll();
    var page = el('pageMail');
    if (page) page.hidden = false;
    var tabbar = el('tabbar');
    if (tabbar) tabbar.hidden = true;
    if (global.TAMail) global.TAMail.open();
  }

  function closeMail() {
    showTab('discover');
  }

  /* ---------- 朋友圈 ---------- */

  function momentsTime(at) {
    var date = new Date(at);
    var diff = Date.now() - at;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    return (date.getMonth() + 1) + '月' + date.getDate() + '日 ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }

  function imageGrid(images) {
    if (!images || !images.length) return '';
    var cls = images.length === 1 ? ' one' : (images.length === 2 ? ' two' : '');
    return '<div class="moment-images' + cls + '">' + images.map(function (url) {
      return '<img src="' + url + '" alt="图片">';
    }).join('') + '</div>';
  }

  function renderMoments() {
    var feed = el('momentsFeed');
    if (!feed) return;
    var posts = global.TAStore.state.posts;

    if (!posts.length) {
      feed.innerHTML = '<div class="moments-empty">还没有动态，点右上角「＋」发一条。</div>';
      return;
    }

    feed.innerHTML = posts.map(function (post) {
      return [
        '<article class="moment" data-id="' + post.id + '">',
        '  <div class="moment-avatar" data-avatar="me"></div>',
        '  <div class="moment-main">',
        '    <p class="moment-name">' + escapeHtml(global.TAStore.state.myName || '我') + '</p>',
        post.text ? '    <p class="moment-text">' + escapeHtml(post.text) + '</p>' : '',
        imageGrid(post.images),
        '    <div class="moment-foot">',
        '      <span class="moment-time">' + momentsTime(post.at) + '</span>',
        '      <button type="button" class="moment-more" data-act="toggle" aria-label="操作">···</button>',
        '    </div>',
        '    <div class="moment-actions">',
        '      <button type="button" data-act="like">' + (post.liked ? '♥ 取消赞' : '♡ 赞') + '</button>',
        '      <button type="button" data-act="del">删除</button>',
        '    </div>',
        post.liked ? '    <div class="moment-likes">♥ 我</div>' : '',
        '  </div>',
        '</article>'
      ].join('');
    }).join('');

    feed.querySelectorAll('.moment').forEach(function (node) {
      var id = node.dataset.id;
      var avatar = node.querySelector('.moment-avatar');
      if (avatar && global.TAProfile) global.TAProfile.fill(avatar, 'me');
      node.addEventListener('click', function (event) {
        var button = event.target.closest('[data-act]');
        if (!button) return;
        var act = button.dataset.act;
        if (act === 'toggle') {
          node.classList.toggle('is-open');
          return;
        }
        if (act === 'like') {
          global.TAStore.toggleLike(id);
          renderMoments();
          return;
        }
        if (act === 'del') {
          if (!window.confirm('删除这条动态？')) return;
          global.TAStore.removePost(id);
          renderMoments();
        }
      });
    });
  }

  /* ---------- 朋友圈：发图 ---------- */

  var draft = { images: [] };

  function renderDraftImages() {
    var row = el('momentImages');
    if (!row) return;
    if (!draft.images.length) {
      row.hidden = true;
      row.innerHTML = '';
      return;
    }
    row.hidden = false;
    row.innerHTML = draft.images.map(function (url, index) {
      return '<div class="me-image"><img src="' + url + '" alt="图片">' +
        '<button type="button" data-index="' + index + '" aria-label="移除">×</button></div>';
    }).join('');
    row.querySelectorAll('button').forEach(function (button) {
      button.addEventListener('click', function () {
        draft.images.splice(Number(button.dataset.index), 1);
        renderDraftImages();
      });
    });
  }

  function readPhoto(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function loadPhoto(src) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () { resolve(image); };
      image.onerror = reject;
      image.src = src;
    });
  }

  function compressPhoto(file) {
    return readPhoto(file).then(function (src) {
      return loadPhoto(src).then(function (image) {
        var max = 720;
        var width = image.naturalWidth || image.width;
        var height = image.naturalHeight || image.height;
        var scale = Math.min(1, max / Math.max(width, height));
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        var dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        return dataUrl;
      });
    });
  }

  function openEditor() {
    var editor = el('momentEditor');
    if (editor) editor.hidden = false;
    renderDraftImages();
    var input = el('momentInput');
    if (input) input.focus();
  }

  function publishPost() {
    var input = el('momentInput');
    var text = input ? input.value.trim() : '';
    var images = draft.images.slice();
    if (!text && !images.length) {
      if (global.TAToast) global.TAToast('写点什么或选张图片');
      return;
    }
    var result = global.TAStore.addPost({ text: text, images: images });
    if (!result || result.error) {
      if (global.TAToast) global.TAToast('空间不足，这条没存下');
      return;
    }
    if (input) input.value = '';
    draft.images = [];
    renderDraftImages();
    var editor = el('momentEditor');
    if (editor) editor.hidden = true;
    var emojiBar = el('momentEmojiBar');
    if (emojiBar) emojiBar.hidden = true;
    renderMoments();
    if (global.TAToast) global.TAToast('已发表');
  }

  /* ---------- 初始化 ---------- */

  function init() {
    var tabbar = el('tabbar');
    if (tabbar) {
      tabbar.addEventListener('click', function (event) {
        var button = event.target.closest('.wx-tab');
        if (!button) return;
        showTab(button.dataset.tab);
      });
    }

    var back = el('btnBack');
    if (back) back.addEventListener('click', closeChat);

    var contactsRow = el('contactsTa');
    if (contactsRow) contactsRow.addEventListener('click', openChat);

    var momentsEntry = el('discoverMoments');
    if (momentsEntry) momentsEntry.addEventListener('click', openMoments);

    var momentsBack = el('momentsBack');
    if (momentsBack) momentsBack.addEventListener('click', closeMoments);

    var mailEntry = el('discoverMail');
    if (mailEntry) mailEntry.addEventListener('click', openMail);

    var mailBack = el('mailBack');
    if (mailBack) mailBack.addEventListener('click', closeMail);

    var publish = el('momentPublish');
    if (publish) publish.addEventListener('click', publishPost);

    var write = el('momentsWrite');
    if (write) write.addEventListener('click', openEditor);

    var emojiBar = el('momentEmojiBar');
    var emojiBtn = el('momentEmojiBtn');
    if (emojiBar && emojiBtn && global.TAStickers) {
      emojiBar.innerHTML = global.TAStickers.emojis.map(function (emoji) {
        return '<button type="button" class="me-emoji" data-emoji="' + emoji + '">' + emoji + '</button>';
      }).join('');
      emojiBtn.addEventListener('click', function () {
        emojiBar.hidden = !emojiBar.hidden;
      });
      emojiBar.addEventListener('click', function (event) {
        var button = event.target.closest('.me-emoji');
        if (!button) return;
        var input = el('momentInput');
        if (!input) return;
        input.value += button.dataset.emoji;
        input.focus();
      });
    }

    var momentFile = el('momentFile');
    var imageBtn = el('momentImageBtn');
    if (imageBtn && momentFile) {
      imageBtn.addEventListener('click', function () {
        momentFile.value = '';
        momentFile.click();
      });
      momentFile.addEventListener('change', function () {
        var files = Array.prototype.slice.call(momentFile.files || []);
        var room = 9 - draft.images.length;
        if (room <= 0) {
          if (global.TAToast) global.TAToast('一条动态最多 9 张图');
          return;
        }
        files.slice(0, room).forEach(function (file) {
          if (!/^image\//.test(file.type)) return;
          compressPhoto(file).then(function (url) {
            if (draft.images.length >= 9) return;
            draft.images.push(url);
            var editor = el('momentEditor');
            if (editor) editor.hidden = false;
            renderDraftImages();
          }).catch(function () {
            if (global.TAToast) global.TAToast('这张图读不出来，换一张试试');
          });
        });
      });
    }

    var meCards = el('meCards');
    if (meCards) meCards.addEventListener('click', function () { global.TAPanel.openCards(); });
    var meStickers = el('meStickers');
    if (meStickers) meStickers.addEventListener('click', function () { global.TAPanel.openStickers(); });
    var meSettings = el('meSettings');
    if (meSettings) meSettings.addEventListener('click', function () { global.TAPanel.openSettings(); });

    global.TAStore.on('cards', refreshList);
    global.TAStore.on('stickers', refreshList);
    global.TAStore.on('taName', refreshList);
    global.TAStore.on('mail', refreshList);
    global.TAStore.on('profile', function () {
      refreshList();
      renderMoments();
    });
    global.TAStore.on('reset', function () {
      refreshList();
      renderMoments();
    });
    global.TAStore.on('posts', renderMoments);

    showTab('list');
    refreshList();
  }

  global.TAShell = {
    init: init,
    refreshList: refreshList,
    showTab: showTab,
    openChat: openChat,
    closeChat: closeChat,
    openMoments: openMoments,
    renderMoments: renderMoments
  };
})(window);
