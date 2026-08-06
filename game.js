// 게임 루프 / 스폰 / 입력매칭 / 점수 / 화면전환 — 전체 조립
(function () {
  // 모바일에서 가상 키보드가 뜨면 실제 보이는 화면 높이가 줄어드는데,
  // 이 값을 --app-height로 반영해서 입력창이 키보드 위에 보이도록 함
  function updateAppHeight() {
    var h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--app-height', h + 'px');
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateAppHeight);
    window.visualViewport.addEventListener('scroll', updateAppHeight);
  }
  window.addEventListener('resize', updateAppHeight);
  updateAppHeight();

  var state = {
    phase: 'start',      // 'start' | 'playing' | 'gameover'
    mode: 'ko',
    stageId: 1,
    startStageId: 1,
    score: 0,
    lives: 3,
    wordsClearedInStage: 0,
    stageMissForgiven: false,
    activeWords: [],
    lockedWordId: null,
    nextWordId: 1,
    spawnAccum: 0,
    nextSpawnInterval: 3000,
    paused: false,
    transitioning: false,
    lastTs: 0
  };

  var wordQueues = {};

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  function nextWord(mode, tier) {
    var key = mode + '-' + tier;
    if (!wordQueues[key] || wordQueues[key].length === 0) {
      var bank = (window.WORD_BANKS[mode] && window.WORD_BANKS[mode][tier]) || [];
      wordQueues[key] = shuffle(bank.slice());
    }
    return wordQueues[key].pop();
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderWordHTML(text, typedCount) {
    var typedPart = text.slice(0, typedCount);
    var restPart = text.slice(typedCount);
    return '<span class="typed-part">' + escapeHtml(typedPart) + '</span>' +
           '<span class="rest-part">' + escapeHtml(restPart) + '</span>';
  }

  function refreshWordDisplay(word, typedCount) {
    var prefix = word.isBonus ? '<span class="bonus-icon">💖</span>' : '';
    word.el.innerHTML = prefix + renderWordHTML(word.text, typedCount);
  }

  function getWordById(id) {
    if (id == null) return null;
    for (var i = 0; i < state.activeWords.length; i++) {
      if (state.activeWords[i].id === id) return state.activeWords[i];
    }
    return null;
  }

  // ---------- 화면 전환 ----------
  function showScreen(name) {
    ['start', 'playing', 'gameover'].forEach(function (n) {
      var el = document.getElementById('screen-' + n);
      if (!el) return;
      if (n === name) el.classList.remove('hidden'); else el.classList.add('hidden');
    });
  }
  function showPauseOverlay(show) {
    var el = document.getElementById('screen-paused');
    if (show) el.classList.remove('hidden'); else el.classList.add('hidden');
  }

  // ---------- localStorage 최고기록 ----------
  var STORAGE_KEY = 'birdTypingBest';
  function loadBest() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { score: 0, stage: 1 };
      var obj = JSON.parse(raw);
      return { score: obj.score || 0, stage: obj.stage || 1 };
    } catch (e) { return { score: 0, stage: 1 }; }
  }
  function saveBest(score, stage) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ score: score, stage: stage })); } catch (e) {}
  }
  function updateBestScoreDisplay() {
    var best = loadBest();
    var el = document.getElementById('best-score-display');
    if (best.score > 0) {
      var stage = window.getStage(best.stage);
      el.textContent = '최고 기록: ' + best.score + '점 (' + stage.emoji + ' ' + stage.nameKo + ' 단계)';
    } else {
      el.textContent = '최고 기록: 없음';
    }
  }

  // ---------- 화면 표시 갱신 ----------
  function updateLivesDisplay() {
    var html = '';
    for (var i = 0; i < 3; i++) html += (i < state.lives ? '❤️' : '🤍');
    document.getElementById('lives-display').textContent = html;
  }
  function updateScoreDisplay() {
    document.getElementById('score-display').textContent = '점수: ' + state.score;
  }
  function updateStageBadge() {
    var stage = window.getStage(state.stageId);
    document.getElementById('stage-badge').textContent = stage.emoji + ' ' + stage.nameKo;
  }
  function updateTypedBufferDisplay(buffer) {
    document.getElementById('typed-buffer-text').textContent = buffer;
  }
  function flashNoMatch() {
    var el = document.getElementById('typed-buffer');
    el.classList.add('no-match');
    setTimeout(function () { el.classList.remove('no-match'); }, 150);
  }

  // ---------- 스폰 ----------
  var BONUS_CHANCE = 0.2; // 목숨이 다 차 있지 않을 때, 스폰 시마다 하트 회복 아이템이 나올 확률

  function spawnWord(isBonus) {
    var stage = window.getStage(state.stageId);
    // 특별 단어는 현재 단계와 다음 단계 사이(약 0.5단계 위)에서 절반씩 확률로 뽑는다
    var tier = isBonus ? Math.min(7, stage.bankTier + (Math.random() < 0.5 ? 0 : 1)) : stage.bankTier;
    var text = nextWord(state.mode, tier);
    if (!text) return;
    var playArea = document.getElementById('play-area');
    var areaW = playArea.clientWidth;

    var el = document.createElement('div');
    el.className = 'falling-word' + (isBonus ? ' bonus-word' : '');

    var word = {
      id: state.nextWordId++,
      text: text,
      x: 0,
      y: -50,
      speed: stage.fallSpeed * (0.9 + Math.random() * 0.2),
      el: el,
      locked: false,
      isBonus: !!isBonus
    };
    refreshWordDisplay(word, 0);
    playArea.appendChild(el);

    var wordWidth = el.offsetWidth;
    var margin = Math.min(areaW / 2 - 4, wordWidth / 2 + 16);
    var span = Math.max(10, areaW - margin * 2);
    var x = margin + Math.random() * span;
    word.x = x;
    el.style.left = x + 'px';
    el.style.top = word.y + 'px';
    state.activeWords.push(word);
  }

  function trySpawn(dt) {
    var stage = window.getStage(state.stageId);
    if (state.activeWords.length >= stage.maxConcurrent) return;
    state.spawnAccum += dt * 1000;
    if (state.spawnAccum >= state.nextSpawnInterval) {
      state.spawnAccum = 0;
      state.nextSpawnInterval = stage.spawnIntervalMs * (0.8 + Math.random() * 0.4);
      var isBonus = state.lives < 3 && Math.random() < BONUS_CHANCE;
      spawnWord(isBonus);
    }
  }

  function updatePositions(dt) {
    state.activeWords.forEach(function (w) {
      w.y += w.speed * dt;
      w.el.style.top = w.y + 'px';
    });
  }

  function checkMisses() {
    var playArea = document.getElementById('play-area');
    var nestTopY = playArea.clientHeight - 66;
    var stillActive = [];
    state.activeWords.forEach(function (w) {
      if (w.y >= nestTopY) {
        handleMiss(w);
      } else {
        stillActive.push(w);
      }
    });
    state.activeWords = stillActive;
  }

  function handleMiss(word) {
    word.el.classList.add('fall-miss');
    setTimeout(function () { word.el.remove(); }, 400);
    if (word.locked || state.lockedWordId === word.id) {
      state.lockedWordId = null;
      window.Input.reset();
      updateTypedBufferDisplay('');
    }
    var stage = window.getStage(state.stageId);
    window.GameAudio.playMiss();
    window.Mascot.reactMiss();
    if (stage.forgiveFirstMiss && !state.stageMissForgiven) {
      state.stageMissForgiven = true;
      return; // 첫 실수는 목숨 안 깎임
    }
    state.lives--;
    updateLivesDisplay();
    if (state.lives <= 0) endGame();
  }

  function scoreForWord(text, stageId) {
    var len = text.replace(/\s/g, '').length;
    return stageId * 10 + len;
  }

  function handleCorrect(word) {
    word.el.classList.add('pop');
    setTimeout(function () { word.el.remove(); }, 300);
    state.activeWords = state.activeWords.filter(function (w) { return w.id !== word.id; });
    state.lockedWordId = null;
    state.score += scoreForWord(word.text, state.stageId);
    state.wordsClearedInStage++;
    if (word.isBonus && state.lives < 3) {
      state.lives++;
      updateLivesDisplay();
      window.GameAudio.playHeal();
    } else {
      window.GameAudio.playCorrect();
    }
    window.Mascot.reactCorrect();
    window.Input.reset();
    updateTypedBufferDisplay('');
    updateScoreDisplay();
    checkStageUp();
  }

  function showStageUpBanner() {
    state.transitioning = true;
    var stage = window.getStage(state.stageId);
    var playArea = document.getElementById('play-area');
    var banner = document.createElement('div');
    banner.className = 'stageup-banner';
    banner.textContent = '🎉 레벨업! ' + stage.emoji + ' ' + stage.nameKo + ' 🎉';
    playArea.appendChild(banner);
    setTimeout(function () {
      banner.remove();
      state.transitioning = false;
    }, 1400);
  }

  function checkStageUp() {
    var stage = window.getStage(state.stageId);
    if (state.stageId < 7 && state.wordsClearedInStage >= stage.wordsToClear) {
      state.stageId++;
      state.wordsClearedInStage = 0;
      state.stageMissForgiven = false;
      window.Mascot.setStage(state.stageId);
      window.Mascot.celebrateStageUp();
      window.GameAudio.playStageUp();
      updateStageBadge();
      showStageUpBanner();
    }
  }

  // ---------- 입력 처리 ----------
  function unlockWord() {
    var locked = getWordById(state.lockedWordId);
    if (locked) {
      locked.locked = false;
      locked.el.classList.remove('locked');
      refreshWordDisplay(locked, 0);
    }
    state.lockedWordId = null;
  }

  function onBufferChange(buffer) {
    updateTypedBufferDisplay(buffer);
    if (state.phase !== 'playing') return;

    if (buffer.length === 0) {
      if (state.lockedWordId != null) unlockWord();
      return;
    }

    var locked = getWordById(state.lockedWordId);
    if (locked && locked.text.indexOf(buffer) === 0) {
      refreshWordDisplay(locked, buffer.length);
      return;
    }

    if (locked) {
      locked.locked = false;
      locked.el.classList.remove('locked');
      refreshWordDisplay(locked, 0);
      state.lockedWordId = null;
    }

    var candidates = state.activeWords.filter(function (w) { return w.text.indexOf(buffer) === 0; });
    if (candidates.length === 0) {
      flashNoMatch();
      return;
    }
    candidates.sort(function (a, b) { return b.y - a.y; });
    var target = candidates[0];
    state.lockedWordId = target.id;
    target.locked = true;
    target.el.classList.add('locked');
    refreshWordDisplay(target, buffer.length);
  }

  function onSubmit(buffer) {
    if (state.phase !== 'playing' || !buffer) return;

    var locked = getWordById(state.lockedWordId);
    if (locked && buffer === locked.text) {
      handleCorrect(locked);
      return;
    }

    var exact = state.activeWords.filter(function (w) { return w.text === buffer; });
    if (exact.length > 0) {
      exact.sort(function (a, b) { return b.y - a.y; });
      handleCorrect(exact[0]);
      return;
    }

    flashNoMatch();
  }

  // ---------- 게임 흐름 ----------
  function resetGameState(mode, stageId) {
    state.mode = mode;
    state.stageId = stageId;
    state.startStageId = stageId;
    state.score = 0;
    state.lives = 3;
    state.wordsClearedInStage = 0;
    state.stageMissForgiven = false;
    state.activeWords.forEach(function (w) { w.el.remove(); });
    state.activeWords = [];
    state.lockedWordId = null;
    state.nextWordId = 1;
    state.spawnAccum = 0;
    state.nextSpawnInterval = window.getStage(stageId).spawnIntervalMs;
    state.transitioning = false;
    state.paused = false;
    wordQueues = {};

    window.Mascot.setStage(stageId);
    window.Mascot.resetPose();
    updateLivesDisplay();
    updateScoreDisplay();
    updateStageBadge();
    updateTypedBufferDisplay('');
  }

  function startGame(mode, stageId) {
    window.GameAudio.unlock();
    resetGameState(mode, stageId);
    state.phase = 'playing';
    showScreen('playing');
    showPauseOverlay(false);
    window.__gameFocusInput = true;
    window.Input.init(mode, { onBufferChange: onBufferChange, onSubmit: onSubmit });
    window.Input.setMode(mode);
    window.Input.reset();
    window.Input.focus();
    window.Mascot.mount(document.getElementById('mascot-playing'));
    window.GameAudio.playBGM();
  }

  function pauseGame() {
    if (state.phase !== 'playing') return;
    state.paused = true;
    window.__gameFocusInput = false;
    showPauseOverlay(true);
    window.Input.blur();
    window.GameAudio.stopBGM();
  }
  function resumeGame() {
    state.paused = false;
    window.__gameFocusInput = true;
    showPauseOverlay(false);
    window.Input.focus();
    window.GameAudio.playBGM();
  }
  function quitToStart() {
    state.paused = false;
    state.phase = 'start';
    window.__gameFocusInput = false;
    showPauseOverlay(false);
    window.Input.blur();
    window.GameAudio.stopBGM();
    state.activeWords.forEach(function (w) { w.el.remove(); });
    state.activeWords = [];
    showScreen('start');
    window.Mascot.mount(document.getElementById('mascot-start'));
    window.Mascot.resetPose();
    window.Mascot.setStage(1);
    updateBestScoreDisplay();
  }

  function endGame() {
    state.phase = 'gameover';
    window.__gameFocusInput = false;
    window.Input.blur();
    window.GameAudio.stopBGM();

    var best = loadBest();
    var isNewRecord = state.score > best.score;
    saveBest(Math.max(state.score, best.score), Math.max(state.stageId, best.stage));

    window.GameAudio.playGameOver();
    window.Mascot.mount(document.getElementById('mascot-gameover'));
    window.Mascot.gameOver();

    document.getElementById('final-score').textContent = state.score;
    var stage = window.getStage(state.stageId);
    document.getElementById('final-stage').textContent = stage.emoji + ' ' + stage.nameKo;
    document.getElementById('new-record-badge').classList.toggle('hidden', !isNewRecord);
    showScreen('gameover');
  }

  // ---------- 메인 루프 ----------
  function tick(ts) {
    if (!state.lastTs) state.lastTs = ts;
    var dt = Math.min((ts - state.lastTs) / 1000, 0.05);
    state.lastTs = ts;
    if (state.phase === 'playing' && !state.paused && !state.transitioning) {
      trySpawn(dt);
      updatePositions(dt);
      checkMisses();
    }
    requestAnimationFrame(tick);
  }

  // ---------- 초기화 / UI 바인딩 ----------
  document.addEventListener('DOMContentLoaded', function () {
    var selectedMode = 'ko';
    var selectedStage = 1;

    document.querySelectorAll('.mode-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.mode-btn').forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
        selectedMode = btn.dataset.mode;
        window.GameAudio.playClick();
      });
    });
    document.querySelectorAll('.stage-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.stage-btn').forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
        selectedStage = parseInt(btn.dataset.stage, 10);
        window.GameAudio.playClick();
      });
    });

    document.getElementById('start-btn').addEventListener('click', function () {
      startGame(selectedMode, selectedStage);
    });
    document.getElementById('pause-btn').addEventListener('click', pauseGame);
    document.getElementById('resume-btn').addEventListener('click', resumeGame);
    document.getElementById('quit-btn').addEventListener('click', quitToStart);
    document.getElementById('retry-btn').addEventListener('click', function () {
      startGame(state.mode, state.startStageId);
    });
    document.getElementById('back-btn').addEventListener('click', quitToStart);

    window.Mascot.init();
    window.Mascot.mount(document.getElementById('mascot-start'));
    window.Mascot.setStage(1);
    updateBestScoreDisplay();

    requestAnimationFrame(tick);
  });
})();
