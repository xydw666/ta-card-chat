/* 面板：字卡库（含分组）、表情管理、设置。 */
(function (global) {
  'use strict';

  var sheet = null;
  var mask = null;
  var filterGroup = '全部';
  var targetGroup = '';
  var selection = new Set();
  var profileTab = 'names';
  var profileSide = 'ta';
  var askMode = 'text';
  var askThink = 10;
  var askMax = 2;

  var ICONS = {
    cards: '<svg viewBox="0 0 24 24"><path d="M12 6.4C10.4 5.2 8.4 4.6 6 4.6v12.2c2.4 0 4.4.6 6 1.8 1.6-1.2 3.6-1.8 6-1.8V4.6c-2.4 0-4.4.6-6 1.8Z"/><path d="M12 6.4v12.2"/></svg>',
    stickers: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><circle cx="9" cy="10" r=".9" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r=".9" fill="currentColor" stroke="none"/></svg>',
    ask: '<svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-3.9 3.4A.6.6 0 0 1 5 18.9V16"/><path d="M9.6 7.5a2.4 2.4 0 1 1 3.4 2.2c-.6.3-1 .8-1 1.5v.3"/><circle cx="12" cy="13.6" r=".75" fill="currentColor" stroke="none"/></svg>',
    call: '<svg viewBox="0 0 24 24"><path d="M4.6 5.9c-.9.9-1 2.2-.4 3.4 2 4.3 5.3 7.6 9.6 9.6 1.2.6 2.5.5 3.4-.4l1.1-1.1c.6-.6.5-1.6-.2-2.1l-2.2-1.5a1.5 1.5 0 0 0-1.8.1l-1 .8a13 13 0 0 1-4.4-4.4l.8-1a1.5 1.5 0 0 0 .1-1.8L8 5c-.5-.7-1.5-.8-2.1-.2Z"/></svg>',
    profile: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.6"/><path d="M4.8 20c.7-3.6 3.7-5.6 7.2-5.6s6.5 2 7.2 5.6"/></svg>',
    settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M4.5 12H2.1M21.9 12h-2.4M6.7 6.7 5 5M19 19l-1.7-1.7M17.3 6.7 19 5M5 19l1.7-1.7"/></svg>'
  };

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function toast(text) {
    if (global.TAToast) global.TAToast(text);
  }

  function paintSwitch(btn, on) {
    if (!btn) return;
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-checked', on ? 'true' : 'false');
  }

  function open(html, setup) {
    sheet = sheet || document.getElementById('sheet');
    mask = mask || document.getElementById('mask');
    sheet.innerHTML = html;
    sheet.hidden = false;
    mask.hidden = false;
    requestAnimationFrame(function () {
      sheet.classList.add('is-open');
      mask.classList.add('is-open');
    });
    var closeBtn = sheet.querySelector('.sheet-close');
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (typeof setup === 'function') setup(sheet);
  }

  function close() {
    if (!sheet || sheet.hidden) return;
    sheet.classList.remove('is-open');
    if (mask) mask.classList.remove('is-open');
    setTimeout(function () {
      if (!sheet.classList.contains('is-open')) {
        sheet.hidden = true;
        sheet.innerHTML = '';
      }
      if (mask && sheet.hidden) mask.hidden = true;
    }, 220);
  }

  /* ---------------- 字卡库 ---------------- */

  function openCards() {
    selection = new Set();
    var groups = global.TAStore.state.groups;
    if (filterGroup !== '全部' && groups.indexOf(filterGroup) === -1) filterGroup = '全部';
    if (!targetGroup || groups.indexOf(targetGroup) === -1) {
      targetGroup = filterGroup === '全部' ? global.TAStore.DEFAULT_GROUP : filterGroup;
    }

    open([
      '<div class="sheet-head">',
      '  <div><h2>字卡库</h2><p class="sheet-sub">按分组整理字卡；TA 会从全部字卡里随机抽。</p></div>',
      '  <button class="sheet-close" type="button" aria-label="关闭">×</button>',
      '</div>',
      '<div class="sheet-body">',
      '  <div class="group-bar" id="pcGroups"></div>',
      '  <section class="block">',
      '    <div class="list-head">',
      '      <span>添加字卡</span>',
      '      <div class="row-inline">',
      '        <span class="hint">添加到</span>',
      '        <select class="mini-select" id="pcTarget"></select>',
      '      </div>',
      '    </div>',
      '    <textarea id="pcAdd" rows="2" placeholder="写一句 TA 会说的话…"></textarea>',
      '    <div class="block-foot">',
      '      <span class="hint">重复的会自动跳过</span>',
      '      <div class="row-inline">',
      '        <button class="btn tiny" id="pcStickerCard" type="button">用表情当字卡</button>',
      '        <button class="btn primary" id="pcAddBtn" type="button">添加</button>',
      '      </div>',
      '    </div>',
      '  </section>',
      '  <section class="block">',
      '    <label class="block-label" for="pcBatch">批量添加（一行一张）</label>',
      '    <textarea id="pcBatch" rows="4" placeholder="一行一张，粘贴后点批量添加"></textarea>',
      '    <div class="block-foot">',
      '      <span class="hint">加到上面选的分组</span>',
      '      <button class="btn" id="pcBatchBtn" type="button">批量添加</button>',
      '    </div>',
      '  </section>',
      '  <section class="block">',
      '    <div class="list-head">',
      '      <span>当前分组 <b id="pcCount">0</b> 张</span>',
      '      <div class="list-tools">',
      '        <button class="btn tiny" id="pcAll" type="button">全选</button>',
      '        <button class="btn tiny" id="pcNone" type="button">取消</button>',
      '      </div>',
      '    </div>',
      '    <ul class="card-list" id="pcList"></ul>',
      '    <div class="block-foot">',
      '      <button class="btn danger" id="pcDelSel" type="button">删除选中（<b id="pcSelCount">0</b>）</button>',
      '      <div class="row-inline">',
      '        <select class="mini-select" id="pcMoveGroup"></select>',
      '        <button class="btn tiny" id="pcMoveBtn" type="button">移动</button>',
      '      </div>',
      '    </div>',
      '  </section>',
      '  <section class="block">',
      '    <div class="list-head"><span>分组</span><button class="btn tiny" id="pcNewGroup" type="button">新建分组</button></div>',
      '    <ul class="group-list" id="pcGroupList"></ul>',
      '  </section>',
      '  <section class="block">',
      '    <div class="row">',
      '      <button class="btn ghost" id="pcExport" type="button">导出备份</button>',
      '      <button class="btn ghost" id="pcImport" type="button">导入备份</button>',
      '      <input type="file" id="pcFile" accept=".json,application/json" hidden>',
      '    </div>',
      '    <p class="hint">字卡只存在这台设备的浏览器里，换设备请用备份。</p>',
      '  </section>',
      '</div>'
    ].join(''), function (root) {
      renderGroups(root);
      renderList(root);
      refreshSelection(root);

      root.querySelector('#pcAddBtn').addEventListener('click', function () {
        var input = root.querySelector('#pcAdd');
        var group = chosenGroup(root);
        var result = global.TAStore.addCards([input.value], group);
        if (!result.added) {
          toast(result.skipped ? '这张字卡已经有了' : '先写一句话吧');
          return;
        }
        input.value = '';
        toast('已添加到「' + group + '」');
        refreshAll(root);
      });

      root.querySelector('#pcStickerCard').addEventListener('click', function () {
        var group = chosenGroup(root);
        close();
        if (global.TAShell) global.TAShell.openChat();
        setTimeout(function () {
          global.TAStickers.openPicker(function (stickerId) {
            var card = global.TAStore.addStickerCard(stickerId, group);
            if (card) toast('已添加一个表情字卡');
            openCards();
          });
        }, 220);
      });

      root.querySelector('#pcBatchBtn').addEventListener('click', function () {
        var raw = root.querySelector('#pcBatch').value || '';
        var lines = raw.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
        if (!lines.length) { toast('先粘贴几行字卡'); return; }
        var result = global.TAStore.addCards(lines, chosenGroup(root));
        if (!result.added) { toast('这些字卡都已经存在了'); return; }
        root.querySelector('#pcBatch').value = '';
        toast('新增 ' + result.added + ' 张' + (result.skipped ? '，跳过 ' + result.skipped + ' 张重复' : ''));
        refreshAll(root);
      });

      root.querySelector('#pcAll').addEventListener('click', function () {
        visibleCards().forEach(function (card) { selection.add(card.id); });
        renderList(root);
        refreshSelection(root);
      });

      root.querySelector('#pcNone').addEventListener('click', function () {
        selection.clear();
        renderList(root);
        refreshSelection(root);
      });

      root.querySelector('#pcDelSel').addEventListener('click', function () {
        if (!selection.size) { toast('先勾选要删除的字卡'); return; }
        var removed = global.TAStore.removeCards(Array.from(selection));
        selection.clear();
        toast('已删除 ' + removed + ' 张');
        refreshAll(root);
      });

      root.querySelector('#pcMoveBtn').addEventListener('click', function () {
        if (!selection.size) { toast('先勾选要移动的字卡'); return; }
        var target = root.querySelector('#pcMoveGroup').value;
        var moved = global.TAStore.moveCards(Array.from(selection), target);
        selection.clear();
        toast('已移动到「' + target + '」');
        refreshAll(root);
      });

      root.querySelector('#pcNewGroup').addEventListener('click', function () {
        var name = window.prompt('新分组名称');
        if (!name || !name.trim()) return;
        var created = global.TAStore.addGroup(name);
        if (!created) { toast('分组名不能为空'); return; }
        filterGroup = created;
        targetGroup = created;
        toast('已创建「' + created + '」');
        openCards();
      });

      root.querySelector('#pcExport').addEventListener('click', function () {
        var payload = global.TAStore.exportData();
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'ta-cards-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
        toast('已导出 ' + payload.cards.length + ' 张');
      });

      var fileInput = root.querySelector('#pcFile');
      root.querySelector('#pcImport').addEventListener('click', function () {
        fileInput.click();
      });
      fileInput.addEventListener('change', function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var payload = JSON.parse(String(reader.result || ''));
            var result = global.TAStore.importCards(payload);
            toast(result.added ? '导入 ' + result.added + ' 张' : '没有可导入的新字卡');
            refreshAll(root);
          } catch (error) {
            toast('文件格式不对，需要 JSON 备份');
          }
          fileInput.value = '';
        };
        reader.readAsText(file);
      });
    });
  }

  function currentGroup() {
    return filterGroup === '全部' ? global.TAStore.DEFAULT_GROUP : filterGroup;
  }

  function chosenGroup(root) {
    var select = root ? root.querySelector('#pcTarget') : null;
    if (select && select.value) targetGroup = select.value;
    var groups = global.TAStore.state.groups;
    if (!targetGroup || groups.indexOf(targetGroup) === -1) {
      targetGroup = groups.indexOf(global.TAStore.DEFAULT_GROUP) === -1
        ? groups[0]
        : global.TAStore.DEFAULT_GROUP;
    }
    return targetGroup;
  }

  function visibleCards() {
    var cards = global.TAStore.state.cards;
    if (filterGroup === '全部') return cards;
    return cards.filter(function (card) { return card.group === filterGroup; });
  }

  function renderGroups(root) {
    var bar = root.querySelector('#pcGroups');
    var select = root.querySelector('#pcMoveGroup');
    var targetSelect = root.querySelector('#pcTarget');
    var list = root.querySelector('#pcGroupList');
    if (!bar) return;

    var groups = global.TAStore.state.groups;
    var counts = {};
    global.TAStore.state.cards.forEach(function (card) {
      counts[card.group] = (counts[card.group] || 0) + 1;
    });

    var chips = ['全部'].concat(groups).map(function (name) {
      var count = name === '全部' ? global.TAStore.state.cards.length : (counts[name] || 0);
      return '<button type="button" class="chip' + (filterGroup === name ? ' is-active' : '') + '" data-group="' + esc(name) + '">' +
        esc(name) + '<span>' + count + '</span></button>';
    });
    bar.innerHTML = chips.join('');
    bar.querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        filterGroup = chip.dataset.group;
        if (filterGroup !== '全部') targetGroup = filterGroup;
        selection.clear();
        renderGroups(root);
        renderList(root);
        refreshSelection(root);
      });
    });

    if (targetSelect) {
      targetSelect.innerHTML = groups.map(function (name) {
        return '<option value="' + esc(name) + '">' + esc(name) + '</option>';
      }).join('');
      if (groups.indexOf(targetGroup) === -1) targetGroup = groups[0];
      targetSelect.value = targetGroup;
      targetSelect.onchange = function () {
        targetGroup = targetSelect.value || global.TAStore.DEFAULT_GROUP;
      };
    }

    if (select) {
      select.innerHTML = groups.map(function (name) {
        return '<option value="' + esc(name) + '">' + esc(name) + '</option>';
      }).join('');
      select.value = currentGroup();
    }

    if (list) {
      list.innerHTML = groups.map(function (name) {
        var deletable = name !== global.TAStore.DEFAULT_GROUP;
        return '<li class="group-row" data-group="' + esc(name) + '">' +
          '<span class="group-name">' + esc(name) + '</span>' +
          '<span class="group-count">' + (counts[name] || 0) + ' 张</span>' +
          (deletable ? '<button type="button" class="group-del" data-del="' + esc(name) + '">删除</button>' : '<span class="group-tag">默认</span>') +
          '</li>';
      }).join('');
      list.querySelectorAll('.group-del').forEach(function (button) {
        button.addEventListener('click', function () {
          var name = button.dataset.del;
          if (!window.confirm('删除分组「' + name + '」？里面的字卡会移到「默认」。')) return;
          global.TAStore.removeGroup(name);
          if (filterGroup === name) filterGroup = '全部';
          toast('已删除分组');
          openCards();
        });
      });
    }
  }

  function renderList(root) {
    var list = root.querySelector('#pcList');
    var countEl = root.querySelector('#pcCount');
    if (!list) return;
    var cards = visibleCards();
    if (countEl) countEl.textContent = String(cards.length);

    if (!cards.length) {
      list.innerHTML = '<li class="card-empty">这个分组还没有字卡，先在上面加一张吧。</li>';
      return;
    }

    list.innerHTML = cards.map(function (card) {
      var checked = selection.has(card.id) ? ' checked' : '';
      var body = card.stickerId
        ? '<div class="card-thumb">' + stickerThumb(card.stickerId) + '</div>'
        : '<p class="card-text">' + esc(card.text) + '</p>';
      return [
        '<li class="card-item' + (checked ? ' is-selected' : '') + '" data-id="' + esc(card.id) + '">',
        '  <label class="check"><input type="checkbox" class="pc-check"' + checked + '><span class="box"></span></label>',
        body,
        '  <span class="card-group">' + esc(card.group) + '</span>',
        '  <button class="card-del" type="button" aria-label="删除这张字卡">×</button>',
        '</li>'
      ].join('');
    }).join('');

    list.querySelectorAll('.card-item').forEach(function (item) {
      var id = item.dataset.id;
      var checkbox = item.querySelector('.pc-check');

      checkbox.addEventListener('change', function () {
        if (checkbox.checked) selection.add(id);
        else selection.delete(id);
        item.classList.toggle('is-selected', checkbox.checked);
        refreshSelection(root);
      });

      item.querySelector('.card-del').addEventListener('click', function () {
        global.TAStore.removeCards([id]);
        selection.delete(id);
        toast('已删除');
        refreshAll(root);
      });
    });
  }

  function stickerThumb(id) {
    var sticker = global.TAStore.getSticker(id);
    if (!sticker) return '<span class="card-thumb-missing">表情已删除</span>';
    return '<img src="' + sticker.dataUrl + '" alt="表情字卡">';
  }

  function refreshSelection(root) {
    var count = root.querySelector('#pcSelCount');
    if (count) count.textContent = String(selection.size);
  }

  function refreshAll(root) {
    var alive = new Set(global.TAStore.state.cards.map(function (card) { return card.id; }));
    selection.forEach(function (id) { if (!alive.has(id)) selection.delete(id); });
    renderGroups(root);
    renderList(root);
    refreshSelection(root);
  }

  /* ---------------- 表情管理 ---------------- */

  function openStickers() {
    open([
      '<div class="sheet-head">',
      '  <div><h2>表情管理</h2><p class="sheet-sub">自定义表情从相册上传，聊天双方都能用。</p></div>',
      '  <button class="sheet-close" type="button" aria-label="关闭">×</button>',
      '</div>',
      '<div class="sheet-body">',
      '  <section class="block">',
      '    <div class="list-head">',
      '      <span>我的表情 <b id="stkCount">0</b> 个</span>',
      '      <button class="btn primary" id="stkAdd" type="button">从相册添加</button>',
      '    </div>',
      '    <div class="stk-grid" id="stkGrid"></div>',
      '    <p class="hint">图片会自动压缩成小表情；删掉表情时，用到它的字卡也会一起移除。</p>',
      '  </section>',
      '  <section class="block">',
      '    <p class="block-label">系统默认表情</p>',
      '    <div class="stk-grid is-system" id="stkSystem"></div>',
      '  </section>',
      '</div>'
    ].join(''), function (root) {
      renderStickerManager(root);
      root.querySelector('#stkAdd').addEventListener('click', function () {
        global.TAStickers.pickFromAlbum();
      });
    });
  }

  function renderStickerManager(root) {
    var grid = root.querySelector('#stkGrid');
    var systemGrid = root.querySelector('#stkSystem');
    var countEl = root.querySelector('#stkCount');
    if (!grid) return;

    var stickers = global.TAStore.state.stickers;
    if (countEl) countEl.textContent = String(stickers.length);

    grid.innerHTML = stickers.length
      ? stickers.map(function (sticker) {
        return '<div class="stk-cell" data-id="' + sticker.id + '">' +
          '<img src="' + sticker.dataUrl + '" alt="表情">' +
          '<button type="button" class="stk-del" aria-label="删除">×</button>' +
          '</div>';
      }).join('')
      : '<p class="stk-empty">还没有自定义表情</p>';

    grid.querySelectorAll('.stk-del').forEach(function (button) {
      button.addEventListener('click', function () {
        var cell = button.closest('.stk-cell');
        if (!cell) return;
        global.TAStore.removeSticker(cell.dataset.id);
        toast('已删除表情');
        renderStickerManager(root);
      });
    });

    if (systemGrid) {
      systemGrid.innerHTML = global.TAStickers.emojis.slice(0, 32).map(function (emoji) {
        return '<span class="stk-emoji">' + emoji + '</span>';
      }).join('');
    }
  }

  /* ---------------- 设置 ---------------- */

  function openSettings() {
    var state = global.TAStore.state;
    var settings = state.settings;

    open([
      '<div class="sheet-head">',
      '  <div><h2>设置</h2><p class="sheet-sub">都只保存在这台设备上。</p></div>',
      '  <button class="sheet-close" type="button" aria-label="关闭">×</button>',
      '</div>',
      '<div class="sheet-body">',
      '  <section class="block">',
      '    <label class="block-label" for="stName">TA 的名字</label>',
      '    <input id="stName" type="text" maxlength="24" value="' + esc(state.taName) + '">',
      '  </section>',
      '  <section class="block">',
      '    <div class="setting-row">',
      '      <div><p class="setting-title">字卡回复时间</p><p class="setting-sub">TA 收到消息后等多久再回，0 秒就是立刻</p></div>',
      '      <div class="row-inline"><input class="num-input" id="stDelay" type="number" min="0" step="0.5" value="' + (settings.replyDelay / 1000) + '"><span class="hint">秒</span></div>',
      '    </div>',
      '  </section>',
      '  <section class="block">',
      '    <div class="setting-row">',
      '      <div><p class="setting-title">TA 主动发消息</p><p class="setting-sub">在最短和最长之间随机挑个时间，主动发一张字卡</p></div>',
      '      <button class="switch" id="stActive" type="button" role="switch"></button>',
      '    </div>',
      '    <div class="setting-row small">',
      '      <span>最短间隔</span>',
      '      <div class="row-inline"><input class="num-input" id="stActiveMin" type="number" min="1" step="1" value="' + settings.activeMinutes + '"><span class="hint">分钟</span></div>',
      '    </div>',
      '    <div class="setting-row small">',
      '      <span>最长间隔</span>',
      '      <div class="row-inline"><input class="num-input" id="stActiveMax" type="number" min="1" step="1" value="' + settings.activeMaxMinutes + '"><span class="hint">分钟</span></div>',
      '    </div>',
      '  </section>',
      '  <section class="block">',
      '    <p class="setting-title">信箱来信间隔</p>',
      '    <p class="setting-sub">TA 会在这个范围里随机挑一个时间写信</p>',
      '    <div class="setting-row small">',
      '      <span>最短</span>',
      '      <div class="row-inline"><input class="num-input" id="stMailMin" type="number" min="0" step="1" value="' + settings.mailMinHours + '"><span class="hint">小时</span></div>',
      '    </div>',
      '    <div class="setting-row small">',
      '      <span>最长</span>',
      '      <div class="row-inline"><input class="num-input" id="stMailMax" type="number" min="0" step="1" value="' + settings.mailMaxHours + '"><span class="hint">小时</span></div>',
      '    </div>',
      '  </section>',
      '  <section class="block">',
      '    <div class="setting-row">',
      '      <div><p class="setting-title">避免连续重复</p><p class="setting-sub">不会连着两次抽到同一张字卡</p></div>',
      '      <button class="switch" id="stRepeat" type="button" role="switch"></button>',
      '    </div>',
      '  </section>',
      '  <section class="block">',
      '    <div class="setting-row">',
      '      <div><p class="setting-title">拼音随机拼句</p><p class="setting-sub">TA 用拼音一个字一个字拼句子发给你</p></div>',
      '      <button class="switch" id="stTyping" type="button" role="switch"></button>',
      '    </div>',
      '    <div class="setting-row small">',
      '      <span>拼句间隔</span>',
      '      <div class="row-inline"><input class="num-input" id="stPinyinSec" type="number" min="3" step="1" value="' + settings.pinyinAutoSeconds + '"><span class="hint">秒</span></div>',
      '    </div>',
      '    <div class="speed-group" id="speedGroup">',
      '      <div class="setting-row small"><span>通顺度</span><b class="setting-value" id="stSmoothLabel"></b></div>',
      '      <input type="range" id="stSmooth" min="0" max="100" step="5" value="' + settings.smooth + '">',
      '      <p class="hint">0 是纯随机乱字，越高越像人话</p>',
      '      <div class="setting-row small"><span>敲字母速度</span><b class="setting-value" id="stLetterLabel"></b></div>',
      '      <input type="range" id="stLetter" min="20" max="2000" step="10" value="' + settings.letterSpeed + '">',
      '      <div class="setting-row small"><span>选字停留</span><b class="setting-value" id="stCandLabel"></b></div>',
      '      <input type="range" id="stCand" min="80" max="6000" step="20" value="' + settings.candidateSpeed + '">',
      '    </div>',
      '  </section>',
      '  <section class="block">',
      '    <button class="btn ghost full" id="stClearChat" type="button">清空聊天记录</button>',
      '    <p class="hint">清空后不可恢复，字卡不会受影响。</p>',
      '  </section>',
      '</div>'
    ].join(''), function (root) {
      var nameInput = root.querySelector('#stName');
      var delayInput = root.querySelector('#stDelay');
      var activeBtn = root.querySelector('#stActive');
      var activeInput = root.querySelector('#stActiveMin');
      var activeMaxInput = root.querySelector('#stActiveMax');
      var pinyinSecInput = root.querySelector('#stPinyinSec');
      var mailMinInput = root.querySelector('#stMailMin');
      var mailMaxInput = root.querySelector('#stMailMax');
      var repeatBtn = root.querySelector('#stRepeat');
      var typingBtn = root.querySelector('#stTyping');
      var speedGroup = root.querySelector('#speedGroup');
      var letterInput = root.querySelector('#stLetter');
      var candInput = root.querySelector('#stCand');
      var smoothInput = root.querySelector('#stSmooth');
      var smoothLabel = root.querySelector('#stSmoothLabel');
      var letterLabel = root.querySelector('#stLetterLabel');
      var candLabel = root.querySelector('#stCandLabel');

      function paintSpeeds() {
        var current = global.TAStore.state.settings;
        letterLabel.textContent = (current.letterSpeed / 1000).toFixed(2) + ' 秒';
        candLabel.textContent = (current.candidateSpeed / 1000).toFixed(2) + ' 秒';
        smoothLabel.textContent = current.smooth <= 0 ? '纯随机' : current.smooth + '%';
        speedGroup.classList.toggle('is-off', !current.typing);
      }

      paintSwitch(repeatBtn, global.TAStore.state.settings.avoidRepeat);
      paintSwitch(typingBtn, global.TAStore.state.settings.typing);
      paintSpeeds();

      nameInput.addEventListener('change', function () {
        global.TAStore.setTaName(nameInput.value);
        nameInput.value = global.TAStore.state.taName;
      });

      delayInput.addEventListener('input', function () {
        var seconds = Number(delayInput.value);
        if (!isFinite(seconds) || seconds < 0) return;
        global.TAStore.updateSettings({ replyDelay: Math.round(seconds * 1000) });
      });

      paintSwitch(activeBtn, global.TAStore.state.settings.activeOn);
      activeBtn.addEventListener('click', function () {
        var next = !global.TAStore.state.settings.activeOn;
        global.TAStore.updateSettings({ activeOn: next });
        paintSwitch(activeBtn, next);
      });

      activeInput.addEventListener('input', function () {
        var value = Number(activeInput.value);
        if (!isFinite(value) || value < 1) return;
        global.TAStore.updateSettings({ activeMinutes: Math.round(value) });
      });

      activeMaxInput.addEventListener('input', function () {
        var value = Number(activeMaxInput.value);
        if (!isFinite(value) || value < 1) return;
        global.TAStore.updateSettings({ activeMaxMinutes: Math.round(value) });
      });

      pinyinSecInput.addEventListener('input', function () {
        var value = Number(pinyinSecInput.value);
        if (!isFinite(value) || value < 3) return;
        global.TAStore.updateSettings({ pinyinAutoSeconds: Math.round(value) });
      });

      mailMinInput.addEventListener('input', function () {
        var value = Number(mailMinInput.value);
        if (!isFinite(value) || value < 0) return;
        global.TAStore.updateSettings({ mailMinHours: Math.round(value) });
      });

      mailMaxInput.addEventListener('input', function () {
        var value = Number(mailMaxInput.value);
        if (!isFinite(value) || value < 0) return;
        global.TAStore.updateSettings({ mailMaxHours: Math.round(value) });
      });

      repeatBtn.addEventListener('click', function () {
        var next = !global.TAStore.state.settings.avoidRepeat;
        global.TAStore.updateSettings({ avoidRepeat: next });
        paintSwitch(repeatBtn, next);
      });

      typingBtn.addEventListener('click', function () {
        var next = !global.TAStore.state.settings.typing;
        global.TAStore.updateSettings({ typing: next });
        paintSwitch(typingBtn, next);
        paintSpeeds();
        if (next && global.TATyping) {
          global.TATyping.ensureDicts().then(function (ok) {
            if (!ok) toast('词库加载失败，动画会退化成逐字显示');
          });
        }
      });

      letterInput.addEventListener('input', function () {
        var value = Number(letterInput.value) || 70;
        global.TAStore.updateSettings({ letterSpeed: value });
        letterLabel.textContent = (value / 1000).toFixed(2) + ' 秒';
      });

      candInput.addEventListener('input', function () {
        var value = Number(candInput.value) || 300;
        global.TAStore.updateSettings({ candidateSpeed: value });
        candLabel.textContent = (value / 1000).toFixed(2) + ' 秒';
      });

      smoothInput.addEventListener('input', function () {
        var value = Number(smoothInput.value) || 0;
        global.TAStore.updateSettings({ smooth: value });
        smoothLabel.textContent = value <= 0 ? '纯随机' : value + '%';
      });

      root.querySelector('#stClearChat').addEventListener('click', function () {
        if (!global.TAStore.state.messages.length) { toast('还没有聊天记录'); return; }
        if (!window.confirm('确定清空全部聊天记录吗？')) return;
        global.TAStore.clearMessages();
        toast('聊天记录已清空');
        close();
      });
    });
  }

  /* ---------------- 头像与昵称 ---------------- */

  function openProfile(tab, side) {
    if (tab) profileTab = tab;
    if (side) profileSide = side;
    var state = global.TAStore.state;
    var namesMode = profileTab === 'names';
    var taPool = namesMode ? state.taNames : state.taAvatars;
    var myPool = namesMode ? state.myNames : state.myAvatars;
    var pool = profileSide === 'ta' ? taPool : myPool;
    var unit = namesMode ? '昵称' : '头像';

    var listHtml = namesMode
      ? (pool.length ? pool.map(function (name) {
          return '<span class="pool-chip">' + esc(name) +
            '<button type="button" data-name="' + esc(name) + '" aria-label="删除">×</button></span>';
        }).join('') : '<p class="hint pool-empty">这个昵称池还是空的，先加几个。</p>')
      : (pool.length ? '<div class="pool-avatars">' + pool.map(function (url, index) {
          return '<div class="pool-avatar"><img src="' + url + '" alt="头像">' +
            '<button type="button" data-avatar-del="' + index + '" aria-label="删除">×</button></div>';
        }).join('') + '</div>' : '<p class="hint pool-empty">这个头像池还是空的，先加几张。</p>');

    open([
      '<div class="sheet-head">',
      '  <div><h2>头像和昵称互动 · ' + esc(state.taName) + '</h2><p class="sheet-sub">双方各有头像池和昵称池，可以手动换，也可以让 TA 定时随机换。</p></div>',
      '  <button class="sheet-close" type="button" aria-label="关闭">×</button>',
      '</div>',
      '<div class="sheet-body">',
      '  <div class="seg-tabs">',
      '    <button type="button" class="seg-tab' + (namesMode ? '' : ' is-on') + '" data-pf-tab="avatars">头像</button>',
      '    <button type="button" class="seg-tab' + (namesMode ? ' is-on' : '') + '" data-pf-tab="names">昵称</button>',
      '  </div>',
      '  <div class="pool-tabs">',
      '    <button type="button" class="pool-tab' + (profileSide === 'ta' ? ' is-on' : '') + '" data-pf-side="ta">' + esc(state.taName) + ' 的' + unit + '库 (' + taPool.length + ')</button>',
      '    <button type="button" class="pool-tab' + (profileSide === 'me' ? ' is-on' : '') + '" data-pf-side="me">' + esc(state.myName) + ' 的' + unit + '库 (' + myPool.length + ')</button>',
      '  </div>',
      '  <div class="pool-panel">' + listHtml + '</div>',
      '  <button type="button" class="pool-add" data-pf="add">＋ 添加' + unit + (namesMode ? '（一行一个，可批量）' : '（可多选）') + '</button>',
      namesMode ? '  <div class="pool-addbox" id="pfAddBox" hidden><textarea id="pfNames" rows="3" placeholder="一行一个昵称"></textarea><div class="block-foot"><span class="hint">加到当前昵称池</span><button class="btn primary" id="pfNamesSave" type="button">添加</button></div></div>' : '',
      '  <button type="button" class="pool-clear" data-pf="clear">🗑 清空' + unit + '池</button>',
      '  <section class="block">',
      '    <div class="setting-row">',
      '      <div><p class="setting-title">开启随机更换</p><p class="setting-sub">TA 会每隔一段时间从池里随机换' + unit + '</p></div>',
      '      <button class="switch" id="pfRandom" type="button" role="switch"></button>',
      '    </div>',
      '    <div class="setting-row small">',
      '      <span>最短 / 最长间隔</span>',
      '      <div class="row-inline">',
      '        <input class="num-input" id="pfMinH" type="number" min="0.1" step="0.1" value="' + state.settings.profileMinHours + '">',
      '        <span class="hint">—</span>',
      '        <input class="num-input" id="pfMaxH" type="number" min="0.1" step="0.1" value="' + state.settings.profileMaxHours + '">',
      '        <span class="hint">小时</span>',
      '      </div>',
      '    </div>',
      '    <p class="hint">只换聊天里显示的头像和昵称，历史消息不受影响。</p>',
      '  </section>',
      '</div>',
      '<input type="file" id="pfFile" accept="image/*" multiple hidden>'
    ].join(''), function (root) {
      var file = root.querySelector('#pfFile');
      var randomBtn = root.querySelector('#pfRandom');
      var randomOn = namesMode ? state.settings.randomNamesOn : state.settings.randomAvatarsOn;

      root.querySelectorAll('[data-pf-tab]').forEach(function (button) {
        button.addEventListener('click', function () {
          openProfile(button.dataset.pfTab, profileSide);
        });
      });

      root.querySelectorAll('[data-pf-side]').forEach(function (button) {
        button.addEventListener('click', function () {
          openProfile(profileTab, button.dataset.pfSide);
        });
      });

      root.querySelectorAll('[data-name]').forEach(function (button) {
        button.addEventListener('click', function () {
          global.TAStore.removeName(profileSide, button.dataset.name);
          openProfile();
        });
      });

      root.querySelectorAll('[data-avatar-del]').forEach(function (button) {
        button.addEventListener('click', function () {
          var url = pool[Number(button.dataset.avatarDel)];
          if (url) global.TAStore.removeAvatar(profileSide, url);
          openProfile();
        });
      });

      /* 点头像 = 立刻换成当前头像 */
      root.querySelectorAll('.pool-avatar img').forEach(function (img) {
        img.addEventListener('click', function () {
          global.TAStore.setAvatar(profileSide, img.getAttribute('src'));
          toast(profileSide === 'ta' ? '对方的头像已换' : '我的头像已换');
          openProfile();
        });
      });

      root.querySelector('[data-pf="add"]').addEventListener('click', function () {
        if (namesMode) {
          var box = root.querySelector('#pfAddBox');
          box.hidden = !box.hidden;
          if (!box.hidden) root.querySelector('#pfNames').focus();
          return;
        }
        file.value = '';
        file.click();
      });

      root.querySelector('[data-pf="clear"]').addEventListener('click', function () {
        if (!pool.length) { toast(unit + '池已经是空的'); return; }
        if (!window.confirm('清空这个' + unit + '池？')) return;
        if (namesMode) global.TAStore.clearNames(profileSide);
        else global.TAStore.clearAvatars(profileSide);
        toast(unit + '池已清空');
        openProfile();
      });

      if (namesMode) {
        root.querySelector('#pfNamesSave').addEventListener('click', function () {
          var text = root.querySelector('#pfNames').value || '';
          var list = text.split('\n').map(function (item) { return item.trim(); }).filter(Boolean);
          if (!list.length) { toast('先写几个昵称'); return; }
          var result = global.TAStore.addNames(profileSide, list);
          toast('已添加 ' + result.added + ' 个昵称' +
            (result.skipped ? '，跳过 ' + result.skipped + ' 个重复' : ''));
          openProfile();
        });
      } else {
        file.addEventListener('change', function () {
          var files = Array.prototype.slice.call(file.files || []);
          if (!files.length || !global.TAStickers) return;
          toast('正在处理 ' + files.length + ' 张图…');
          Promise.all(files.map(function (item) {
            return global.TAStickers.compressFile(item, 200).catch(function () { return ''; });
          })).then(function (urls) {
            var result = global.TAStore.addAvatars(profileSide, urls.filter(Boolean));
            if (result.error === 'quota') toast('本地空间不够了，先删掉几张');
            else toast('已添加 ' + result.added + ' 张头像');
            openProfile();
          });
        });
      }

      paintSwitch(randomBtn, randomOn);
      randomBtn.addEventListener('click', function () {
        var key = namesMode ? 'randomNamesOn' : 'randomAvatarsOn';
        var patch = {};
        patch[key] = !randomOn;
        global.TAStore.updateSettings(patch);
        randomOn = patch[key];
        paintSwitch(randomBtn, randomOn);
        if (randomOn) {
          var minHour = Math.max(0.1, Number(global.TAStore.state.settings.profileMinHours) || 1);
          global.TAStore.setProfileNext(namesMode ? 'names' : 'avatars', Date.now() + minHour * 3600 * 1000);
        }
      });

      var minInput = root.querySelector('#pfMinH');
      var maxInput = root.querySelector('#pfMaxH');
      minInput.addEventListener('change', function () {
        var min = Math.max(0.1, Number(minInput.value) || 0.1);
        global.TAStore.updateSettings({ profileMinHours: min });
        if (Number(maxInput.value) < min) {
          maxInput.value = min;
          global.TAStore.updateSettings({ profileMaxHours: min });
        }
      });
      maxInput.addEventListener('change', function () {
        var max = Math.max(0.1, Number(maxInput.value) || 0.1);
        var min = Math.max(0.1, Number(global.TAStore.state.settings.profileMinHours) || 0.1);
        if (max < min) max = min;
        global.TAStore.updateSettings({ profileMaxHours: max });
        maxInput.value = max;
      });
    });
  }

  /* ---------------- 问问他 ---------------- */

  function parseOptionLines(text) {
    return String(text || '').split('\n').map(function (line) {
      return line.trim();
    }).filter(Boolean).map(function (line) {
      var parts = line.split('~');
      var label = (parts[0] || '').trim();
      return { label: label, reply: (parts[1] || '').trim() || label };
    }).filter(function (item) { return !!item.label; });
  }

  function buildAskReply(options, mode, maxPick) {
    if (mode === 'text' || !options.length) {
      var card = global.TAStore.drawCard();
      if (!card) return null;
      return { text: card.text || '', stickerId: card.stickerId || '' };
    }
    if (mode === 'single') {
      var one = options[Math.floor(Math.random() * options.length)];
      return { text: one.reply, stickerId: '' };
    }
    var limit = Math.max(1, Math.min(Number(maxPick) || 2, options.length));
    var count = 1 + Math.floor(Math.random() * limit);
    var pool = options.slice();
    var picked = [];
    while (picked.length < count && pool.length) {
      picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    return {
      text: picked.map(function (item) { return item.reply; }).join('、'),
      stickerId: ''
    };
  }

  function openAsk() {
    function modeBtn(key, label) {
      return '<button type="button" class="seg-tab' + (askMode === key ? ' is-on' : '') +
        '" data-ask-mode="' + key + '">' + label + '</button>';
    }

    open([
      '<div class="sheet-head">',
      '  <div><h2>问问他</h2><p class="sheet-sub">问一句，TA 按你定的规则回答。</p></div>',
      '  <button class="sheet-close" type="button" aria-label="关闭">×</button>',
      '</div>',
      '<div class="sheet-body">',
      '  <input class="name-input" id="askInput" type="text" maxlength="120" placeholder="你的问题？">',
      '  <button type="button" class="ask-batch-btn" id="askBatchBtn">批量设置问卷</button>',
      '  <div class="pool-addbox" id="askBatchBox" hidden>',
      '    <textarea id="askBatch" rows="4" placeholder="每行一条，可写：问题~选项1~选项2"></textarea>',
      '    <div class="block-foot"><span class="hint">每行依次发出</span><button class="btn primary" id="askBatchSend" type="button">按问卷发送</button></div>',
      '  </div>',
      '  <div class="seg-tabs ask-modes">' + modeBtn('text', '文字回复') + modeBtn('single', '单选题') + modeBtn('multi', '多选题') + '</div>',
      '  <div id="askOptionsWrap"' + (askMode === 'text' ? ' hidden' : '') + '>',
      '    <textarea id="askOptions" rows="4" placeholder="选项：每行一个；可写 选项~TA回应"></textarea>',
      '    <div class="ask-row" id="askMaxRow"' + (askMode === 'multi' ? '' : ' hidden') + '>',
      '      <span>最多选几个</span>',
      '      <div class="stepper">',
      '        <button type="button" data-ask-step="max-down">−</button>',
      '        <input id="askMax" type="number" min="1" max="9" value="' + askMax + '">',
      '        <button type="button" data-ask-step="max-up">＋</button>',
      '      </div>',
      '    </div>',
      '  </div>',
      '  <div class="ask-row">',
      '    <span>思考时间（秒）</span>',
      '    <div class="stepper">',
      '      <button type="button" data-ask-step="down">−</button>',
      '      <input id="askThink" type="number" min="0" max="600" value="' + askThink + '">',
      '      <button type="button" data-ask-step="up">＋</button>',
      '    </div>',
      '  </div>',
      '  <div class="ask-actions">',
      '    <button type="button" class="ask-cancel" data-ask="cancel">取消</button>',
      '    <button type="button" class="ask-send" data-ask="send">发送</button>',
      '  </div>',
      '</div>'
    ].join(''), function (root) {
      var input = root.querySelector('#askInput');
      var optionsBox = root.querySelector('#askOptions');
      var thinkInput = root.querySelector('#askThink');
      var maxInput = root.querySelector('#askMax');
      var optionsWrap = root.querySelector('#askOptionsWrap');
      var maxRow = root.querySelector('#askMaxRow');

      input.focus();

      root.querySelectorAll('[data-ask-mode]').forEach(function (button) {
        button.addEventListener('click', function () {
          askMode = button.dataset.askMode;
          root.querySelectorAll('[data-ask-mode]').forEach(function (other) {
            other.classList.toggle('is-on', other === button);
          });
          optionsWrap.hidden = askMode === 'text';
          maxRow.hidden = askMode !== 'multi';
        });
      });

      root.querySelectorAll('[data-ask-step]').forEach(function (button) {
        button.addEventListener('click', function () {
          var step = button.dataset.askStep;
          if (step === 'down' || step === 'up') {
            var value = Number(thinkInput.value) || 0;
            value += step === 'up' ? 1 : -1;
            thinkInput.value = Math.min(600, Math.max(0, value));
            askThink = Number(thinkInput.value);
            return;
          }
          var maxValue = Number(maxInput.value) || 1;
          maxValue += step === 'max-up' ? 1 : -1;
          maxInput.value = Math.min(9, Math.max(1, maxValue));
          askMax = Number(maxInput.value);
        });
      });
      thinkInput.addEventListener('change', function () {
        askThink = Math.min(600, Math.max(0, Number(thinkInput.value) || 0));
        thinkInput.value = askThink;
      });
      maxInput.addEventListener('change', function () {
        askMax = Math.min(9, Math.max(1, Number(maxInput.value) || 1));
        maxInput.value = askMax;
      });

      root.querySelector('#askBatchBtn').addEventListener('click', function () {
        var box = root.querySelector('#askBatchBox');
        box.hidden = !box.hidden;
        if (!box.hidden) root.querySelector('#askBatch').focus();
      });

      function thinkMs() {
        return Math.max(0, Number(thinkInput.value) || 0) * 1000;
      }

      root.querySelector('[data-ask="cancel"]').addEventListener('click', close);
      root.querySelector('[data-ask="send"]').addEventListener('click', function () {
        var question = input.value.trim();
        if (!question) { toast('先写一个问题'); return; }
        var options = parseOptionLines(optionsBox.value);
        if (askMode !== 'text' && options.length < 2) { toast('至少写两个选项'); return; }
        if (askMode === 'text' && !global.TAStore.state.cards.length) {
          toast('先去字卡库添加几张字卡');
          return;
        }
        var reply = buildAskReply(options, askMode, askMax);
        if (!reply) { toast('还没有可用的字卡'); return; }
        global.TAChat.ask(question, reply.text, thinkMs(), reply.stickerId);
        close();
      });

      root.querySelector('#askBatchSend').addEventListener('click', function () {
        var lines = root.querySelector('#askBatch').value.split('\n').map(function (line) {
          return line.trim();
        }).filter(Boolean);
        if (!lines.length) { toast('每行写一个问题'); return; }

        var items = lines.map(function (line) {
          var parts = line.split('~').map(function (part) { return part.trim(); });
          return { question: parts[0], options: parts.slice(1).filter(Boolean) };
        }).filter(function (item) { return !!item.question; });

        var shared = parseOptionLines(optionsBox.value);
        var index = 0;
        var wait = thinkMs();

        function step() {
          if (index >= items.length) return;
          var item = items[index++];
          var list = item.options.length
            ? item.options.map(function (label) { return { label: label, reply: label }; })
            : shared;
          var reply = buildAskReply(list, askMode, askMax);
          if (!reply) { toast('还没有可用的字卡'); return; }
          global.TAChat.ask(item.question, reply.text, wait, reply.stickerId);
          if (index < items.length) setTimeout(step, wait + 1000);
        }

        step();
        close();
      });
    });
  }

  /* ---------------- 加号菜单 ---------------- */

  function openPlusMenu() {
    var tiles = [
      { key: 'cards', label: '字卡库' },
      { key: 'stickers', label: '表情' },
      { key: 'call', label: '通话' },
      { key: 'ask', label: '问问他' },
      { key: 'profile', label: '头像和昵称互动' },
      { key: 'settings', label: '设置' }
    ];

    open([
      '<div class="sheet-head">',
      '  <div><h2>互动</h2><p class="sheet-sub">聊天里还能做这些事</p></div>',
      '  <button class="sheet-close" type="button" aria-label="关闭">×</button>',
      '</div>',
      '<div class="sheet-body">',
      '  <div class="tool-grid">',
      tiles.map(function (tile) {
        return '<button type="button" class="tool-tile" data-plus="' + tile.key + '">' +
          '<span class="tool-icon">' + ICONS[tile.key] + '</span>' +
          '<span class="tool-label">' + tile.label + '</span></button>';
      }).join(''),
      '  </div>',
      '</div>'
    ].join(''), function (root) {
      root.querySelectorAll('[data-plus]').forEach(function (button) {
        button.addEventListener('click', function () {
          var action = button.dataset.plus;
          if (action === 'cards') openCards();
          else if (action === 'stickers') openStickers();
          else if (action === 'call') {
            close();
            setTimeout(function () {
              if (global.TACall) global.TACall.open();
            }, 220);
          }
          else if (action === 'ask') openAsk();
          else if (action === 'profile') openProfile();
          else openSettings();
        });
      });
    });
  }

  function init() {
    sheet = document.getElementById('sheet');
    mask = document.getElementById('mask');
    if (mask) mask.addEventListener('click', close);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') close();
    });
    global.TAStore.on('stickers', function () {
      if (!sheet || sheet.hidden) return;
      if (sheet.querySelector('#stkGrid')) renderStickerManager(sheet);
    });
  }

  global.TAPanel = {
    init: init,
    openCards: openCards,
    openSettings: openSettings,
    openStickers: openStickers,
    openProfile: openProfile,
    openAsk: openAsk,
    openPlusMenu: openPlusMenu,
    close: close
  };
})(window);
