/* ==========================================================
 * 文言文连连看 · 音效引擎
 * 纯代码 Web Audio API 生成音效，零音频文件、零网络请求
 * 注意：浏览器要求用户手势后才能出声，首次交互时调用 unlock()
 * ========================================================== */
const SFX = (function () {
  let ctx = null;
  let enabled = true;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
      } catch (e) {
        return null;
      }
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(function () {});
    }
    return ctx;
  }

  /* 生成一个音符 */
  function tone(freq, dur, opts) {
    if (!enabled) return;
    const c = ensure();
    if (!c) return;
    opts = opts || {};
    const type = opts.type || "sine";
    const vol = opts.vol != null ? opts.vol : 0.16;
    const delay = opts.delay || 0;
    const slide = opts.slide || 0;

    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t0 + dur);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  return {
    unlock: function () { ensure(); },
    isEnabled: function () { return enabled; },
    setEnabled: function (v) { enabled = !!v; },

    /* 按钮点击 */
    click: function () {
      tone(740, 0.05, { type: "triangle", vol: 0.08 });
    },
    /* 选中卡片 */
    select: function () {
      tone(660, 0.07, { type: "triangle", vol: 0.10 });
    },
    /* 配对成功：上行三连音 */
    correct: function () {
      tone(523.25, 0.18, { type: "triangle", vol: 0.16 });
      tone(659.25, 0.18, { type: "triangle", vol: 0.16, delay: 0.06 });
      tone(783.99, 0.20, { type: "triangle", vol: 0.16, delay: 0.12 });
    },
    /* 配对错误：低沉下滑音 */
    wrong: function () {
      tone(180, 0.22, { type: "sawtooth", vol: 0.10, slide: 110 });
      tone(90, 0.30, { type: "square", vol: 0.05, delay: 0.02 });
    },
    /* 倒计时滴答 */
    tick: function () {
      tone(1050, 0.04, { type: "square", vol: 0.05 });
    },
    /* 通关：欢快琶音 */
    win: function () {
      tone(523.25, 0.30, { type: "triangle", vol: 0.16 });
      tone(659.25, 0.30, { type: "triangle", vol: 0.16, delay: 0.11 });
      tone(783.99, 0.30, { type: "triangle", vol: 0.16, delay: 0.22 });
      tone(1046.5, 0.45, { type: "triangle", vol: 0.16, delay: 0.33 });
      tone(1046.5, 0.50, { type: "sine", vol: 0.10, delay: 0.46 });
    },
    /* 失败：下行音 */
    lose: function () {
      tone(392, 0.28, { type: "triangle", vol: 0.13 });
      tone(329.63, 0.28, { type: "triangle", vol: 0.13, delay: 0.12 });
      tone(261.63, 0.28, { type: "triangle", vol: 0.13, delay: 0.24 });
      tone(196, 0.40, { type: "triangle", vol: 0.13, delay: 0.36 });
    },
    /* 成就解锁：清脆亮音 */
    achievement: function () {
      tone(783.99, 0.22, { type: "triangle", vol: 0.15 });
      tone(987.77, 0.22, { type: "triangle", vol: 0.15, delay: 0.07 });
      tone(1174.66, 0.25, { type: "triangle", vol: 0.15, delay: 0.14 });
      tone(1567.98, 0.35, { type: "triangle", vol: 0.14, delay: 0.21 });
    }
  };
})();
