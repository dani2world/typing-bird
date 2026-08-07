/**
 * 새둥지 타자 대작전 - 로그인 / 순위표 / 공지사항 백엔드
 *
 * 이 파일은 구글 시트에 연결된 Apps Script 프로젝트에 붙여넣어 사용합니다.
 * 시트 구성 (탭 이름 정확히 일치해야 함):
 *   - "Users"  : A열=닉네임, B열=PIN해시   (1행은 헤더, 2행부터 데이터)
 *   - "Scores" : A열=닉네임, B열=최고점수, C열=도달단계, D열=갱신시각
 *   - "Config" : B1 셀에 공지사항 텍스트
 *
 * 관리자 등록용 비밀키는 코드에 직접 쓰지 않고,
 * Apps Script 편집기의 "프로젝트 설정 > 스크립트 속성"에서 ADMIN_KEY 라는 이름으로 등록합니다.
 */

var USERS_SHEET = 'Users';
var SCORES_SHEET = 'Scores';
var CONFIG_SHEET = 'Config';

function doPost(e) {
  var result;
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    if (action === 'login') {
      result = handleLogin(body.nickname, body.pin);
    } else if (action === 'submitScore') {
      result = handleSubmitScore(body.nickname, body.pin, body.score, body.stage);
    } else if (action === 'getLeaderboard') {
      result = handleGetLeaderboard();
    } else if (action === 'getNotice') {
      result = handleGetNotice();
    } else if (action === 'adminRegister') {
      result = handleAdminRegister(body.adminKey, body.nickname, body.pin);
    } else {
      result = { ok: false, error: 'unknown_action' };
    }
  } catch (err) {
    result = { ok: false, error: String(err) };
  }
  return jsonOutput(result);
}

function doGet(e) {
  return jsonOutput({ ok: true, msg: 'Typing Bird API is running' });
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('missing_sheet_' + name);
  return sheet;
}

function hashPin_(nickname, pin) {
  var raw = nickname + ':' + pin + ':typing-bird-salt-v1';
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function findUserRow_(nickname) {
  var sheet = getSheet_(USERS_SHEET);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === nickname) return i + 1; // 1-indexed 실제 시트 행 번호
  }
  return -1;
}

function handleLogin(nickname, pin) {
  nickname = String(nickname || '').trim();
  pin = String(pin || '').trim();
  if (!nickname || !pin) return { ok: false, error: 'missing_fields' };
  var row = findUserRow_(nickname);
  if (row === -1) return { ok: false, error: 'no_such_user' };
  var storedHash = getSheet_(USERS_SHEET).getRange(row, 2).getValue();
  if (hashPin_(nickname, pin) === storedHash) return { ok: true, nickname: nickname };
  return { ok: false, error: 'wrong_pin' };
}

function handleSubmitScore(nickname, pin, score, stage) {
  var login = handleLogin(nickname, pin);
  if (!login.ok) return login;
  score = Number(score) || 0;
  stage = Number(stage) || 1;

  var sheet = getSheet_(SCORES_SHEET);
  var data = sheet.getDataRange().getValues();
  var row = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === nickname) { row = i + 1; break; }
  }
  if (row === -1) {
    sheet.appendRow([nickname, score, stage, new Date()]);
    return { ok: true, updated: true };
  }
  var prevScore = Number(sheet.getRange(row, 2).getValue()) || 0;
  if (score > prevScore) {
    sheet.getRange(row, 2, 1, 3).setValues([[score, stage, new Date()]]);
    return { ok: true, updated: true };
  }
  return { ok: true, updated: false };
}

function handleGetLeaderboard() {
  var sheet = getSheet_(SCORES_SHEET);
  var data = sheet.getDataRange().getValues();
  var rows = data.slice(1).filter(function (r) { return r[0]; });
  rows.sort(function (a, b) { return Number(b[1]) - Number(a[1]); });
  var top = rows.slice(0, 10).map(function (r) {
    return { nickname: r[0], score: Number(r[1]), stage: Number(r[2]) };
  });
  return { ok: true, leaderboard: top };
}

function handleGetNotice() {
  var sheet = getSheet_(CONFIG_SHEET);
  var notice = sheet.getRange('B1').getValue();
  return { ok: true, notice: String(notice || '') };
}

function handleAdminRegister(adminKey, nickname, pin) {
  var expected = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  if (!expected || adminKey !== expected) return { ok: false, error: 'unauthorized' };

  nickname = String(nickname || '').trim();
  pin = String(pin || '').trim();
  if (!nickname || !pin) return { ok: false, error: 'missing_fields' };
  if (findUserRow_(nickname) !== -1) return { ok: false, error: 'duplicate_nickname' };

  getSheet_(USERS_SHEET).appendRow([nickname, hashPin_(nickname, pin)]);
  return { ok: true };
}
