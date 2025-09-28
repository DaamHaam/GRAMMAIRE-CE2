const STORAGE_KEY = 'ce2-grammaire-progress';

const defaultState = {
  totalScore: 0,
  bestScore: 0,
  streak: 0,
  lastLevel: null,
  recentPhrases: []
};

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...defaultState };
    }
    const parsed = JSON.parse(raw);
    return { ...defaultState, ...parsed };
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

export function recordResult(progress, phraseId, deltaScore, stars) {
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
  saveProgress(next);
  return next;
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
