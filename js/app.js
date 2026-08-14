/* ==========================================================
 * 文言文连连看 · 主逻辑
 * 页面流：启动 → 题库 → 关卡 → 游戏 → 结算 →（关卡/题库）
 * 核心：限时连连看配对、连线动画、即时反馈、进度与成就
 * ========================================================== */
(function () {
  "use strict";

  /* ---------- 工具 ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function getBank() {
    return QUESTION_BANKS.find(function (b) { return b.id === state.bankId; });
  }

  function levelId(bankId, idx) {
    var bank = QUESTION_BANKS.find(function (b) { return b.id === bankId; });
    return bankId + "-" + bank.levels[idx].id;
  }

  /* ---------- 全局状态 ---------- */
  var state = {
    screen: "start",
    bankId: null,
    levelIdx: 0,
    left: [],
    right: [],
    total: 0,
    matched: 0,
    attempts: 0,
    mistakes: 0,
    timeLimit: 0,
    timeLeft: 0,
    timerId: null,
    selected: null,
    locked: false,
    countingDown: false,
    finished: false,
    line: null
  };

  /* ---------- 页面切换 ---------- */
  var SCREENS = ["start", "banks", "levels", "game", "results"];

  function showScreen(name) {
    SCREENS.forEach(function (s) {
      $("#screen-" + s).classList.toggle("active", s === name);
    });
    state.screen = name;
    if (name === "start") renderStart();
    if (name === "banks") renderBanks();
    if (name === "levels") renderLevels();
    if (name === "game") requestAnimationFrame(sizeLineLayer);
    window.scrollTo(0, 0);
  }

  /* ---------- 启动页 ---------- */
  function renderStart() {
    var total = 0, done = 0;
    QUESTION_BANKS.forEach(function (b) {
      total += b.levels.length;
      b.levels.forEach(function (lv, i) {
        var rec = Store.getLevel(levelId(b.id, i));
        if (rec && rec.stars > 0) done++;
      });
    });
    var ach = Object.keys(Store.achievements).length;
    $("#start-progress").textContent =
      "已通关 " + done + "/" + total + " 关 · 成就 " + ach + "/" + ACHIEVEMENTS.length;
  }

  /* ---------- 题库页 ---------- */
  function bankProgress(bank) {
    var done = 0, stars = 0;
    bank.levels.forEach(function (lv, i) {
      var rec = Store.getLevel(levelId(bank.id, i));
      if (rec && rec.stars > 0) { done++; stars += rec.stars; }
    });
    return { done: done, total: bank.levels.length, stars: stars };
  }

  function renderBanks() {
    var wrap = $("#banks-list");
    wrap.innerHTML = QUESTION_BANKS.map(function (bank) {
      var p = bankProgress(bank);
      var pct = Math.round(p.done / p.total * 100);
      var stars = "";
      for (var i = 0; i < 5; i++) {
        stars += '<span class="' + (i < p.stars ? "" : "dim") + '">★</span>';
      }
      return (
        '<button class="bank-card" data-bank="' + bank.id + '" type="button">' +
          '<div class="bank-icon">' + bank.icon + '</div>' +
          '<div class="bank-body">' +
            '<h3 class="bank-name">' + bank.name + '</h3>' +
            '<p class="bank-desc">' + bank.desc + '</p>' +
            '<div class="bank-meta">' +
              '<span class="bank-progress-text">已完成 ' + p.done + '/' + p.total + ' 关</span>' +
              '<span class="bank-stars">' + stars + '</span>' +
            '</div>' +
            '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
          '</div>' +
        '</button>'
      );
    }).join("");
    $$(".bank-card", wrap).forEach(function (el) {
      el.addEventListener("click", function () {
        SFX.click();
        openBank(el.dataset.bank);
      });
    });
  }

  function openBank(bankId) {
    state.bankId = bankId;
    state.levelIdx = 0;
    showScreen("levels");
  }

  /* ---------- 关卡页 ---------- */
  function starsRow(n) {
    var s = "";
    for (var i = 1; i <= 3; i++) {
      s += '<span class="' + (i <= n ? "" : "off") + '">★</span>';
    }
    return '<span class="level-stars">' + s + '</span>';
  }

  function renderLevels() {
    var bank = getBank();
    $("#levels-title").textContent = bank.name;
    var wrap = $("#levels-list");
    wrap.innerHTML = bank.levels.map(function (lv, i) {
      var rec = Store.getLevel(levelId(bank.id, i));
      var prev = i > 0 ? Store.getLevel(levelId(bank.id, i - 1)) : null;
      var unlocked = i === 0 || (prev && prev.stars > 0);
      var cls = "", sub = "", right;
      if (!unlocked) {
        cls = "locked";
        sub = "通关上一关后解锁";
        right = '<span class="level-stars">鎖</span>';
      } else if (rec && rec.stars > 0) {
        cls = "done";
        sub = "正确率 " + rec.accuracy + "% · 最佳 " + rec.time + "s";
        right = starsRow(rec.stars);
      } else {
        sub = "限时 " + (lv.pairs.length * 10) + " 秒 · " + lv.pairs.length + " 对配对";
        right = starsRow(0);
      }
      return (
        '<button class="level-card ' + cls + '" data-idx="' + i + '"' +
        (unlocked ? "" : ' disabled') + ' type="button">' +
          '<div class="level-num">' + (i + 1) + '</div>' +
          '<div class="level-info">' +
            '<div class="level-name">' + lv.name + '</div>' +
            '<div class="level-sub">' + sub + '</div>' +
          '</div>' +
          right +
        '</button>'
      );
    }).join("");
    $$(".level-card:not(.locked)", wrap).forEach(function (el) {
      el.addEventListener("click", function () {
        SFX.click();
        startLevel(Number(el.dataset.idx));
      });
    });
  }

  /* ---------- 游戏 ---------- */
  function startLevel(idx) {
    var bank = getBank();
    var lv = bank.levels[idx];
    state.levelIdx = idx;
    var pairs = lv.pairs.map(function (p, i) {
      return { id: i, w: p[0], m: p[1] };
    });
    state.total = pairs.length;
    state.left = shuffle(pairs);
    state.right = shuffle(pairs);
    state.matched = 0;
    state.attempts = 0;
    state.mistakes = 0;
    state.timeLimit = pairs.length * 10;
    state.timeLeft = state.timeLimit;
    state.selected = null;
    state.locked = false;
    state.countingDown = false;
    state.finished = false;
    state.line = null;
    $("#line-layer").innerHTML = "";

    $("#game-title").textContent = bank.name + " · 第" + (idx + 1) + "关 " + lv.name;
    renderCards();
    updateTimer();
    $("#pairs-left").textContent = "剩余 " + state.total + " 对未配对";
    showScreen("game");
    runCountdown();
  }

  function renderCards() {
    var L = $("#col-left"), R = $("#col-right");
    L.innerHTML = state.left.map(function (p) { return cardHTML(p, "left"); }).join("");
    R.innerHTML = state.right.map(function (p) { return cardHTML(p, "right"); }).join("");
    $$(".card", L).forEach(function (el) { el.addEventListener("click", function () { onCardClick(el); }); });
    $$(".card", R).forEach(function (el) { el.addEventListener("click", function () { onCardClick(el); }); });
  }

  function cardHTML(p, col) {
    return (
      '<button class="card c-' + col + '" data-id="' + p.id + '" type="button">' +
        '<span class="card-txt">' + (col === "left" ? p.w : p.m) + '</span>' +
      '</button>'
    );
  }

  function onCardClick(el) {
    if (state.finished || state.locked || state.countingDown) return;
    if (el.dataset.done || el.classList.contains("matched")) return;

    var id = Number(el.dataset.id);
    var col = el.classList.contains("c-left") ? "left" : "right";
    SFX.select();

    if (!state.selected) {
      state.selected = { el: el, id: id, col: col };
      el.classList.add("selected");
      return;
    }
    var s = state.selected;
    if (s.el === el) {                 /* 再次点击：取消选中 */
      el.classList.remove("selected");
      state.selected = null;
      return;
    }
    if (s.col === col) {               /* 同侧点击：切换选中 */
      s.el.classList.remove("selected");
      state.selected = { el: el, id: id, col: col };
      el.classList.add("selected");
      return;
    }

    /* 异侧点击：尝试配对 */
    state.attempts++;
    state.locked = true;
    drawLine(s.el, el);

    setTimeout(function () {
      if (s.id === id) {
        /* 配对成功 */
        SFX.correct();
        el.classList.add("done", "correct");
        s.el.classList.add("done", "correct");
        s.el.classList.remove("selected");
        toast("配对成功", "ok");
        state.matched++;
        $("#pairs-left").textContent = "剩余 " + (state.total - state.matched) + " 对未配对";
        setTimeout(function () {
          el.classList.remove("correct");
          s.el.classList.remove("correct");
          el.classList.add("matched");
          s.el.classList.add("matched");
        }, 380);
        if (state.matched === state.total) {
          finishLevel(true);
          return;
        }
      } else {
        /* 配对错误 */
        SFX.wrong();
        state.mistakes++;
        el.classList.add("wrong");
        s.el.classList.add("wrong");
        s.el.classList.remove("selected");
        toast("配对错误，再想想", "bad");
        setTimeout(function () {
          el.classList.remove("wrong");
          s.el.classList.remove("wrong");
        }, 520);
      }
      state.selected = null;
      clearLine(s.id === id);
      state.locked = false;
    }, 300);
  }

  /* ---------- 连线动画（SVG） ---------- */
  function sizeLineLayer() {
    var area = $("#game-area");
    var svg = $("#line-layer");
    var w = area.clientWidth, h = area.clientHeight;
    svg.setAttribute("width", w);
    svg.setAttribute("height", h);
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
  }

  function drawLine(aEl, bEl) {
    var area = $("#game-area");
    var ar = area.getBoundingClientRect();
    var a = aEl.getBoundingClientRect();
    var b = bEl.getBoundingClientRect();
    var x1 = a.left + a.width / 2 - ar.left;
    var y1 = a.top + a.height / 2 - ar.top;
    var x2 = b.left + b.width / 2 - ar.left;
    var y2 = b.top + b.height / 2 - ar.top;

    var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute("pathLength", "1");
    line.style.strokeDasharray = "1";
    line.style.strokeDashoffset = "1";
    $("#line-layer").appendChild(line);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        line.style.strokeDashoffset = "0";   /* 触发描边动画 */
      });
    });
    state.line = line;
  }

  function clearLine(good) {
    var line = state.line;
    if (!line) return;
    state.line = null;
    line.classList.add(good ? "ok" : "bad");
    line.style.transition = "opacity .35s ease";
    line.style.opacity = "0";
    setTimeout(function () { line.remove(); }, 380);
  }

  /* ---------- 倒计时与限时 ---------- */
  function runCountdown() {
    state.countingDown = true;
    var ov = $("#countdown");
    var num = $("#countdown-num");
    var seq = ["三", "二", "一", "開始！"];
    ov.classList.add("show");
    var i = 0;

    function step() {
      if (i >= seq.length) {
        setTimeout(function () {
          ov.classList.remove("show");
          state.countingDown = false;
          startTimer();
        }, 420);
        return;
      }
      num.textContent = seq[i];
      num.style.animation = "none";          /* 重新触发缩放动画 */
      void num.offsetWidth;
      num.style.animation = "";
      if (i === seq.length - 1) { SFX.correct(); } else { SFX.tick(); }
      i++;
      setTimeout(step, i === seq.length ? 850 : 700);
    }
    step();
  }

  function startTimer() {
    state.timerId = setInterval(function () {
      state.timeLeft--;
      updateTimer();
      if (state.timeLeft <= 5) SFX.tick();
      if (state.timeLeft <= 0) {
        clearInterval(state.timerId);
        state.timerId = null;
        finishLevel(false);
      }
    }, 1000);
  }

  function updateTimer() {
    var el = $("#game-timer");
    el.textContent = "限時 " + Math.max(0, state.timeLeft) + "s";
    el.classList.toggle("low", state.timeLeft <= 5 && !state.finished);
  }

  /* ---------- 结算 ---------- */
  function finishLevel(won) {
    if (state.finished) return;
    state.finished = true;
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
    $("#line-layer").innerHTML = "";
    state.line = null;

    var bank = getBank();
    var id = levelId(bank.id, state.levelIdx);
    var used = state.timeLimit - Math.max(0, state.timeLeft);
    var remaining = Math.max(0, state.timeLeft);
    var accuracy = state.attempts ? Math.round(state.matched / state.attempts * 100) : 0;

    var stars = 0;
    if (won) {
      stars = state.mistakes === 0 ? 3 : (state.mistakes <= 2 ? 2 : 1);
      SFX.win();
    } else {
      SFX.lose();
    }
    Store.recordLevel(id, { stars: stars, accuracy: accuracy, time: used, remaining: remaining });

    var unlocked = checkAchievements(won, stars);
    renderResults({
      won: won,
      stars: stars,
      accuracy: accuracy,
      used: used,
      remaining: remaining,
      mistakes: state.mistakes,
      unlocked: unlocked
    });
    if (won) confetti();
    showScreen("results");
  }

  function checkAchievements(won, stars) {
    var newOnes = [];
    function unlock(aid) {
      if (Store.unlockAchievement(aid)) {
        newOnes.push(ACHIEVEMENTS.find(function (a) { return a.id === aid; }));
        SFX.achievement();
      }
    }
    if (stars > 0) unlock("first");

    var bank = getBank();
    var bankDone = bank.levels.every(function (lv, i) {
      var r = Store.getLevel(levelId(bank.id, i));
      return r && r.stars > 0;
    });
    if (bankDone) unlock("bank");

    var allDone = QUESTION_BANKS.every(function (b) {
      return b.levels.every(function (lv, i) {
        var r = Store.getLevel(levelId(b.id, i));
        return r && r.stars > 0;
      });
    });
    if (allDone) unlock("all");

    if (won && state.mistakes === 0) unlock("flawless");
    if (won && state.timeLeft > state.timeLimit / 2) unlock("speed");
    return newOnes;
  }

  function renderResults(r) {
    var title = $("#results-title");
    title.textContent = r.won ? "通关！" : "时间到…";
    title.classList.toggle("lose", !r.won);

    var stars = "";
    for (var i = 1; i <= 3; i++) {
      stars += '<span class="' + (i <= r.stars ? "" : "off") + '">★</span>';
    }
    $("#results-stars").innerHTML = stars;

    $("#results-stats").innerHTML =
      '<div class="stat"><b>' + r.accuracy + '%</b><span>正确率</span></div>' +
      '<div class="stat"><b>' + r.used + 's</b><span>用时</span></div>' +
      '<div class="stat"><b>' + (r.won ? r.remaining + "s" : "—") + '</b><span>剩余时间</span></div>';

    var box = $("#results-ach");
    if (r.unlocked.length) {
      box.innerHTML = "<h4>✦ 新成就解锁 ✦</h4>" + r.unlocked.map(function (a) {
        return '<span class="ach-chip"><i class="ach-chip-icon">' + a.icon + '</i>' + a.name + '</span>';
      }).join("");
    } else {
      box.innerHTML = '<h4 class="ach-empty">本关暂未解锁新成就，再接再厉</h4>';
    }

    var next = $("#btn-next");
    var hasNext = r.won && state.levelIdx + 1 < getBank().levels.length;
    next.classList.toggle("hidden", !hasNext);
    if (hasNext) next.dataset.idx = state.levelIdx + 1;
  }

  /* ---------- 成就弹窗 ---------- */
  function renderAchievements() {
    $("#ach-list").innerHTML = ACHIEVEMENTS.map(function (a) {
      var t = Store.achievements[a.id];
      var locked = !t;
      var date = t
        ? new Date(t).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })
        : "";
      return (
        '<div class="ach-item ' + (locked ? "locked" : "") + '">' +
          '<div class="ach-icon">' + (locked ? "?" : a.icon) + '</div>' +
          '<div class="ach-info">' +
            '<div class="ach-name">' + a.name + '</div>' +
            '<div class="ach-desc">' + a.desc + '</div>' +
          '</div>' +
          (t ? '<span class="ach-date">' + date + '</span>' : "") +
        '</div>'
      );
    }).join("");
  }

  function openAchModal() {
    renderAchievements();
    $("#ach-modal").classList.add("show");
  }
  function closeAchModal() {
    $("#ach-modal").classList.remove("show");
  }

  /* ---------- 即时反馈 ---------- */
  function toast(msg, kind) {
    var t = $("#toast");
    t.textContent = msg;
    t.className = "toast show " + kind;
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove("show"); }, 1200);
  }

  function confetti() {
    var colors = ["#b23a2e", "#c9a227", "#3e7c5b", "#32291f", "#d9b45b"];
    for (var i = 0; i < 26; i++) {
      var p = document.createElement("i");
      p.className = "confetti";
      p.style.left = Math.random() * 100 + "vw";
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * 0.5) + "s";
      p.style.animationDuration = (1.6 + Math.random() * 1.2) + "s";
      document.body.appendChild(p);
      setTimeout(function (el) { el.remove(); }, 3600, p);
    }
  }

  function stopTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  /* ---------- 事件绑定 ---------- */
  function bindEvents() {
    $("#btn-start").addEventListener("click", function () {
      SFX.unlock();
      SFX.click();
      showScreen("banks");
    });
    $("#btn-achievements-start").addEventListener("click", function () { SFX.click(); openAchModal(); });
    $("#btn-achievements").addEventListener("click", function () { SFX.click(); openAchModal(); });
    $("#btn-ach-close").addEventListener("click", function () { SFX.click(); closeAchModal(); });
    $("#ach-modal").addEventListener("click", function (e) {
      if (e.target === $("#ach-modal")) closeAchModal();
    });

    $$("[data-nav]").forEach(function (b) {
      b.addEventListener("click", function () {
        SFX.click();
        stopTimer();
        showScreen(b.dataset.nav);
      });
    });

    $("#btn-exit").addEventListener("click", function () {
      SFX.click();
      stopTimer();
      showScreen("levels");
    });

    $("#btn-retry").addEventListener("click", function () {
      SFX.click();
      startLevel(state.levelIdx);
    });
    $("#btn-next").addEventListener("click", function () {
      SFX.click();
      startLevel(Number($("#btn-next").dataset.idx));
    });
    $("#btn-to-levels").addEventListener("click", function () {
      SFX.click();
      showScreen("levels");
    });
    $("#btn-to-banks").addEventListener("click", function () {
      SFX.click();
      showScreen("banks");
    });

    var soundBtn = $("#sound-toggle");
    soundBtn.addEventListener("click", function () {
      SFX.unlock();
      SFX.setEnabled(!SFX.isEnabled());
      Store.setSound(SFX.isEnabled());
      soundBtn.classList.toggle("off", !SFX.isEnabled());
      soundBtn.setAttribute("aria-label", SFX.isEnabled() ? "关闭音效" : "开启音效");
      if (SFX.isEnabled()) SFX.click();
    });
    SFX.setEnabled(Store.sound);
    soundBtn.classList.toggle("off", !Store.sound);
    soundBtn.setAttribute("aria-label", Store.sound ? "关闭音效" : "开启音效");

    /* 首次用户手势后解锁音频上下文（浏览器自动播放限制） */
    document.addEventListener("pointerdown", function () { SFX.unlock(); }, { once: true });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeAchModal();
    });
    window.addEventListener("resize", function () {
      if (state.screen === "game") sizeLineLayer();
    });
  }

  /* ---------- 启动 ---------- */
  bindEvents();
  renderStart();
  showScreen("start");
})();
