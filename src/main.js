import { loadProgress, recordResult, updateLastLevel, resetProgress } from './storage.js';

const ROLE_ORDER = ['GS', 'VERBE', 'GN'];
const ROLE_LABELS = {
  GS: 'Groupe sujet',
  VERBE: 'Verbe',
  GN: 'Groupe nominal'
};
const ROLE_MESSAGES = {
  GS: 'Le groupe sujet indique qui fait l\'action.',
  VERBE: 'Le verbe est le mot qui se conjugue.',
  GN: 'Le groupe nominal complète ou précise l\'action.'
};

const appState = {
  phrases: [],
  queue: [],
  currentIndex: 0,
  currentPhrase: null,
  assignments: new Map(),
  progress: loadProgress(),
  hasValidated: false
};

const elements = {
  screens: {
    home: document.getElementById('screen-home'),
    exercise: document.getElementById('screen-exercise')
  },
  levelButtons: Array.from(document.querySelectorAll('.level-btn')),
  resumePanel: document.getElementById('resume-panel'),
  backHome: document.getElementById('back-home'),
  homeScore: document.getElementById('home-score'),
  homeBest: document.getElementById('home-best'),
  homeStreak: document.getElementById('home-streak'),
  streakDisplay: document.getElementById('streak-display'),
  resetBtn: document.getElementById('reset-progress'),
  phraseText: document.getElementById('phrase-text'),
  dragArea: document.querySelector('.drag-area'),
  dragLabels: Array.from(document.querySelectorAll('.drag-label')),
  helpBtn: document.getElementById('help-btn'),
  validateBtn: document.getElementById('validate-btn'),
  nextBtn: document.getElementById('next-btn'),
  helpText: document.getElementById('help-text'),
  toast: document.getElementById('toast')
};

let dragState = null;

async function init() {
  await loadData();
  bindEvents();
  renderResume();
  updateScoreboard();
}

async function loadData() {
  try {
    const response = await fetch('data/phrases.json');
    const data = await response.json();
    appState.phrases = data;
  } catch (error) {
    console.error('Impossible de charger les phrases', error);
    elements.resumePanel.textContent = 'Erreur de chargement des données. Réessaie plus tard.';
  }
}

function bindEvents() {
  elements.levelButtons.forEach((button) => {
    button.addEventListener('click', () => {
      startSession(button.dataset.level);
    });
  });

  elements.backHome.addEventListener('click', () => {
    swapScreen('home');
    renderResume();
  });

  elements.resetBtn.addEventListener('click', onResetScores);

  elements.helpBtn.addEventListener('click', revealHint);
  elements.validateBtn.addEventListener('click', onValidate);
  elements.nextBtn.addEventListener('click', () => {
    loadNextPhrase();
  });

  elements.dragLabels.forEach((label) => {
    label.addEventListener('pointerdown', handleDragStart);
    label.addEventListener('pointermove', handleDragMove);
    label.addEventListener('pointerup', handleDragEnd);
    label.addEventListener('pointercancel', handleDragEnd);
  });
}

function startSession(level) {
  const levelFilter = level === 'all' ? null : Number(level);
  const available = levelFilter
    ? appState.phrases.filter((item) => item.level === levelFilter)
    : [...appState.phrases];
  if (!available.length) {
    showToast('Aucune phrase disponible pour ce niveau.');
    return;
  }
  appState.queue = shuffleArray(available);
  appState.currentIndex = 0;
  appState.currentPhrase = null;
  appState.assignments = new Map();
  appState.hasValidated = false;
  swapScreen('exercise');
  appState.progress = updateLastLevel(appState.progress, level);
  elements.helpText.textContent = 'Fais glisser chaque étiquette sur le bon groupe.';
  loadNextPhrase();
}

function swapScreen(target) {
  Object.entries(elements.screens).forEach(([key, section]) => {
    section.classList.toggle('active', key === target);
  });
}

function renderResume() {
  const { lastLevel, recentPhrases } = appState.progress;
  const lines = [];
  if (lastLevel) {
    const label = lastLevel === 'all' ? 'Révision libre' : `Niveau ${lastLevel}`;
    lines.push(`Dernier niveau joué : ${label}`);
  }
  if (recentPhrases && recentPhrases.length) {
    lines.push(`Dernières phrases : ${recentPhrases.slice(0, 5).join(', ')}`);
  }
  elements.resumePanel.textContent =
    lines.join(' • ') || 'Prêt à jouer ? Choisis un niveau pour commencer.';
}

function loadNextPhrase() {
  if (!appState.queue.length) return;
  const phrase = appState.queue[appState.currentIndex % appState.queue.length];
  appState.currentPhrase = phrase;
  appState.currentIndex += 1;
  appState.assignments = new Map();
  appState.hasValidated = false;
  elements.helpText.textContent = 'Dépose les étiquettes colorées sur les bons groupes.';
  elements.validateBtn.disabled = false;
  elements.nextBtn.disabled = true;
  renderPhrase(phrase);
}

function renderPhrase(phrase) {
  elements.phraseText.innerHTML = '';
  let segmentIndex = 0;
  phrase.parts.forEach((part) => {
    if (part.type === 'text') {
      const textNode = document.createTextNode(part.text);
      elements.phraseText.append(textNode);
      return;
    }
    const span = document.createElement('span');
    span.textContent = part.text;
    span.className = 'segment';
    span.dataset.correctRole = part.role;
    span.dataset.segmentIndex = String(segmentIndex);
    span.dataset.displayRole = '';
    elements.phraseText.append(span);
    segmentIndex += 1;
  });
}

