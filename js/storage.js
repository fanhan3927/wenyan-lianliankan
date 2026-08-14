/* ==========================================================
 * 文言文连连看 · 本地进度存储（localStorage）
 * 记录：每关星级/正确率/最佳用时 + 成就解锁时间 + 音效开关
 * ========================================================== */
const Store = (function () {
  var KEY = "wenyan-lianliankan-v1";
  var DEFAULT = { levels: {}, achievements: {}, sound: true };
  var state;

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        var merged = JSON.parse(JSON.stringify(DEFAULT));
        Object.keys(parsed).forEach(function (k) {
          if (k in merged) merged[k] = parsed[k];
        });
        return merged;
      }
    } catch (e) {
      /* 数据损坏时回退默认值 */
    }
    return JSON.parse(JSON.stringify(DEFAULT));
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      /* 隐私模式等场景下静默失败 */
    }
  }

  state = load();

  return {
    get sound() { return state.sound; },
    setSound: function (v) { state.sound = !!v; save(); },

    get achievements() { return state.achievements; },

    /* 读取某关记录（无则 null） */
    getLevel: function (id) { return state.levels[id] || null; },

    /* 写入某关成绩（取历史最优） */
    recordLevel: function (id, data) {
      var prev = state.levels[id] || {};
      state.levels[id] = {
        stars: Math.max(prev.stars || 0, data.stars),
        accuracy: Math.max(prev.accuracy || 0, data.accuracy),
        time: prev.time == null ? data.time : Math.min(prev.time, data.time),
        remaining: Math.max(prev.remaining || 0, data.remaining || 0),
        plays: (prev.plays || 0) + 1
      };
      save();
    },

    /* 解锁成就；首次解锁返回 true */
    unlockAchievement: function (id) {
      if (state.achievements[id]) return false;
      state.achievements[id] = Date.now();
      save();
      return true;
    }
  };
})();
