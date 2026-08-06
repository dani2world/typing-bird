// 클로드 dot 마스코트: 하나의 블롭 SVG + 스테이지별 레이어 토글 + 상태머신
window.Mascot = (function () {
  var wrapEl = null; // .mascot-wrap 바깥 div (애니메이션/이동 대상)
  var svgEl = null;  // .mascot-svg (스테이지 클래스 대상)
  var currentStage = 1;
  var revertTimer = null;

  var SVG_MARKUP =
    '<svg class="mascot-svg stage-1" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">' +
      '<defs>' +
        '<linearGradient id="dotGrad" x1="10%" y1="0%" x2="90%" y2="100%">' +
          '<stop offset="0%" stop-color="#FFB088"/>' +
          '<stop offset="100%" stop-color="#D97757"/>' +
        '</linearGradient>' +
        '<linearGradient id="metalGrad" x1="10%" y1="0%" x2="90%" y2="100%">' +
          '<stop offset="0%" stop-color="#D8E1E8"/>' +
          '<stop offset="100%" stop-color="#8FA3AF"/>' +
        '</linearGradient>' +
      '</defs>' +

      '<path class="blob-base" fill="url(#dotGrad)" ' +
        'd="M100,36 C136,34 166,54 172,90 C178,128 156,166 112,170 ' +
        'C70,174 32,148 28,104 C24,64 62,38 100,36 Z"/>' +

      // 알 껍질 테두리 (1단계)
      '<g class="layer layer-shell">' +
        '<path fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="1 7" opacity="0.7" ' +
          'd="M100,36 C136,34 166,54 172,90 C178,128 156,166 112,170 ' +
          'C70,174 32,148 28,104 C24,64 62,38 100,36 Z"/>' +
      '</g>' +

      // 잔금(1단계)
      '<g class="layer layer-cracks-small" stroke="#a85436" stroke-width="2.5" fill="none" stroke-linecap="round">' +
        '<path d="M72,52 L82,66 L74,78 L86,90"/>' +
        '<path d="M132,58 L124,72 L134,84"/>' +
      '</g>' +

      // 크게 갈라진 껍질 조각 (2단계, 부화)
      '<g class="layer layer-cracks-big" fill="none">' +
        '<path stroke="#a85436" stroke-width="3" stroke-linecap="round" d="M60,70 L78,86 L64,100 L82,112"/>' +
        '<path fill="#fff8ee" stroke="#e6d3bd" stroke-width="2" d="M50,60 C58,52 74,54 78,64 C82,74 70,82 60,80 C50,78 44,68 50,60 Z"/>' +
      '</g>' +

      // 솜털 (2-3단계)
      '<g class="layer layer-fluff" fill="#FFE3CC">' +
        '<path d="M78,40 q4,-16 11,-3 q5,-13 11,2 q5,-11 10,1"/>' +
      '</g>' +

      // 단순 눈 (1단계, 알 속에서 자는 눈)
      '<g class="layer layer-eyes-simple" fill="#a85436" opacity="0.55">' +
        '<path d="M78,96 q6,-4 12,0" stroke="#a85436" stroke-width="3" fill="none" stroke-linecap="round"/>' +
        '<path d="M112,96 q6,-4 12,0" stroke="#a85436" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '</g>' +

      // 동글동글 눈 (2단계 이후 기본 눈)
      '<g class="layer layer-eyes-round">' +
        '<circle cx="84" cy="98" r="11" fill="#3d2b22"/>' +
        '<circle cx="122" cy="98" r="11" fill="#3d2b22"/>' +
        '<circle cx="87" cy="94" r="3.2" fill="#fff"/>' +
        '<circle cx="125" cy="94" r="3.2" fill="#fff"/>' +
      '</g>' +

      // 볼터치
      '<g class="layer layer-blush" fill="#ff9d9d" opacity="0.7">' +
        '<ellipse cx="66" cy="116" rx="10" ry="6"/>' +
        '<ellipse cx="140" cy="116" rx="10" ry="6"/>' +
      '</g>' +

      // 부리
      '<g class="layer layer-beak" fill="#ffb454" stroke="#e0912f" stroke-width="1.5">' +
        '<path d="M92,112 L118,112 L105,128 Z"/>' +
      '</g>' +

      // 작은 날개 (3-4단계)
      '<g class="layer layer-wing-small" fill="#e8663f">' +
        '<ellipse cx="34" cy="120" rx="12" ry="18" transform="rotate(-20 34 120)"/>' +
        '<ellipse cx="166" cy="120" rx="12" ry="18" transform="rotate(20 166 120)"/>' +
      '</g>' +

      // 큰 날개 (5-7단계)
      '<g class="layer layer-wing-full" fill="#e8663f">' +
        '<ellipse cx="26" cy="122" rx="18" ry="28" transform="rotate(-24 26 122)"/>' +
        '<ellipse cx="174" cy="122" rx="18" ry="28" transform="rotate(24 174 122)"/>' +
      '</g>' +

      // 어미새 볏 (5-6단계)
      '<g class="layer layer-crest" fill="#e8663f">' +
        '<path d="M92,36 q4,-16 8,-2 q4,-14 8,0 q4,-12 8,3"/>' +
      '</g>' +

      // 박사 안경 + 학사모 (6단계)
      '<g class="layer layer-glasses" fill="none" stroke="#3d2b22" stroke-width="3">' +
        '<circle cx="84" cy="98" r="13"/>' +
        '<circle cx="122" cy="98" r="13"/>' +
        '<path d="M97,98 L109,98"/>' +
      '</g>' +
      '<g class="layer layer-cap" fill="#3d2b22">' +
        '<rect x="80" y="18" width="44" height="8" rx="2"/>' +
        '<rect x="98" y="10" width="8" height="16"/>' +
        '<circle cx="128" cy="26" r="2.4" fill="#e0a020"/>' +
        '<path d="M128,26 L128,38" stroke="#e0a020" stroke-width="2"/>' +
      '</g>' +

      // 로봇 안테나 + 바이저 + 리벳 (7단계)
      '<g class="layer layer-antenna" stroke="#8FA3AF" stroke-width="3" fill="#D8E1E8">' +
        '<path d="M100,30 L100,14"/>' +
        '<circle cx="100" cy="10" r="5"/>' +
      '</g>' +
      '<g class="layer layer-visor" fill="#3d566b" opacity="0.85">' +
        '<rect x="68" y="86" width="66" height="20" rx="10"/>' +
      '</g>' +
      '<g class="layer layer-rivets" fill="#5a6b78">' +
        '<circle cx="48" cy="100" r="3.5"/>' +
        '<circle cx="152" cy="100" r="3.5"/>' +
        '<circle cx="100" cy="160" r="3.5"/>' +
      '</g>' +
    '</svg>';

  function clearRevert() {
    if (revertTimer) { clearTimeout(revertTimer); revertTimer = null; }
  }

  function setReactionClass(cls, duration, after) {
    if (!wrapEl) return;
    clearRevert();
    wrapEl.classList.remove('react-correct', 'react-miss', 'celebrate-stageup', 'gameover-pose');
    // 강제 리플로우로 애니메이션 재시작 보장
    void wrapEl.offsetWidth;
    if (cls) wrapEl.classList.add(cls);
    if (duration) {
      revertTimer = setTimeout(function () {
        if (cls) wrapEl.classList.remove(cls);
        if (after) after();
        revertTimer = null;
      }, duration);
    }
  }

  function spawnParticles(container, count, colors) {
    if (!container) return;
    var rect = container.getBoundingClientRect();
    for (var i = 0; i < count; i++) {
      var p = document.createElement('div');
      p.className = 'particle';
      var angle = Math.random() * Math.PI * 2;
      var dist = 40 + Math.random() * 60;
      p.style.setProperty('--px', (Math.cos(angle) * dist) + 'px');
      p.style.setProperty('--py', (Math.sin(angle) * dist) + 'px');
      p.style.left = (rect.width / 2) + 'px';
      p.style.top = (rect.height / 2) + 'px';
      p.style.background = colors[i % colors.length];
      container.appendChild(p);
      (function (el) {
        setTimeout(function () { el.remove(); }, 850);
      })(p);
    }
  }

  return {
    init: function () {
      wrapEl = document.createElement('div');
      wrapEl.className = 'mascot-wrap idle-bob';
      wrapEl.innerHTML = SVG_MARKUP;
      svgEl = wrapEl.querySelector('.mascot-svg');
      return wrapEl;
    },
    mount: function (container) {
      if (!wrapEl) this.init();
      if (container && wrapEl.parentElement !== container) {
        container.appendChild(wrapEl);
      }
    },
    setStage: function (n) {
      currentStage = n;
      if (svgEl) svgEl.setAttribute('class', 'mascot-svg stage-' + n);
    },
    reactCorrect: function () {
      setReactionClass('react-correct', 400);
      spawnParticles(wrapEl, 6, ['#ffd166', '#8fd694', '#ffb088']);
    },
    reactMiss: function () {
      setReactionClass('react-miss', 500);
    },
    celebrateStageUp: function () {
      setReactionClass('celebrate-stageup', 1200);
      spawnParticles(wrapEl, 14, ['#ffd166', '#8fd694', '#ffb088', '#ff9d9d', '#9ad1ff']);
    },
    gameOver: function () {
      clearRevert();
      if (wrapEl) {
        wrapEl.classList.remove('idle-bob', 'react-correct', 'react-miss', 'celebrate-stageup');
        wrapEl.classList.add('gameover-pose');
      }
    },
    resetPose: function () {
      clearRevert();
      if (wrapEl) {
        wrapEl.classList.remove('gameover-pose', 'react-correct', 'react-miss', 'celebrate-stageup');
        wrapEl.classList.add('idle-bob');
      }
    }
  };
})();
