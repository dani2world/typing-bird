// 한글 IME 조합 + 영문 입력을 하나의 버퍼로 통합 처리하는 모듈
window.Input = (function () {
  var inputEl = null;
  var isComposing = false;
  var mode = 'ko';
  var callbacks = { onBufferChange: function () {}, onSubmit: function () {} };

  function ensureInputEl() {
    if (inputEl) return inputEl;
    inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.autocomplete = 'off';
    inputEl.autocorrect = 'off';
    inputEl.autocapitalize = 'off';
    inputEl.spellcheck = false;
    inputEl.setAttribute('aria-hidden', 'true');
    inputEl.tabIndex = -1;
    inputEl.style.position = 'fixed';
    inputEl.style.left = '0';
    inputEl.style.top = '0';
    inputEl.style.width = '1px';
    inputEl.style.height = '1px';
    inputEl.style.opacity = '0';
    inputEl.style.border = 'none';
    inputEl.style.padding = '0';
    inputEl.style.pointerEvents = 'none';
    document.body.appendChild(inputEl);

    inputEl.addEventListener('compositionstart', function () { isComposing = true; });
    inputEl.addEventListener('compositionend', function () {
      isComposing = false;
      emitBuffer();
    });
    inputEl.addEventListener('input', function () {
      if (mode === 'en') { emitBuffer(); return; }
      // 한글 모드: 조합 중에도 실시간 미리보기 반영
      emitBuffer();
    });
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        Input.reset();
      } else if (e.key === 'Enter') {
        // 한글 조합 중 엔터(조합 확정)는 제출로 처리하지 않음
        if (isComposing || e.keyCode === 229) return;
        e.preventDefault();
        callbacks.onSubmit(inputEl.value);
      }
    });

    // 포커스가 풀리면 다시 잡아준다 (플레이 중 클릭 등으로 포커스 이탈 방지)
    document.addEventListener('click', function () {
      if (window.__gameFocusInput) inputEl.focus();
    });

    return inputEl;
  }

  function emitBuffer() {
    callbacks.onBufferChange(inputEl.value);
  }

  var Input = {
    init: function (m, cbs) {
      ensureInputEl();
      mode = m || 'ko';
      callbacks = {
        onBufferChange: (cbs && cbs.onBufferChange) || function () {},
        onSubmit: (cbs && cbs.onSubmit) || function () {}
      };
    },
    setMode: function (m) {
      mode = m;
    },
    reset: function () {
      if (!inputEl) return;
      if (!isComposing) {
        inputEl.value = '';
      }
    },
    focus: function () {
      if (inputEl) inputEl.focus();
    },
    blur: function () {
      if (inputEl) inputEl.blur();
    },
    getBuffer: function () {
      return inputEl ? inputEl.value : '';
    }
  };

  return Input;
})();
