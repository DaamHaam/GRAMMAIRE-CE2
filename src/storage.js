const STORAGE_KEY = 'ce2-grammaire-progress';

export const BADGE_LEVELS = ['3', '4', '5'];
export const BADGE_STREAKS = [3, 4, 5];

export function makeBadgeId(level, streak) {
  return `L${level}-S${streak}`;
}

const defaultState = {
  totalScore: 0,
  bestScore: 0,
  streak: 0,
  lastLevel: null,
  recentPhrases: [],
  badges: {},
  levelPerfectStreaks: {}
};

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...defaultState };
    }
    const parsed = JSON.parse(raw);
    return {
      ...defaultState,
      ...parsed,
      badges: { ...defaultState.badges, ...(parsed.badges || {}) },
      levelPerfectStreaks: {
        ...defaultState.levelPerfectStreaks,
        ...(parsed.levelPerfectStreaks || {})
      }
    };
  } catch (error) {
    console.warn('Impossible de lire la progression :', error);
    return { ...defaultState };
  }
}

export function saveProgress(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Impossible d\'enregistrer la progression :', error);
  }
}

export function recordResult(progress, phraseId, deltaScore, stars, context = {}) {
  const next = { ...progress };
  next.totalScore = Math.max(0, next.totalScore + deltaScore);
  next.bestScore = Math.max(next.bestScore || 0, next.totalScore);
  if (stars === 3) {
    next.streak = (next.streak || 0) + 1;
  } else if (stars === 0) {
    next.streak = 0;
  } else {
    next.streak = Math.max((next.streak || 0) - 1, 0);
  }
  next.recentPhrases = [phraseId, ...(next.recentPhrases || [])]
    .filter(Boolean)
    .slice(0, 10);

  const unlockedBadges = [];
  const levelKey = context.level ? String(context.level) : null;

  if (levelKey && BADGE_LEVELS.includes(levelKey)) {
    next.levelPerfectStreaks = { ...(next.levelPerfectStreaks || {}) };
    const previousStreak = next.levelPerfectStreaks[levelKey] || 0;

    if (stars === 3) {
      const currentStreak = previousStreak + 1;
      next.levelPerfectStreaks[levelKey] = currentStreak;
      next.badges = { ...(next.badges || {}) };

      BADGE_STREAKS.forEach((threshold) => {
        if (currentStreak >= threshold) {
          const badgeId = makeBadgeId(levelKey, threshold);
          if (!next.badges[badgeId]) {
            next.badges[badgeId] = Date.now();
            unlockedBadges.push(badgeId);
          }
        }
      });
    } else {
      next.levelPerfectStreaks[levelKey] = 0;
    }
  }

  saveProgress(next);
  return { progress: next, unlockedBadges };
}

export function updateLastLevel(progress, level) {
  const next = { ...progress, lastLevel: level };
  saveProgress(next);
  return next;
}

export function resetProgress() {
  const next = { ...defaultState };
  saveProgress(next);
  return next;
}
