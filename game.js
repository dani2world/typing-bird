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
    lastTs: 0,
    loggedIn: false,
    nickname: null,
    pin: null,
    authDecided: false,   // 이번 세션에서 로그인/게스트 여부를 이미 정했는지
    loginIntent: 'start'  // 'start' | 'browse' — 로그인 화면을 연 이유
  };

  var wordQueues = {};
  var selectedMode = 'ko';
  var selectedStage = 1;

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
    var el = document.getElementById('best-score-display');
    el.textContent = '최고기록 : 불러오는 중...';
    window.Backend.getLeaderboard().then(function (res) {
      if (res.ok && res.leaderboard && res.leaderboard.length > 0) {
        var top = res.leaderboard[0];
        var stage = window.getStage(top.stage);
        el.textContent = '최고기록 : ' + top.nickname + ' ' + top.score + '점' + (stage ? ' ' + stage.emoji : '');
      } else {
        el.textContent = '최고기록 : 아직 없어요';
      }
    });
  }

  // ---------- 로그인 / 세션 ----------
  var SESSION_KEY = 'birdTypingSession';
  function loadSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (obj && obj.nickname && obj.pin) return obj;
    } catch (e) {}
    return null;
  }
  function saveSession(nickname, pin) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ nickname: nickname, pin: pin })); } catch (e) {}
  }
  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  function loginErrorMessage(code) {
    switch (code) {
      case 'no_such_user': return '등록되지 않은 닉네임이에요.';
      case 'wrong_pin': return 'PIN이 올바르지 않아요.';
      case 'missing_fields': return '닉네임과 PIN을 모두 입력해주세요.';
      case 'backend_not_configured': return '아직 서버 연결 전이에요. 잠시만 기다려주세요.';
      default: return '로그인에 실패했어요. 잠시 후 다시 시도해주세요.';
    }
  }
  function showLoginError(msg) {
    var el = document.getElementById('login-error');
    el.textContent = msg;
    el.classList.remove('hidden');
  }
  function hideLoginError() {
    document.getElementById('login-error').classList.add('hidden');
  }
  function showLoginForm() {
    document.getElementById('login-welcome-back').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
  }

  // 순위표와 동일한 방식(반투명 배경 위 팝업 카드)의 오버레이로 로그인 화면을 띄움
  // intent: 'start' — "시작하기"를 눌러서 게임을 시작하려는 경우 (해결되면 바로 게임 시작)
  //         'browse' — 홈 화면의 "로그인" 링크로 연 경우 (해결되면 홈 화면으로 복귀)
  function openLoginScreen(intent) {
    state.loginIntent = intent;
    var guestBtn = document.getElementById('guest-btn');
    guestBtn.textContent = intent === 'start' ? 'Guest로 플레이' : '취소하고 돌아가기';
    document.getElementById('screen-login').classList.remove('hidden');
    hideLoginError();
    var session = loadSession();
    if (session) {
      document.getElementById('login-welcome-back').classList.remove('hidden');
      document.getElementById('login-form').classList.add('hidden');
      document.getElementById('welcome-back-text').textContent = session.nickname + '님, 환영합니다!';
    } else {
      showLoginForm();
    }
  }

  function closeLoginScreen() {
    document.getElementById('screen-login').classList.add('hidden');
  }

  function updateLoginStatusDisplay() {
    var statusEl = document.getElementById('login-status');
    var logoutBtn = document.getElementById('logout-btn'); // 현재 화면에서 숨김 처리됨(주석) — null일 수 있음
    var loginLinkBtn = document.getElementById('login-link-btn');
    if (state.loggedIn) {
      statusEl.textContent = '👤 ' + state.nickname + '님으로 플레이 중';
      statusEl.classList.remove('hidden');
      if (logoutBtn) logoutBtn.classList.remove('hidden');
      loginLinkBtn.classList.add('hidden');
    } else {
      statusEl.textContent = '';
      statusEl.classList.add('hidden');
      if (logoutBtn) logoutBtn.classList.add('hidden');
      loginLinkBtn.classList.remove('hidden');
    }
  }

  // 로그인 화면(로그인 성공 / 게스트 / 세션 이어하기)이 해결됐을 때 공통 처리
  function resolveLogin(loggedIn, nickname, pin) {
    state.authDecided = true;
    if (loggedIn) {
      state.loggedIn = true;
      state.nickname = nickname;
      state.pin = pin;
    }
    updateLoginStatusDisplay();
    closeLoginScreen();
    if (state.loginIntent === 'start') {
      startGame(selectedMode, selectedStage);
    } else {
      updateBestScoreDisplay();
    }
  }

  // ---------- 공지사항 ----------
  function loadNotice() {
    var board = document.getElementById('notice-board');
    window.Backend.getNotice().then(function (res) {
      if (res.ok && res.notice) {
        board.textContent = '📢 ' + res.notice;
        board.classList.remove('hidden');
      } else {
        board.classList.add('hidden');
      }
    });
  }

  // ---------- 순위표 ----------
  function openLeaderboard() {
    var listEl = document.getElementById('leaderboard-list');
    listEl.innerHTML = '<li class="leaderboard-empty">불러오는 중...</li>';
    document.getElementById('screen-leaderboard').classList.remove('hidden');
    window.Backend.getLeaderboard().then(function (res) {
      if (!res.ok) {
        listEl.innerHTML = '<li class="leaderboard-empty">순위표를 불러올 수 없어요.</li>';
        return;
      }
      if (!res.leaderboard || res.leaderboard.length === 0) {
        listEl.innerHTML = '<li class="leaderboard-empty">아직 기록이 없어요.</li>';
        return;
      }
      var medals = ['🥇', '🥈', '🥉'];
      listEl.innerHTML = res.leaderboard.map(function (row, i) {
        var rankLabel = medals[i] || (i + 1) + '.';
        var stage = window.getStage(row.stage);
        return '<li><span><span class="leaderboard-rank">' + rankLabel + '</span>' + escapeHtml(row.nickname) + '</span><span>' +
          row.score + '점 (' + (stage ? stage.emoji : '') + ')</span></li>';
      }).join('');
    });
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
    updateLoginStatusDisplay();
  }

  function endGame() {
    state.phase = 'gameover';
    window.__gameFocusInput = false;
    window.Input.blur();
    window.GameAudio.stopBGM();

    var best = loadBest();
    var isNewRecord = state.score > best.score;
    saveBest(Math.max(state.score, best.score), Math.max(state.stageId, best.stage));
    if (state.loggedIn) {
      window.Backend.submitScore(state.nickname, state.pin, state.score, state.stageId);
    }

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
      if (state.authDecided) {
        startGame(selectedMode, selectedStage);
      } else {
        openLoginScreen('start');
      }
    });
    document.getElementById('pause-btn').addEventListener('click', pauseGame);
    document.getElementById('resume-btn').addEventListener('click', resumeGame);
    document.getElementById('quit-btn').addEventListener('click', quitToStart);
    document.getElementById('retry-btn').addEventListener('click', function () {
      startGame(state.mode, state.startStageId);
    });
    document.getElementById('back-btn').addEventListener('click', quitToStart);

    document.getElementById('continue-session-btn').addEventListener('click', function () {
      var session = loadSession();
      if (!session) { showLoginForm(); return; }
      window.GameAudio.playClick();
      window.Backend.login(session.nickname, session.pin).then(function (res) {
        if (res.ok) {
          resolveLogin(true, session.nickname, session.pin);
        } else {
          clearSession();
          showLoginForm();
          showLoginError('세션이 만료됐어요. 다시 로그인해주세요.');
        }
      });
    });
    document.getElementById('switch-account-btn').addEventListener('click', function () {
      clearSession();
      showLoginForm();
      hideLoginError();
    });
    document.getElementById('login-btn').addEventListener('click', function () {
      var nickname = document.getElementById('nickname-input').value.trim();
      var pin = document.getElementById('pin-input').value.trim();
      hideLoginError();
      if (!nickname || !pin) { showLoginError('닉네임과 PIN을 모두 입력해주세요.'); return; }
      window.GameAudio.playClick();
      window.Backend.login(nickname, pin).then(function (res) {
        if (res.ok) {
          saveSession(nickname, pin);
          resolveLogin(true, nickname, pin);
        } else {
          showLoginError(loginErrorMessage(res.error));
        }
      });
    });
    document.getElementById('guest-btn').addEventListener('click', function () {
      window.GameAudio.playClick();
      resolveLogin(false);
    });
    document.getElementById('login-link-btn').addEventListener('click', function () {
      window.GameAudio.playClick();
      openLoginScreen('browse');
    });
    var logoutBtnEl = document.getElementById('logout-btn'); // 현재 화면에서 숨김 처리됨(주석) — null일 수 있음
    if (logoutBtnEl) {
      logoutBtnEl.addEventListener('click', function () {
        clearSession();
        state.loggedIn = false;
        state.nickname = null;
        state.pin = null;
        updateLoginStatusDisplay();
      });
    }
    document.getElementById('leaderboard-btn').addEventListener('click', function () {
      window.GameAudio.playClick();
      openLeaderboard();
    });
    document.getElementById('leaderboard-close-btn').addEventListener('click', function () {
      document.getElementById('screen-leaderboard').classList.add('hidden');
    });

    window.Mascot.init();
    window.Mascot.setStage(1);
    showScreen('start');
    updateLoginStatusDisplay();
    updateBestScoreDisplay();
    loadNotice();

    requestAnimationFrame(tick);
  });
})();
