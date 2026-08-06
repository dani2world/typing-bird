// 7단계 난이도 설정표 (언어 무관 — 속도/스폰/동시개수/실수관용)
window.STAGES = [
  { id: 1, nameKo: "알",     nameEn: "Egg",             emoji: "🥚", bankTier: 1, fallSpeed: 26, spawnIntervalMs: 3400, maxConcurrent: 1, forgiveFirstMiss: true,  wordsToClear: 16 },
  { id: 2, nameKo: "삐약이", nameEn: "Peep",            emoji: "🐤", bankTier: 2, fallSpeed: 32, spawnIntervalMs: 3000, maxConcurrent: 1, forgiveFirstMiss: true,  wordsToClear: 20 },
  { id: 3, nameKo: "아기새", nameEn: "Baby Bird",       emoji: "🐥", bankTier: 3, fallSpeed: 36, spawnIntervalMs: 2800, maxConcurrent: 2, forgiveFirstMiss: false, wordsToClear: 24 },
  { id: 4, nameKo: "형님새", nameEn: "Big Sibling Bird",emoji: "🐦", bankTier: 4, fallSpeed: 40, spawnIntervalMs: 2600, maxConcurrent: 2, forgiveFirstMiss: false, wordsToClear: 28 },
  { id: 5, nameKo: "어미새", nameEn: "Mother Bird",     emoji: "🦤", bankTier: 5, fallSpeed: 44, spawnIntervalMs: 2500, maxConcurrent: 2, forgiveFirstMiss: false, wordsToClear: 20 },
  { id: 6, nameKo: "박사새", nameEn: "Doctor Bird",     emoji: "🦉", bankTier: 6, fallSpeed: 48, spawnIntervalMs: 2400, maxConcurrent: 3, forgiveFirstMiss: false, wordsToClear: 20 },
  { id: 7, nameKo: "기계새", nameEn: "Mecha Bird",      emoji: "🤖", bankTier: 7, fallSpeed: 48, spawnIntervalMs: 2400, maxConcurrent: 3, forgiveFirstMiss: false, wordsToClear: 999 },
];

window.getStage = function (id) {
  return window.STAGES.find(function (s) { return s.id === id; }) || window.STAGES[0];
};