function assignRole(index, role) {
  const segment = getSegmentElement(index);
  if (!segment) return;
  appState.assignments.set(index, role);
  setSegmentBadge(segment, role);
  segment.classList.add('assigned');
  segment.classList.remove('incorrect', 'correct', 'hint');
}

function getSegmentElement(index) {
  return elements.phraseText.querySelector(`.segment[data-segment-index="${index}"]`);
}

function revealHint() {
  if (!appState.currentPhrase) return;
  const verbSegment = elements.phraseText.querySelector(
    '.segment[data-correct-role="VERBE"]'
  );
  if (!verbSegment) return;
  verbSegment.classList.add('hint');
  setSegmentBadge(verbSegment, 'VERBE');
  elements.helpText.textContent = 'Indice : le verbe est déjà mis en avant.';
}

function onValidate() {
  if (appState.hasValidated) return;
  const segments = Array.from(elements.phraseText.querySelectorAll('.segment'));
  if (segments.length !== ROLE_ORDER.length) {
    console.warn('Phrase inattendue : nombre de segments différent de 3.');
  }
  const missing = segments.filter((segment) =>
    !appState.assignments.has(Number(segment.dataset.segmentIndex))
  );
  if (missing.length) {
    elements.helpText.textContent = 'Glisse chaque étiquette sur un groupe avant de valider.';
    return;
  }

  let correctCount = 0;
  const feedbackRoles = new Set();
  segments.forEach((segment) => {
    const idx = Number(segment.dataset.segmentIndex);
    const expected = segment.dataset.correctRole;
    const given = appState.assignments.get(idx);
    segment.classList.remove('assigned', 'hint');
    if (given === expected) {
      correctCount += 1;
      segment.classList.add('correct');
      setSegmentBadge(segment, expected);
    } else {
      segment.classList.add('incorrect');
      setSegmentBadge(segment, given);
      feedbackRoles.add(expected);
    }
  });

  const stars = correctCount;
  const deltaScore = correctCount;
  appState.progress = recordResult(
    appState.progress,
    appState.currentPhrase.id,
    deltaScore,
    stars
  );
  updateScoreboard();
  const messages = [];
  if (stars === 3) {
    messages.push('Bravo ! 3 étoiles ✨');
  } else if (stars === 0) {
    messages.push('Essaie encore, tu vas y arriver !');
  } else {
    messages.push(`${stars} étoile${stars > 1 ? 's' : ''} gagnée${stars > 1 ? 's' : ''}.`);
  }
  feedbackRoles.forEach((role) => {
    messages.push(ROLE_MESSAGES[role]);
  });
  showToast(messages.join(' '));
  elements.helpText.textContent = messages.slice(1).join(' ');
  elements.nextBtn.disabled = false;
  elements.validateBtn.disabled = true;
  appState.hasValidated = true;
}

function handleDragStart(event) {
  event.preventDefault();
  const label = event.currentTarget;
  label.setPointerCapture(event.pointerId);
  const ghost = createGhost(label, event.clientX, event.clientY);
  dragState = {
    pointerId: event.pointerId,
    role: label.dataset.role,
    ghost,
    source: label
  };
  label.classList.add('dragging');
}

function handleDragMove(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  event.preventDefault();
  moveGhost(dragState.ghost, event.clientX, event.clientY);
}

function handleDragEnd(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const { ghost, role, source } = dragState;
  source.classList.remove('dragging');
  source.releasePointerCapture(event.pointerId);
  moveGhost(ghost, event.clientX, event.clientY);
  ghost.remove();
  const dropTarget = document.elementFromPoint(event.clientX, event.clientY);
  if (dropTarget && dropTarget.classList.contains('segment') && !appState.hasValidated) {
    const idx = Number(dropTarget.dataset.segmentIndex);
    assignRole(idx, role);
  }
  dragState = null;
}

function createGhost(label, clientX, clientY) {
  const ghost = label.cloneNode(true);
  ghost.classList.add('dragging');
  ghost.style.position = 'fixed';
  ghost.style.pointerEvents = 'none';
  ghost.style.zIndex = '2000';
  document.body.appendChild(ghost);
  moveGhost(ghost, clientX, clientY);
  return ghost;
}

function moveGhost(ghost, clientX, clientY) {
  ghost.style.left = `${clientX}px`;
  ghost.style.top = `${clientY}px`;
  ghost.style.transform = 'translate(-50%, -50%) scale(1.02)';
}

function updateScoreboard() {
  const { totalScore = 0, streak = 0, bestScore = 0 } = appState.progress;
  if (elements.homeScore) {
    elements.homeScore.textContent = `Score total : ${totalScore}`;
  }
  if (elements.homeBest) {
    elements.homeBest.textContent = `Meilleur score : ${bestScore}`;
  }
  if (elements.homeStreak) {
    elements.homeStreak.textContent = `Série en cours : ${streak}`;
  }
  if (elements.streakDisplay) {
    elements.streakDisplay.textContent = `Série en cours : ${streak}`;
  }
}

function setSegmentBadge(segment, role) {
  segment.dataset.displayRole = role || '';
}

function onResetScores() {
  appState.progress = resetProgress();
  updateScoreboard();
  renderResume();
  showToast('Progression réinitialisée. Repars à la découverte des phrases !');
}

function showToast(message) {
  if (!message) return;
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  elements.toast.classList.add('show');
  setTimeout(() => {
    elements.toast.classList.remove('show');
    elements.toast.hidden = true;
  }, 2400);
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

init();
