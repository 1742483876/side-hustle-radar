(function () {
  'use strict';
  var PLAYS = window.PLAYS || [];
  var CATS = window.CATS || {};
  var REPORTS = window.REPORTS || [];
  var PLAN = window.PLAN || [];
  var app = document.getElementById('app');
  var NATIVE = !!window.__NATIVE_APP__;
  var SITE_URL = 'https://1742483876.github.io/side-hustle-radar/';
  var PH = { up: '上升期', peak: '高峰期', down: '退潮期', warn: '警示' };
  var ST = { try: '想试试', doing: '在推进', pause: '先放放' };
  var deferredPrompt = null;

  // ---------- 工具 ----------
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function find(id) { for (var i = 0; i < PLAYS.length; i++) if (PLAYS[i].id === id) return PLAYS[i]; return null; }
  function col(p) { return (CATS[p.cat] || {}).c || '#555'; }
  function $(s) { return app.querySelector(s); }
  function native(msg) { try { window.webkit.messageHandlers.native.postMessage(msg); return true; } catch (e) { return false; } }
  function haptic(s) { if (!native({ type: 'haptic', style: s || 'light' }) && navigator.vibrate) navigator.vibrate(8); }
  function toast(m) {
    var t = document.getElementById('toast'); t.textContent = m; t.className = 'toast show';
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.className = 'toast'; }, 1600);
  }
  function fmt(n) { var neg = n < 0; n = Math.round(Math.abs(n)); return (neg ? '-' : '') + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function standalone() { return NATIVE || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true; }

  // 状态：swipes {id:1|0}；push {id:{ts,st,d:{i:1}}}
  function swipes() { return load('rd_sw', {}); }
  function pushes() { return load('rd_push', {}); }
  function setSwipe(p, liked) {
    var s = swipes(); s[p.id] = liked ? 1 : 0; save('rd_sw', s);
    var q = pushes();
    if (liked) { if (!q[p.id]) q[p.id] = { ts: Date.now(), st: 'try', d: {} }; } else delete q[p.id];
    save('rd_push', q); badge();
  }
  function unSwipe(p) { var s = swipes(); delete s[p.id]; save('rd_sw', s); var q = pushes(); delete q[p.id]; save('rd_push', q); badge(); }
  function badge() { var n = Object.keys(pushes()).length; document.getElementById('pushn').textContent = n ? n : ''; }

  function share(p) {
    var text = '【副业雷达】' + p.name + '：' + p.hook + '。真实情况：' + p.mid;
    var url = SITE_URL + '#/p/' + p.id;
    if (NATIVE && native({ type: 'share', text: text, url: url })) return;
    if (navigator.share) { navigator.share({ title: p.name, text: text, url: url }).catch(function () {}); return; }
    var ta = document.createElement('textarea'); ta.value = text + ' ' + url; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('已复制，可以粘贴分享'); } catch (e) { toast('复制失败'); }
    document.body.removeChild(ta);
  }

  // ---------- 刷副业 ----------
  var KSEL = load('rd_k', '');
  var DECK = [], HIST = [];
  function buildDeck() {
    var s = swipes();
    var pool = PLAYS.filter(function (p) { return !(p.id in s) && (!KSEL || p.cat === KSEL); });
    // 推荐卡和上升期靠前，警示卡穿插，避免一屏全是坑
    pool.forEach(function (p) { p._r = (p.rec ? 1.2 : 0) + (p.phase === 'up' ? 0.6 : p.phase === 'down' ? -0.4 : 0) + Math.random() * 1.4; });
    pool.sort(function (a, b) { return b._r - a._r; });
    return pool;
  }
  function cardHTML(p) {
    var cat = CATS[p.cat] || {};
    return '<div class="sw-card" style="--c:' + col(p) + '">' +
      '<div class="sw-top"><div class="chips"><span class="chip">' + cat.e + ' ' + esc(cat.n) + '</span><span class="chip ph-' + p.phase + '">' + PH[p.phase] + '</span>' + (p.rec ? '<span class="chip rec">小白推荐</span>' : '') + '</div>' +
      '<div class="big">' + p.e + '</div><h2>' + esc(p.name) + '</h2></div>' +
      '<div class="sw-body"><div class="hook">' + esc(p.hook) + '</div>' +
      '<div class="pills"><div class="pill"><small>💰 收入</small><b>' + esc(p.income) + '</b></div><div class="pill"><small>🧭 起步</small><b>' + esc(p.cost) + '</b></div><div class="pill"><small>⏱ 时间</small><b>' + esc(p.time) + '</b></div></div>' +
      '<div class="real"><em>真实中位：</em>' + esc(p.mid) + '</div>' +
      '<div class="first"><em>👣 本周第一步：</em>' + esc(p.first) + '</div>' +
      '<div class="line l3"><em>💸 真实数字：</em>' + esc(p.money) + '</div>' +
      '<div class="line l2"><em>⚠️ 最大的坑：</em>' + esc(p.risk) + '</div>' +
      '<div class="foot"><span>📎 ' + p.src.length + ' 个来源</span><span>点卡片看细节 ›</span></div></div>' +
      '<div class="stamp like">想推进</div><div class="stamp nope">跳过</div></div>';
  }
  function viewSwipe() {
    var s = swipes(); var seen = Object.keys(s).length;
    var counts = {}; PLAYS.forEach(function (p) { counts[p.cat] = (counts[p.cat] || 0) + 1; });
    if (!DECK.length) DECK = buildDeck();
    var kb = '<div class="kbar"><button data-k="" class="' + (KSEL ? '' : 'on') + '">全部 ' + PLAYS.length + '</button>' +
      Object.keys(CATS).map(function (k) { return '<button data-k="' + k + '" style="--kc:' + CATS[k].c + '" class="' + (KSEL === k ? 'on' : '') + '">' + CATS[k].e + ' ' + CATS[k].n + ' ' + (counts[k] || 0) + '</button>'; }).join('') + '</div>';
    app.innerHTML = '<div class="disc"><div class="dhead"><div><h1 class="title">刷副业</h1><div class="muted">右滑想推进，左滑跳过，点开看来源</div></div><div class="prog">已刷<br><b>' + seen + '</b> / ' + PLAYS.length + '</div></div>' + kb +
      '<div class="stack" id="stack"></div>' +
      '<div class="ctrl"><button class="rb big no" data-a="no" aria-label="跳过">✕</button><button class="rb" data-a="undo" aria-label="撤销">↺</button><button class="rb" data-a="info" aria-label="详情">ⓘ</button><button class="rb big like" data-a="yes" aria-label="想推进">♥</button></div></div>';
    var stack = $('#stack');
    var busy = false;
    function render() {
      $('[data-a=undo]').style.opacity = HIST.length ? 1 : 0.35;
      if (!DECK.length) {
        stack.innerHTML = '<div class="empty"><div style="font-size:44px">🎉</div><b>' + (KSEL ? CATS[KSEL].n + '刷完了' : '全部刷完了') + '</b><span>右滑过的都在「想推进」里</span><button class="btn" id="reset">重刷跳过的</button><a class="btn go" href="#/push">去看想推进</a></div>';
        $('#reset').onclick = function () { var s2 = swipes(); Object.keys(s2).forEach(function (k) { var p = find(k); if (!s2[k] && (!KSEL || (p && p.cat === KSEL))) delete s2[k]; }); save('rd_sw', s2); DECK = buildDeck(); viewSwipe(); };
        return;
      }
      stack.innerHTML = DECK.slice(0, 3).map(cardHTML).reverse().join('') + (seen < 2 ? '<div class="tip">← 左滑跳过 · 右滑想推进 →</div>' : '');
      var cs = [].slice.call(stack.querySelectorAll('.sw-card')).reverse();
      cs.forEach(function (c, i) { c.style.transform = 'translateY(' + i * 10 + 'px) scale(' + (1 - i * 0.04) + ')'; c.style.zIndex = 10 - i; });
      attach(cs[0]);
    }
    function commit(liked) {
      var p = DECK[0]; if (!p || busy) return; busy = true;
      var cards = stack.querySelectorAll('.sw-card'), top = cards[cards.length - 1];
      top.style.transition = 'transform .22s ease-out';
      top.style.transform = 'translate(' + (liked ? 640 : -640) + 'px,40px) rotate(' + (liked ? 24 : -24) + 'deg)';
      haptic(liked ? 'success' : 'light');
      setTimeout(function () {
        setSwipe(p, liked); HIST.push(p); if (HIST.length > 40) HIST.shift();
        DECK.shift(); busy = false; seen++;
        app.querySelector('.prog b').textContent = seen;
        render(); if (liked) toast('🚀 已加入想推进');
      }, 200);
    }
    function attach(el) {
      var sx = 0, sy = 0, dx = 0, dy = 0, down = false, moved = false;
      var lk = el.querySelector('.like'), np = el.querySelector('.nope');
      el.addEventListener('pointerdown', function (e) { down = true; moved = false; sx = e.clientX; sy = e.clientY; dx = dy = 0; try { el.setPointerCapture(e.pointerId); } catch (x) {} el.style.transition = 'none'; });
      el.addEventListener('pointermove', function (e) {
        if (!down) return; dx = e.clientX - sx; dy = e.clientY - sy; if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved = true;
        el.style.transform = 'translate(' + dx + 'px,' + dy * 0.25 + 'px) rotate(' + dx / 18 + 'deg)';
        lk.style.opacity = Math.max(0, Math.min(1, dx / 100)); np.style.opacity = Math.max(0, Math.min(1, -dx / 100));
      });
      function end() {
        if (!down) return; down = false;
        if (Math.abs(dx) > 100) { commit(dx > 0); return; }
        el.style.transition = 'transform .3s'; el.style.transform = ''; lk.style.opacity = 0; np.style.opacity = 0;
        if (!moved) openDetail(DECK[0], viewSwipe);
      }
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    }
    app.querySelector('.ctrl').onclick = function (e) {
      var b = e.target.closest('[data-a]'); if (!b) return; var a = b.getAttribute('data-a');
      if (a === 'yes') commit(true); else if (a === 'no') commit(false);
      else if (a === 'info' && DECK[0]) openDetail(DECK[0], viewSwipe);
      else if (a === 'undo') { var p = HIST.pop(); if (p) { unSwipe(p); DECK.unshift(p); seen--; app.querySelector('.prog b').textContent = seen; render(); } }
    };
    app.querySelector('.kbar').onclick = function (e) {
      var b = e.target.closest('[data-k]'); if (!b) return;
      KSEL = b.getAttribute('data-k'); save('rd_k', KSEL); DECK = buildDeck(); viewSwipe();
    };
    render();
  }

  // ---------- 详情 ----------
  function openDetail(p, onChange) {
    if (!p) return;
    var el = document.createElement('div'); el.className = 'sheet';
    function render() {
      var inPush = !!pushes()[p.id];
      var cat = CATS[p.cat] || {};
      el.innerHTML = '<div class="dsheet" style="--c:' + col(p) + '"><div class="dhero"><div class="grab"></div><button class="x" data-x="close">✕</button>' +
        '<div class="chips"><span class="chip">' + cat.e + ' ' + esc(cat.n) + '</span><span class="chip ph-' + p.phase + '">' + PH[p.phase] + '</span>' + (p.rec ? '<span class="chip rec">小白推荐</span>' : '') + '</div>' +
        '<h2>' + p.e + ' ' + esc(p.name) + '</h2><div style="opacity:.92;font-size:14px">' + esc(p.hook) + '</div></div>' +
        sec('怎么赚钱', p.how) + sec('真实数字', p.money) + sec('真实中位', p.mid) + sec('坑和风险', p.risk) +
        sec('起步成本 · 时间', p.cost + ' · ' + p.time) +
        '<div class="sec"><h3>推进清单</h3><ol class="steps">' + p.push.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol></div>' +
        '<div class="sec"><h3>来源（点开在浏览器里看原文）</h3>' + p.src.map(function (s) {
          return '<a class="src" href="' + esc(s.u) + '" target="_blank" rel="noopener"><span class="k k-' + esc(s.k) + '">' + esc(s.k) + '</span>' + esc(s.t) + '<small>' + esc(s.d) + ' · ' + esc(s.u.replace(/^https?:\/\//, '').slice(0, 46)) + '…</small></a>';
        }).join('') + '<p class="muted" style="margin-top:8px">标“软文”“自述”的数字只作上限参考；收入不构成承诺。</p></div>' +
        '<div class="btns"><button class="btn ' + (inPush ? '' : 'go') + '" data-x="push">' + (inPush ? '✓ 已在想推进（点击移除）' : '🚀 加入想推进') + '</button>' +
        (p.calc ? '<button class="btn" data-x="calc">🧮 算一算</button>' : '') +
        (p.report ? '<a class="btn" href="reports/' + p.report + '" target="_self">📄 相关报告</a>' : '') +
        '<button class="btn" data-x="share">分享</button></div></div>';
    }
    function sec(h, t) { return '<div class="sec"><h3>' + h + '</h3><p>' + esc(t) + '</p></div>'; }
    render();
    el.addEventListener('click', function (e) {
      var x = e.target.closest('[data-x]');
      if (x) {
        var a = x.getAttribute('data-x');
        if (a === 'close') { el.remove(); return; }
        if (a === 'push') {
          var inPush = !!pushes()[p.id]; setSwipe(p, !inPush); haptic(inPush ? 'light' : 'success');
          toast(inPush ? '已移出想推进' : '🚀 已加入想推进');
          DECK = DECK.filter(function (q) { return q.id !== p.id; });
          render(); if (onChange) onChange(); return;
        }
        if (a === 'calc') { el.remove(); location.hash = '#/calc/' + p.id; return; }
        if (a === 'share') { share(p); return; }
      }
      if (e.target === el) { el.remove(); if (onChange) onChange(); }
    });
    document.body.appendChild(el);
  }

  // ---------- 想推进 ----------
  var PSEG = 'active';
  function viewPush() {
    var q = pushes();
    var ids = Object.keys(q).sort(function (a, b) { return q[b].ts - q[a].ts; });
    var list = ids.map(function (id) { return { p: find(id), r: q[id] }; }).filter(function (x) { return x.p; });
    var act = list.filter(function (x) { return x.r.st !== 'pause'; });
    var shown = PSEG === 'active' ? act : list.filter(function (x) { return x.r.st === 'pause'; });
    var h = '<div class="wrap"><h1 class="title">想推进 <span class="muted">' + list.length + '</span></h1>';
    if (act.length > 3) h += '<div class="warnbox">已经有 ' + act.length + ' 个在推进。下班时间有限，建议只留 1–2 个，其余点「先放放」。</div>';
    var warnIn = act.filter(function (x) { return x.p.cat === 'warn'; });
    if (warnIn.length) h += '<div class="warnbox">⚠️ 你右滑了 ' + warnIn.map(function (x) { return '「' + esc(x.p.name) + '」'; }).join('') + '，它们在避坑清单里，建议别推进。</div>';
    h += '<div class="seg"><button data-seg="active" class="' + (PSEG === 'active' ? 'on' : '') + '">推进中 ' + act.length + '</button><button data-seg="pause" class="' + (PSEG === 'pause' ? 'on' : '') + '">先放放 ' + (list.length - act.length) + '</button></div>';
    if (!shown.length) h += '<div class="card" style="text-align:center;color:var(--sub)">' + (list.length ? '这里空空的' : '还没有想推进的。<br>去「刷副业」右滑几张吧') + '<div class="btns" style="justify-content:center"><a class="btn go" href="#/">去刷副业</a></div></div>';
    shown.forEach(function (x) {
      var p = x.p, r = x.r, done = 0;
      p.push.forEach(function (s, i) { if (r.d[i]) done++; });
      var pct = Math.round(done / p.push.length * 100);
      h += '<div class="card" style="--c:' + col(p) + '"><div class="prow" data-open="' + p.id + '"><div class="pic">' + p.e + '</div><div class="pt"><b>' + esc(p.name) + '</b><small>' + ST[r.st] + ' · ' + done + '/' + p.push.length + ' 步 · ' + esc(p.income) + '</small><div class="bar"><i style="width:' + pct + '%"></i></div></div></div>';
      p.push.forEach(function (s, i) {
        h += '<label class="chk' + (r.d[i] ? ' done' : '') + '"><input type="checkbox" data-step="' + p.id + ':' + i + '"' + (r.d[i] ? ' checked' : '') + '><span>' + esc(s) + '</span></label>';
      });
      h += '<div class="row-between" style="margin-top:8px"><div>' + Object.keys(ST).map(function (k) { return '<button class="mini" data-st="' + p.id + ':' + k + '" style="' + (r.st === k ? 'background:var(--ink);color:var(--card);border-color:var(--ink)' : '') + '">' + ST[k] + '</button> '; }).join('') + '</div>' +
        '<span>' + (p.calc ? '<button class="mini" data-calc="' + p.id + '">算一算</button> ' : '') + '<button class="mini" data-rm="' + p.id + '">移除</button></span></div></div>';
    });
    if (list.length) h += '<div class="btns" style="padding:4px 0"><button class="btn" id="sharelist">分享我的清单</button></div>';
    h += '</div>';
    app.innerHTML = h;
    app.onclick = function (e) {
      var t = e.target;
      var seg = t.closest('[data-seg]'); if (seg) { PSEG = seg.getAttribute('data-seg'); viewPush(); return; }
      var st = t.closest('[data-st]'); if (st) { var a = st.getAttribute('data-st').split(':'); var q2 = pushes(); q2[a[0]].st = a[1]; save('rd_push', q2); haptic(); viewPush(); return; }
      var rm = t.closest('[data-rm]'); if (rm) { var p = find(rm.getAttribute('data-rm')); unSwipe(p); toast('已移除'); viewPush(); return; }
      var c = t.closest('[data-calc]'); if (c) { location.hash = '#/calc/' + c.getAttribute('data-calc'); return; }
      var o = t.closest('[data-open]'); if (o) { openDetail(find(o.getAttribute('data-open')), viewPush); return; }
      if (t.id === 'sharelist') {
        var txt = '我的副业推进清单\n' + list.map(function (x) { var d = 0; x.p.push.forEach(function (s, i) { if (x.r.d[i]) d++; }); return '· ' + x.p.name + '（' + ST[x.r.st] + ' ' + d + '/' + x.p.push.length + '）'; }).join('\n');
        if (NATIVE && native({ type: 'share', text: txt })) return;
        if (navigator.share) navigator.share({ text: txt }).catch(function () {}); else toast('当前浏览器不支持分享');
      }
    };
    app.onchange = function (e) {
      var k = e.target.getAttribute('data-step'); if (!k) return;
      var a = k.split(':'); var q2 = pushes(); var r = q2[a[0]];
      if (e.target.checked) { r.d[a[1]] = 1; if (r.st === 'try') r.st = 'doing'; haptic('success'); } else delete r.d[a[1]];
      save('rd_push', q2); viewPush();
    };
  }

  // ---------- 算一算 ----------
  var FIELDS = [['price', '每单收入（元）'], ['orders', '每月单数'], ['unitCost', '每单成本（元）'], ['fixed', '每月固定成本（元）'], ['fee', '平台抽成（%）'], ['minutes', '每单耗时（分钟）'], ['tax', '边际税率（%，并入工资）'], ['base', '主业时薪参考（元/小时）']];
  function viewCalc(id) {
    var v = load('rd_calc', { price: 200, orders: 10, unitCost: 20, fixed: 100, fee: 1.6, minutes: 60, tax: 30, base: 150 });
    var p = id ? find(id) : null;
    if (p && p.calc) for (var k in p.calc) v[k] = p.calc[k];
    var h = '<div class="wrap"><h1 class="title">算一算</h1><div class="muted">只做到中位数，值不值？</div><div class="card calc">';
    h += '<label>套用玩法预设<select id="preset"><option value="">自定义</option>' + PLAYS.filter(function (q) { return q.calc; }).map(function (q) { return '<option value="' + q.id + '"' + (p && p.id === q.id ? ' selected' : '') + '>' + q.e + ' ' + esc(q.name) + '</option>'; }).join('') + '</select></label><div class="grid2">';
    FIELDS.forEach(function (f) { h += '<label>' + f[1] + '<input type="number" inputmode="decimal" step="any" data-k="' + f[0] + '" value="' + esc(v[f[0]]) + '"></label>'; });
    h += '</div><div id="res" class="result"></div></div><div class="note">按劳务报酬粗算：应税额 = 税前利润 × 80% × 边际税率。预设是中位偏乐观的估计，按你自己的真实数据改。</div></div>';
    app.innerHTML = h;
    app.oninput = function (e) { if (e.target.getAttribute('data-k')) compute(); };
    app.onchange = function (e) { if (e.target.id === 'preset') location.hash = e.target.value ? '#/calc/' + e.target.value : '#/calc'; };
    app.onclick = null;
    compute();
  }
  function compute() {
    var res = document.getElementById('res'); if (!res) return;
    var v = {}; [].forEach.call(app.querySelectorAll('input[data-k]'), function (i) { v[i.getAttribute('data-k')] = parseFloat(i.value) || 0; });
    save('rd_calc', v);
    var gross = v.price * v.orders, fee = gross * v.fee / 100, cost = v.unitCost * v.orders + v.fixed;
    var pre = gross - fee - cost, tax = pre > 0 ? pre * 0.8 * v.tax / 100 : 0, net = pre - tax;
    var hours = v.minutes * v.orders / 60, hourly = hours > 0 ? net / hours : 0;
    var verdict = net <= 0 ? '亏钱，或者只是在帮平台打工。先换价格或方向。' :
      hourly >= v.base ? '时薪不低于主业，值得认真做。' :
      hourly >= v.base * 0.4 ? '时薪约为主业的 ' + Math.round(hourly / v.base * 100) + '%，能接受就当积累案例和能力。' :
      '时薪只有主业的 ' + Math.max(0, Math.round(hourly / v.base * 100)) + '%，除非能快速涨价或产品化，否则不划算。';
    res.innerHTML = '<div class="muted">每月到手（税后）</div><div class="big ' + (net >= 0 ? 'pos' : 'neg') + '">¥' + fmt(net) + '</div>' +
      '<div class="muted">流水 ¥' + fmt(gross) + ' − 平台 ¥' + fmt(fee) + ' − 成本 ¥' + fmt(cost) + ' − 税 ¥' + fmt(tax) + '</div>' +
      '<div style="margin-top:6px">投入约 ' + Math.round(hours * 10) / 10 + ' 小时/月，折合时薪 <b>¥' + fmt(hourly) + '</b></div><div style="margin-top:6px">' + verdict + '</div>';
  }

  // ---------- 更多 ----------
  function viewMore() {
    var recs = PLAYS.filter(function (p) { return p.rec; });
    var h = '<div class="wrap"><h1 class="title">更多</h1><div class="muted">数据更新于 ' + window.RADAR_UPDATED + ' · 共 ' + PLAYS.length + ' 张卡</div>';
    h += '<div class="card"><b>🧭 小白的判断</b><div class="muted" style="margin:4px 0 6px">给在职程序员：合规、能下班做、能攒成资产</div>';
    [['lora', '图像生成技能直接变现，和多数文本类本职重叠少'], ['aiphoto', '客单低但起量快，可当练手和现金流'], ['column', '最能攒个人品牌，后面接讲师、写书、企业单'], ['ugc', '不用粉丝、不用露脸，海外按条收钱'], ['contest', '最干净，奖金加简历']].forEach(function (x, i) {
      var p = find(x[0]); if (!p) return;
      h += '<div class="pick" data-open="' + p.id + '"><span class="n">' + (i + 1) + '</span><div><b>' + p.e + ' ' + esc(p.name) + '</b><div class="muted">' + x[1] + '</div></div></div>';
    });
    h += '<div class="muted" style="margin-top:6px">生活服务类（陪诊、喂宠、上门做饭）需求真实，但单价按小时、靠体力，适合想换换脑子的人。</div></div>';
    var done = load('rd_plan', {}), total = 0, ok = 0;
    PLAN.forEach(function (w, wi) { w.items.forEach(function (it, ii) { total++; if (done[wi + '-' + ii]) ok++; }); });
    h += '<div class="card"><div class="row-between"><b>🗓 90 天试水计划</b><span class="muted">' + ok + '/' + total + '</span></div><div class="bar"><i style="width:' + Math.round(ok / total * 100) + '%"></i></div>';
    PLAN.forEach(function (w, wi) {
      h += '<div style="margin-top:10px;font-weight:650;font-size:14px">' + esc(w.w) + '</div>';
      w.items.forEach(function (it, ii) { var k = wi + '-' + ii; h += '<label class="chk' + (done[k] ? ' done' : '') + '"><input type="checkbox" data-plan="' + k + '"' + (done[k] ? ' checked' : '') + '><span>' + esc(it) + '</span></label>'; });
    });
    h += '</div>';
    h += '<div class="card"><div class="row-between"><b>🔔 每周复盘提醒</b>' + (NATIVE ? '<label class="switch"><input type="checkbox" id="remind"' + (load('rd_remind', false) ? ' checked' : '') + '><span></span></label>' : '') + '</div><div class="muted">' + (NATIVE ? '每周日 20:00 推送一条本地通知：勾推进清单、算真实时薪。' : '装原生 App 后可开启；网页版请自己定个闹钟。') + '</div></div>';
    h += '<div class="card"><b>📝 我的笔记</b><div class="muted">只保存在这台手机上</div><textarea id="note" placeholder="方向、报价、客户反馈…">' + esc(load('rd_note', '')) + '</textarea></div>';
    h += '<div class="card"><b>📄 完整调研报告</b>' + REPORTS.map(function (r) { return '<a class="src" href="reports/' + r.file + '" target="_self">' + esc(r.title) + '<small>' + esc(r.desc) + '</small></a>'; }).join('') + '</div>';
    h += '<div class="card"><b>🗂 全部卡片</b><div class="grid-cards" style="margin-top:8px">' + PLAYS.map(function (p) { var s = swipes()[p.id]; return '<div class="gc" style="--c:' + col(p) + '" data-open="' + p.id + '"><span class="e">' + p.e + '</span><b>' + esc(p.name) + '</b><small>' + PH[p.phase] + (s === 1 ? ' · 🚀' : s === 0 ? ' · 已跳过' : '') + '</small></div>'; }).join('') + '</div></div>';
    if (!standalone()) h += '<div class="card"><b>📲 装到手机桌面</b>' + (deferredPrompt ? '<div class="btns" style="padding:8px 0 0"><button class="btn go" id="install">一键安装</button></div>' : '<div class="muted" style="margin-top:4px">iPhone：Safari 底部“分享”→“添加到主屏幕”；安卓：浏览器菜单 →“安装应用 / 添加到主屏幕”。</div>') + '</div>';
    h += '<div class="btns" style="padding:4px 0 10px"><button class="btn" id="resetall">清空刷卡记录</button></div></div>';
    app.innerHTML = h;
    app.onclick = function (e) {
      var o = e.target.closest('[data-open]'); if (o) { openDetail(find(o.getAttribute('data-open')), viewMore); return; }
      if (e.target.id === 'install' && deferredPrompt) { deferredPrompt.prompt(); deferredPrompt.userChoice.then(function () { deferredPrompt = null; viewMore(); }); return; }
      if (e.target.id === 'resetall' && confirm('清空刷卡记录和想推进清单？')) { save('rd_sw', {}); save('rd_push', {}); DECK = []; badge(); toast('已清空'); viewMore(); }
    };
    app.onchange = function (e) {
      var t = e.target;
      if (t.id === 'remind') { save('rd_remind', t.checked); native({ type: 'reminder', on: t.checked, weekday: 1, hour: 20 }); return; }
      var k = t.getAttribute('data-plan'); if (k) { var d = load('rd_plan', {}); if (t.checked) { d[k] = 1; haptic('success'); } else delete d[k]; save('rd_plan', d); viewMore(); }
    };
    app.oninput = function (e) { if (e.target.id === 'note') save('rd_note', e.target.value); };
  }

  // ---------- 路由 ----------
  function route() {
    var parts = (location.hash || '#/').replace(/^#\/?/, '').split('/');
    var tab = 'swipe';
    app.onclick = app.onchange = app.oninput = null;
    document.querySelectorAll('.sheet').forEach(function (s) { s.remove(); });
    if (parts[0] === 'push') { tab = 'push'; viewPush(); }
    else if (parts[0] === 'calc') { tab = 'calc'; viewCalc(parts[1]); }
    else if (parts[0] === 'more') { tab = 'more'; viewMore(); }
    else { viewSwipe(); if (parts[0] === 'p' && parts[1]) openDetail(find(parts[1])); }
    [].forEach.call(document.querySelectorAll('.tabs a'), function (a) { a.className = a.getAttribute('data-tab') === tab ? 'on' : ''; });
    window.scrollTo(0, 0);
  }

  window.onNativeReminder = function (on, msg, silent) {
    save('rd_remind', !!on); var el = document.getElementById('remind'); if (el) el.checked = !!on;
    if (silent) return; toast(msg ? msg : (on ? '已开启：每周日 20:00 提醒' : '已关闭提醒'));
  };
  if (NATIVE) { document.documentElement.className += ' native'; native({ type: 'reminderStatus' }); }

  // 旧版收藏迁移到想推进
  (function migrate() {
    var old = load('fr_fav', null); if (!old || load('rd_migrated', 0)) return;
    var q = pushes(), s = swipes();
    old.forEach(function (id) { if (find(id)) { q[id] = q[id] || { ts: Date.now(), st: 'try', d: {} }; s[id] = 1; } });
    save('rd_push', q); save('rd_sw', s); save('rd_migrated', 1);
  })();

  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredPrompt = e; });
  window.addEventListener('hashchange', route);
  badge(); route();
  if (!NATIVE && 'serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js'); });
  }
})();
