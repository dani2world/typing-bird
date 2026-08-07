// 구글 시트(Apps Script 웹앱) 백엔드와 통신 — 로그인 / 점수 제출 / 순위표 / 공지사항
window.Backend = (function () {
  var API_URL = 'https://script.google.com/macros/s/AKfycbwBqZ-pPDKAg6gAimjgmQo3KcDaCtzSAzt5XX1u3xDr6zsS68VynOVp0e4GXdEbXahurg/exec';

  function call(payload) {
    if (!API_URL || API_URL.indexOf('REPLACE_WITH') === 0) {
      return Promise.resolve({ ok: false, error: 'backend_not_configured' });
    }
    return fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json();
    }).catch(function () {
      return { ok: false, error: 'network_error' };
    });
  }

  return {
    isConfigured: function () {
      return !!API_URL && API_URL.indexOf('REPLACE_WITH') !== 0;
    },
    login: function (nickname, pin) {
      return call({ action: 'login', nickname: nickname, pin: pin });
    },
    submitScore: function (nickname, pin, score, stage) {
      return call({ action: 'submitScore', nickname: nickname, pin: pin, score: score, stage: stage });
    },
    getLeaderboard: function () {
      return call({ action: 'getLeaderboard' });
    },
    getNotice: function () {
      return call({ action: 'getNotice' });
    }
  };
})();
