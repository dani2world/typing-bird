// Web Audio API 기반 효과음 합성 (외부 오디오 파일 없음)
window.GameAudio = (function () {
  var ctx = null;

  function ensureCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, startOffset, duration, type, peakGain) {
    var c = ensureCtx();
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = type || "sine";
    osc.frequency.value = freq;
    var t0 = c.currentTime + startOffset;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peakGain || 0.2, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  // ---------- 배경음악 (귀여운 8비트풍 짧은 루프, 외부 파일 없이 합성) ----------
  // [주파수(Hz), 길이(8분음표 단위)] — 0은 쉼표
  var BGM_NOTES = [
    [523.25, 1], [659.25, 1], [783.99, 1], [659.25, 1],
    [698.46, 1], [880.00, 1], [783.99, 1], [659.25, 1],
    [587.33, 1], [698.46, 1], [880.00, 1], [698.46, 1],
    [783.99, 1], [659.25, 1], [587.33, 1], [523.25, 2],
    [659.25, 1], [783.99, 1], [1046.50, 1], [783.99, 1],
    [880.00, 1], [1046.50, 1], [783.99, 1], [659.25, 1],
    [587.33, 1], [698.46, 1], [783.99, 1], [659.25, 1],
    [587.33, 1], [523.25, 1], [523.25, 2], [0, 2]
  ];
  var BGM_BPM = 132;
  var bgmPlaying = false;
  var bgmTimerId = null;
  var bgmStep = 0;

  function scheduleNextBgmNote() {
    if (!bgmPlaying) return;
    var unitMs = (60000 / BGM_BPM) / 2;
    var entry = BGM_NOTES[bgmStep % BGM_NOTES.length];
    var freq = entry[0];
    var units = entry[1];
    var durSec = (unitMs * units) / 1000;
    if (freq > 0) tone(freq, 0, durSec * 0.85, "triangle", 0.045);
    bgmStep++;
    bgmTimerId = setTimeout(scheduleNextBgmNote, unitMs * units);
  }

  return {
    unlock: function () { ensureCtx(); },
    playCorrect: function () {
      tone(660, 0, 0.1, "sine", 0.18);
      tone(880, 0.08, 0.14, "sine", 0.18);
    },
    playMiss: function () {
      tone(220, 0, 0.18, "sawtooth", 0.12);
    },
    playStageUp: function () {
      tone(523.25, 0, 0.12, "triangle", 0.2);
      tone(659.25, 0.12, 0.12, "triangle", 0.2);
      tone(783.99, 0.24, 0.12, "triangle", 0.2);
      tone(1046.5, 0.36, 0.22, "triangle", 0.22);
    },
    playGameOver: function () {
      tone(392, 0, 0.25, "sine", 0.18);
      tone(329.63, 0.22, 0.25, "sine", 0.18);
      tone(261.63, 0.44, 0.4, "sine", 0.18);
    },
    playClick: function () {
      tone(440, 0, 0.06, "square", 0.08);
    },
    playHeal: function () {
      tone(783.99, 0, 0.1, "sine", 0.2);
      tone(987.77, 0.08, 0.1, "sine", 0.2);
      tone(1318.51, 0.16, 0.2, "sine", 0.22);
    },
    playBGM: function () {
      if (bgmPlaying) return;
      ensureCtx();
      bgmPlaying = true;
      bgmStep = 0;
      scheduleNextBgmNote();
    },
    stopBGM: function () {
      bgmPlaying = false;
      if (bgmTimerId) { clearTimeout(bgmTimerId); bgmTimerId = null; }
    }
  };
})();
