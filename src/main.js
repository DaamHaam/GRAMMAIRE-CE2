import {
  loadProgress,
  recordResult,
  updateLastLevel,
  resetProgress,
  BADGE_LEVELS,
  BADGE_STREAKS,
  makeBadgeId
} from './storage.js';

const LEVEL_CONFIG = {
  1: { requiredRoles: ['VERB'], requireSubjectType: false },
  2: { requiredRoles: ['SUBJECT', 'VERB'], requireSubjectType: false },
  3: { requiredRoles: ['SUBJECT', 'VERB'], requireSubjectType: true },
  4: { requiredRoles: ['SUBJECT', 'VERB', 'COMPLEMENT'], requireSubjectType: true },
  5: { requiredRoles: ['SUBJECT', 'VERB', 'COMPLEMENT'], requireSubjectType: true },
  all: { requiredRoles: ['SUBJECT', 'VERB', 'COMPLEMENT'], requireSubjectType: true }
};

const LEVEL_INSTRUCTIONS = {
  1: "Glisse l'étiquette Verbe sur le mot qui se conjugue.",
  2: 'Associe le groupe sujet et le verbe aux bons groupes de la phrase.',
  3: 'Associe le groupe sujet et le verbe, puis indique si le sujet est un pronom ou un groupe nominal.',
  4: 'Associe groupe sujet, verbe et complément, puis précise la nature du sujet.',
  5: 'Décrypte des phrases complexes : groupe sujet, verbe, complément et nature du sujet.',
  all: 'Associe chaque étiquette au bon endroit dans la phrase.'
};

const LABEL_LIBRARY = {
  SUBJECT: {
    id: 'SUBJECT',
    kind: 'ROLE',
    value: 'SUBJECT',
    text: 'Groupe sujet',
    aria: 'Étiquette Groupe sujet'
  },
  VERB: {
    id: 'VERB',
    kind: 'ROLE',
    value: 'VERB',
    text: 'Verbe',
    aria: 'Étiquette Verbe'
  },
  COMPLEMENT: {
    id: 'COMPLEMENT',
    kind: 'ROLE',
    value: 'COMPLEMENT',
    text: 'Complément',
    aria: 'Étiquette Complément'
  },
  SUBJECT_TYPE_PRONOUN: {
    id: 'SUBJECT_TYPE_PRONOUN',
    kind: 'SUBJECT_TYPE',
    value: 'PRONOUN',
    text: 'Pronom',
    aria: 'Étiquette Pronom'
  },
  SUBJECT_TYPE_GN: {
    id: 'SUBJECT_TYPE_GN',
    kind: 'SUBJECT_TYPE',
    value: 'GN',
    text: 'Groupe nominal',
    aria: 'Étiquette Groupe nominal'
  }
};

const LABEL_ORDER = [
  'SUBJECT',
  'VERB',
  'COMPLEMENT',
  'SUBJECT_TYPE_PRONOUN',
  'SUBJECT_TYPE_GN'
];

const LABELS_BY_KIND_VALUE = new Map();
Object.values(LABEL_LIBRARY).forEach((label) => {
  LABELS_BY_KIND_VALUE.set(`${label.kind}-${label.value}`, label);
});

const SUBJECTS = {
  GRAMMAR: 'grammar',
  MATH: 'math'
};

const MATH_LEVEL_LABELS = {
  1: 'Niveau 1 – Logique rapide',
  2: 'Niveau 2 – Suites logiques'
};

const ROLE_VISUAL_CLASSES = ['role-SUBJECT', 'role-VERB', 'role-COMPLEMENT'];
const SUBJECT_TYPE_VISUAL_CLASSES = ['subject-pronoun', 'subject-gn'];

const SLOT_FEEDBACK = {
  ROLE: {
    SUBJECT: {
      success: 'Groupe sujet trouvé !',
      reminder: "Le groupe sujet indique qui fait l'action."
    },
    VERB: {
      success: 'Verbe identifié !',
      reminder: 'Le verbe est le mot qui se conjugue.'
    },
    COMPLEMENT: {
      success: 'Complément repéré !',
      reminder: 'Le complément précise le lieu ou le moment.'
    }
  },
  SUBJECT_TYPE: {
    PRONOUN: {
      success: 'Bravo, tu as reconnu un pronom.',
      reminder: 'Un pronom remplace un nom déjà connu.'
    },
    GN: {
      success: 'Bravo, c’est un groupe nominal.',
      reminder: 'Un groupe nominal est construit autour d’un nom.'
    }
  }
};

const BADGE_DEFINITIONS = BADGE_LEVELS.flatMap((level) =>
  BADGE_STREAKS.map((threshold) => ({
    id: makeBadgeId(level, threshold),
    level,
    threshold,
    title: `Niveau ${level} · ${threshold} phrases parfaites`,
    description: `Enchaîne ${threshold} phrases sans erreur au niveau ${level}.`
  }))
);

const BADGE_DEFINITION_BY_ID = new Map(
  BADGE_DEFINITIONS.map((badge) => [badge.id, badge])
);

const appState = {
  phrases: [],
  queue: [],
  currentIndex: 0,
  currentPhrase: null,
  slots: new Map(),
  progress: loadProgress(),
  hasValidated: false,
  activeLevel: '1',
  requirements: LEVEL_CONFIG[1],
  instruction: LEVEL_INSTRUCTIONS[1],
  subjectTypePrompt: null,
  subjectTypeSelection: null,
  currentSubjectTypeAnswer: null,
  subject: SUBJECTS.GRAMMAR,
  math: {
    levels: new Map(),
    currentLevel: null,
    queue: [],
    queueIndex: 0,
    currentQuestion: null,
    currentQuestionNumber: 0,
    selectedOptionIndex: null,
    selectedOptionValue: null,
    dropZoneElement: null,
    hasValidated: false,
    score: { correct: 0, total: 0 },
    lastLevel: null
  }
};

const elements = {
  screens: {
    home: document.getElementById('screen-home'),
    exercise: document.getElementById('screen-exercise'),
    math: document.getElementById('screen-math')
  },
  levelButtons: Array.from(document.querySelectorAll('.level-btn')),
  subjectButtons: Array.from(document.querySelectorAll('.subject-btn')),
  grammarPanel: document.getElementById('grammar-panel'),
  mathPanel: document.getElementById('math-panel'),
  resumePanel: document.getElementById('resume-panel'),
  backHome: document.getElementById('back-home'),
  backHomeMath: document.getElementById('back-home-math'),
  homeScore: document.getElementById('home-score'),
  homeBest: document.getElementById('home-best'),
  homeStreak: document.getElementById('home-streak'),
  badgeGrid: document.getElementById('badge-grid'),
  badgeHelp: document.getElementById('badge-help'),
  streakDisplay: document.getElementById('streak-display'),
  resetBtn: document.getElementById('reset-progress'),
  phraseText: document.getElementById('phrase-text'),
  subjectPrompt: document.getElementById('subject-type-prompt'),
  subjectPromptLabel: document.getElementById('subject-type-label'),
  subjectPromptOptions: Array.from(
    document.querySelectorAll('#subject-type-prompt [data-subject-type]')
  ),
  dragArea: document.getElementById('drag-area'),
  helpBtn: document.getElementById('help-btn'),
  validateBtn: document.getElementById('validate-btn'),
  nextBtn: document.getElementById('next-btn'),
  helpText: document.getElementById('help-text'),
  toast: document.getElementById('toast'),
  mathLevelButtons: Array.from(document.querySelectorAll('.math-level-btn')),
  mathResume: document.getElementById('math-resume'),
  mathScore: document.getElementById('math-score'),
  mathLevelTitle: document.getElementById('math-level-title'),
  mathQuestion: document.getElementById('math-question'),
  mathSequence: document.getElementById('math-sequence'),
  mathOptions: document.getElementById('math-options'),
  mathFeedback: document.getElementById('math-feedback'),
  mathValidate: document.getElementById('math-validate'),
  mathNext: document.getElementById('math-next'),
  mathHint: document.getElementById('math-hint'),
  mathProgress: document.getElementById('math-progress')
};
let dragState = null;

function requestFullscreenIfSupported() {
  const isStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  if (isStandalone) return;
  if (document.fullscreenElement) return;
  const root = document.documentElement;
  if (!root || typeof root.requestFullscreen !== 'function') return;
  root.requestFullscreen().catch(() => {
    // Ignorer les erreurs (refus utilisateur ou navigateur)
  });
}

async function init() {
  await loadData();
  bindEvents();
  setSubject(appState.subject);
  renderResume();
  updateScoreboard();
  updateMathScoreboard();
  updateMathResume();
  registerServiceWorker();
}

async function loadData() {
  try {
    const response = await fetch('data/phrases.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    appState.phrases = data;
  } catch (error) {
    console.error('Impossible de charger les phrases', error);
    elements.resumePanel.textContent = 'Erreur de chargement des données. Réessaie plus tard.';
  }
  try {
    const mathResponse = await fetch('data/maths.json');
    if (!mathResponse.ok) {
      return;
    }
    const mathData = await mathResponse.json();
    loadMathData(mathData);
  } catch (error) {
    console.warn('Impossible de charger les exercices de mathématiques', error);
  }
}

function loadMathData(data) {
  if (!data || typeof data !== 'object') return;
  const { math } = appState;
  const level1 = Array.isArray(data.level1) ? data.level1 : [];
  const level2 = Array.isArray(data.level2) ? data.level2 : [];
  math.levels.set('1', level1);
  math.levels.set('2', level2);
}

function bindEvents() {
  elements.levelButtons.forEach((button) => {
    button.addEventListener('click', () => {
      startSession(button.dataset.level);
    });
  });

  elements.subjectButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setSubject(button.dataset.subject);
    });
  });

  elements.mathLevelButtons.forEach((button) => {
    button.addEventListener('click', () => {
      startMathSession(button.dataset.mathLevel);
    });
  });

  elements.backHome.addEventListener('click', () => {
    swapScreen('home');
    renderResume();
  });

  if (elements.backHomeMath) {
    elements.backHomeMath.addEventListener('click', () => {
      setSubject(SUBJECTS.MATH);
      swapScreen('home');
      updateMathResume();
    });
  }

  elements.resetBtn.addEventListener('click', onResetScores);
  elements.helpBtn.addEventListener('click', revealHint);
  elements.validateBtn.addEventListener('click', onValidate);
  elements.nextBtn.addEventListener('click', () => {
    loadNextPhrase();
  });

  if (elements.mathValidate) {
    elements.mathValidate.addEventListener('click', onMathValidate);
  }
  if (elements.mathNext) {
    elements.mathNext.addEventListener('click', () => {
      loadNextMathQuestion();
    });
  }
  if (elements.mathHint) {
    elements.mathHint.addEventListener('click', showMathHint);
  }

  elements.subjectPromptOptions.forEach((button) => {
    button.addEventListener('click', () => {
      onSubjectTypeSelect(button.dataset.subjectType);
    });
  });

  updateSubjectTypeButtons(null);
}

function setSubject(subject) {
  const normalized = subject === SUBJECTS.MATH ? SUBJECTS.MATH : SUBJECTS.GRAMMAR;
  appState.subject = normalized;
  elements.subjectButtons.forEach((button) => {
    const isActive = button.dataset.subject === normalized;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });
  togglePanelVisibility(elements.grammarPanel, normalized === SUBJECTS.GRAMMAR);
  togglePanelVisibility(elements.mathPanel, normalized === SUBJECTS.MATH);
}

function togglePanelVisibility(panel, shouldShow) {
  if (!panel) return;
  panel.hidden = !shouldShow;
  panel.setAttribute('aria-hidden', String(!shouldShow));
}

function updateMathScoreboard() {
  if (!elements.mathScore) return;
  const {
    math: {
      score: { correct, total }
    }
  } = appState;
  const successLabel = correct > 1 ? 'réussites' : 'réussite';
  const totalLabel = total > 1 ? 'exercices' : 'exercice';
  const text = total
    ? `${correct} ${successLabel} sur ${total} ${totalLabel}.`
    : '0 réussite sur 0 exercice.';
  elements.mathScore.textContent = text;
}

function updateMathResume() {
  if (!elements.mathResume) return;
  const { lastLevel } = appState.math;
  if (!lastLevel) {
    elements.mathResume.textContent = 'Prêt à résoudre quelques énigmes ?';
    return;
  }
  const label = MATH_LEVEL_LABELS[Number(lastLevel)] || `Niveau ${lastLevel}`;
  elements.mathResume.textContent = `Dernier niveau ouvert : ${label}.`;
}

function startMathSession(level) {
  const normalizedLevel = level && level.toString ? level.toString() : String(level);
  const levelData = appState.math.levels.get(normalizedLevel) || [];
  if (!levelData.length) {
    showToast('Aucun exercice disponible pour ce niveau.');
    return;
  }
  appState.math.currentLevel = normalizedLevel;
  appState.math.lastLevel = normalizedLevel;
  appState.math.queue = shuffleArray([...levelData]);
  appState.math.queueIndex = 0;
  appState.math.currentQuestion = null;
  appState.math.currentQuestionNumber = 0;
  appState.math.selectedOptionIndex = null;
  appState.math.selectedOptionValue = null;
  appState.math.dropZoneElement = null;
  appState.math.hasValidated = false;
  setSubject(SUBJECTS.MATH);
  swapScreen('math');
  requestFullscreenIfSupported();
  loadNextMathQuestion();
  updateMathResume();
}

function loadNextMathQuestion() {
  const { math } = appState;
  const levelData = math.levels.get(math.currentLevel) || [];
  if (!levelData.length) {
    setMathFeedback("Pas d'exercice disponible pour le moment.");
    return;
  }
  if (!math.queue.length) {
    math.queue = shuffleArray([...levelData]);
    math.queueIndex = 0;
  }
  if (math.queueIndex >= math.queue.length) {
    math.queue = shuffleArray([...levelData]);
    math.queueIndex = 0;
  }
  const question = math.queue[math.queueIndex];
  math.queueIndex += 1;
  math.currentQuestionNumber = math.queueIndex;
  math.currentQuestion = question;
  math.selectedOptionIndex = null;
  math.selectedOptionValue = null;
  math.dropZoneElement = null;
  math.hasValidated = false;
  if (elements.mathValidate) {
    elements.mathValidate.disabled = true;
  }
  if (elements.mathNext) {
    elements.mathNext.disabled = true;
  }
  if (elements.mathHint) {
    const hint = getMathHint(question);
    elements.mathHint.disabled = !hint;
  }
  setMathFeedback('', null);
  renderMathQuestion(question);
  updateMathProgress();
}

function renderMathQuestion(question) {
  if (!question) return;
  const levelNumber = Number(appState.math.currentLevel);
  if (elements.mathLevelTitle) {
    elements.mathLevelTitle.textContent =
      MATH_LEVEL_LABELS[levelNumber] || 'Exercices de mathématiques';
  }
  if (levelNumber === 1) {
    renderMathLevel1(question);
  } else {
    renderMathLevel2(question);
  }
}

function renderMathLevel1(question) {
  if (!elements.mathQuestion || !elements.mathOptions) return;
  elements.mathQuestion.hidden = false;
  elements.mathQuestion.textContent = question.question;
  if (elements.mathSequence) {
    elements.mathSequence.hidden = true;
    elements.mathSequence.innerHTML = '';
  }
  elements.mathOptions.innerHTML = '';
  (question.options || []).forEach((option, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'math-option';
    button.dataset.index = String(index);
    button.dataset.value = option;
    button.textContent = option;
    button.addEventListener('click', () => {
      onMathOptionSelect(index);
    });
    elements.mathOptions.append(button);
  });
  highlightMathOption();
}

function renderMathLevel2(question) {
  if (!elements.mathQuestion || !elements.mathSequence || !elements.mathOptions) return;
  elements.mathQuestion.hidden = false;
  elements.mathQuestion.textContent = question.prompt;
  elements.mathSequence.hidden = false;
  elements.mathSequence.innerHTML = '';
  appState.math.dropZoneElement = null;
  (question.sequence || []).forEach((value) => {
    const item = document.createElement('span');
    item.className = value === null || value === undefined ? 'sequence-item' : 'sequence-item filled';
    if (value === null || value === undefined) {
      item.textContent = '?';
      item.dataset.dropZone = 'true';
      item.addEventListener('dragover', handleMathDragOver);
      item.addEventListener('dragleave', handleMathDragLeave);
      item.addEventListener('drop', handleMathDrop);
      item.addEventListener('click', clearMathDropZone);
      appState.math.dropZoneElement = item;
    } else {
      item.textContent = value;
    }
    elements.mathSequence.append(item);
  });
  elements.mathOptions.innerHTML = '';
  (question.options || []).forEach((option, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'math-option';
    button.dataset.index = String(index);
    button.dataset.value = option;
    button.textContent = option;
    button.draggable = true;
    button.addEventListener('click', () => {
      placeMathValue(option, index);
    });
    button.addEventListener('dragstart', (event) => handleMathDragStart(event, button));
    button.addEventListener('dragend', handleMathDragEnd);
    elements.mathOptions.append(button);
  });
  highlightMathOption();
}

function onMathOptionSelect(index) {
  const question = appState.math.currentQuestion;
  if (!question) return;
  appState.math.selectedOptionIndex = index;
  appState.math.selectedOptionValue = question.options[index];
  highlightMathOption();
  if (elements.mathValidate) {
    elements.mathValidate.disabled = false;
  }
  setMathFeedback('', null);
}

function placeMathValue(value, index) {
  if (!appState.math.dropZoneElement) return;
  const question = appState.math.currentQuestion;
  if (!question) return;
  let resolvedIndex = index;
  if (resolvedIndex === undefined || resolvedIndex === null) {
    resolvedIndex = (question.options || []).findIndex((option) => option === value);
  }
  if (resolvedIndex === -1) {
    resolvedIndex = null;
  }
  appState.math.selectedOptionIndex = resolvedIndex;
  appState.math.selectedOptionValue = value;
  appState.math.dropZoneElement.textContent = value;
  appState.math.dropZoneElement.classList.add('filled');
  highlightMathOption();
  if (elements.mathValidate) {
    elements.mathValidate.disabled = false;
  }
  setMathFeedback('', null);
}

function highlightMathOption() {
  if (!elements.mathOptions) return;
  const options = Array.from(elements.mathOptions.querySelectorAll('.math-option'));
  const selectedIndex =
    appState.math.selectedOptionIndex !== null ? Number(appState.math.selectedOptionIndex) : null;
  const selectedValue =
    appState.math.selectedOptionValue !== null && appState.math.selectedOptionValue !== undefined
      ? String(appState.math.selectedOptionValue)
      : null;
  options.forEach((option) => {
    const optionIndex = Number(option.dataset.index);
    const optionValue = option.dataset.value;
    const matchesIndex = selectedIndex !== null && optionIndex === selectedIndex;
    const matchesValue = selectedValue !== null && optionValue === selectedValue;
    option.classList.toggle('selected', matchesIndex || matchesValue);
  });
}

function onMathValidate() {
  const { math } = appState;
  const question = math.currentQuestion;
  if (!question || math.hasValidated) return;
  const levelNumber = Number(math.currentLevel);
  if (levelNumber === 1) {
    const selectedIndex = math.selectedOptionIndex;
    if (selectedIndex === null || selectedIndex === undefined) {
      return;
    }
    const isCorrect = Number(selectedIndex) === Number(question.answerIndex);
    if (!isCorrect) {
      setMathFeedback('Essaie encore ! Utilise le bon calcul.', 'error');
      return;
    }
    finalizeMathSuccess(`Bravo ! ${question.explanation || ''}`.trim());
    disableMathOptions();
    return;
  }

  const value = math.selectedOptionValue;
  if (!value) return;
  const isCorrect = value === question.answer;
  if (!isCorrect) {
    setMathFeedback('Essaie encore ! Observe le rythme de la suite.', 'error');
    return;
  }
  finalizeMathSuccess(`Bravo ! ${question.hint || 'Tu as trouvé la régularité.'}`.trim());
  disableMathOptions();
}

function finalizeMathSuccess(message) {
  const { math } = appState;
  math.hasValidated = true;
  math.score.total += 1;
  math.score.correct += 1;
  updateMathScoreboard();
  setMathFeedback(message, 'success');
  if (elements.mathValidate) {
    elements.mathValidate.disabled = true;
  }
  if (elements.mathNext) {
    elements.mathNext.disabled = false;
  }
  if (elements.mathHint) {
    elements.mathHint.disabled = true;
  }
}

function disableMathOptions() {
  if (!elements.mathOptions) return;
  Array.from(elements.mathOptions.querySelectorAll('.math-option')).forEach((option) => {
    option.disabled = true;
    option.draggable = false;
  });
}

function showMathHint() {
  const question = appState.math.currentQuestion;
  if (!question || appState.math.hasValidated) {
    return;
  }
  const hint = getMathHint(question);
  if (!hint) return;
  setMathFeedback(hint, null);
}

function getMathHint(question) {
  if (!question) return '';
  if (Number(appState.math.currentLevel) === 1) {
    return question.hint || '';
  }
  return question.hint || '';
}

function updateMathProgress() {
  if (!elements.mathProgress) return;
  const { math } = appState;
  const total = math.queue.length || (math.levels.get(math.currentLevel) || []).length;
  if (!total || !math.currentQuestionNumber) {
    elements.mathProgress.textContent = '0 / 0';
    return;
  }
  elements.mathProgress.textContent = `Question ${math.currentQuestionNumber} / ${total}`;
}

function setMathFeedback(message, status) {
  if (!elements.mathFeedback) return;
  elements.mathFeedback.textContent = message || '';
  elements.mathFeedback.classList.remove('success', 'error');
  if (status === 'success') {
    elements.mathFeedback.classList.add('success');
  }
  if (status === 'error') {
    elements.mathFeedback.classList.add('error');
  }
}

function handleMathDragStart(event, button) {
  if (!event.dataTransfer) return;
  const payload = {
    value: button.dataset.value,
    index: button.dataset.index
  };
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', JSON.stringify(payload));
  button.classList.add('dragging');
}

function handleMathDragEnd(event) {
  const target = event.target;
  if (target && target.classList) {
    target.classList.remove('dragging');
  }
}

function handleMathDragOver(event) {
  event.preventDefault();
  const target = event.currentTarget;
  if (target && target.classList) {
    target.classList.add('drag-over');
  }
}

function handleMathDragLeave(event) {
  const target = event.currentTarget;
  if (target && target.classList) {
    target.classList.remove('drag-over');
  }
}

function handleMathDrop(event) {
  event.preventDefault();
  const target = event.currentTarget;
  if (target && target.classList) {
    target.classList.remove('drag-over');
  }
  let payload;
  try {
    payload = JSON.parse(event.dataTransfer.getData('text/plain'));
  } catch (error) {
    payload = { value: event.dataTransfer.getData('text/plain') };
  }
  if (!payload || !payload.value) return;
  placeMathValue(payload.value, payload.index !== undefined ? Number(payload.index) : null);
}

function clearMathDropZone() {
  if (!appState.math.dropZoneElement) return;
  if (!appState.math.selectedOptionValue) return;
  appState.math.dropZoneElement.textContent = '?';
  appState.math.dropZoneElement.classList.remove('filled');
  appState.math.selectedOptionIndex = null;
  appState.math.selectedOptionValue = null;
  highlightMathOption();
  if (elements.mathValidate) {
    elements.mathValidate.disabled = true;
  }
  setMathFeedback('', null);
}

function startSession(level) {
  const levelKey = LEVEL_CONFIG[level] ? level : 'all';
  appState.activeLevel = level;
  appState.requirements = LEVEL_CONFIG[levelKey];
  appState.instruction = LEVEL_INSTRUCTIONS[levelKey] || LEVEL_INSTRUCTIONS.all;

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
  appState.slots = new Map();
  appState.hasValidated = false;
  swapScreen('exercise');
  requestFullscreenIfSupported();
  appState.progress = updateLastLevel(appState.progress, level);
  loadNextPhrase();
}

function swapScreen(target) {
  Object.entries(elements.screens).forEach(([key, section]) => {
    section.classList.toggle('active', key === target);
  });
  document.body.classList.toggle('exercise-active', target === 'exercise' || target === 'math');
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
  appState.slots = new Map();
  appState.hasValidated = false;
  clearSubjectTypePrompt();
  appState.subjectTypeSelection = null;
  elements.validateBtn.disabled = false;
  elements.nextBtn.disabled = true;
  elements.helpText.textContent = appState.instruction;
  renderPhrase(phrase);
  renderLabels(phrase);
}

function renderPhrase(phrase) {
  elements.phraseText.innerHTML = '';
  appState.currentSubjectTypeAnswer = null;
  phrase.parts.forEach((part, index) => {
    if (part.type === 'text') {
      elements.phraseText.append(document.createTextNode(part.text));
      return;
    }
    const segment = document.createElement('span');
    segment.textContent = part.text;
    segment.className = 'segment';
    segment.dataset.segmentIndex = String(index);
    segment.dataset.role = part.role;
    const requiresRole = shouldRequireRole(part.role);
    const slotId = `segment-${index}-role`;
    segment.dataset.slotId = slotId;
    segment.dataset.slotType = 'ROLE';
    segment.dataset.expectedValue = part.role;
    segment.dataset.required = String(requiresRole);
    if (part.role === 'SUBJECT' && part.subjectType) {
      appState.currentSubjectTypeAnswer = part.subjectType;
    }
    segment.addEventListener('click', () => onSegmentClick(segment));
    appState.slots.set(slotId, {
      id: slotId,
      kind: 'ROLE',
      expected: part.role,
      assigned: null,
      element: segment,
      subjectType: part.subjectType || null,
      required: requiresRole
    });

    elements.phraseText.append(segment);
  });
}

function onSegmentClick(segment) {
  if (!segment || !appState.requirements.requireSubjectType) return;
  const slotId = segment.dataset.slotId;
  const slot = appState.slots.get(slotId);
  if (!slot || slot.kind !== 'ROLE') return;
  if (slot.assigned === 'SUBJECT') {
    showSubjectTypePrompt(slot);
  }
}

function shouldRequireRole(role) {
  const { requiredRoles } = appState.requirements || {};
  if (!requiredRoles) return false;
  return requiredRoles.includes(role);
}

function renderLabels(phrase) {
  elements.dragArea.innerHTML = '';
  const activeIds = new Set();
  const segmentRoles = new Set(
    phrase.parts
      .filter((part) => part.type === 'segment')
      .map((part) => part.role)
  );
  const { requiredRoles, requireSubjectType } = appState.requirements;
  requiredRoles.forEach((role) => {
    if (segmentRoles.has(role)) {
      activeIds.add(role);
    }
  });
  const fragment = document.createDocumentFragment();
  LABEL_ORDER.forEach((id) => {
    if (!activeIds.has(id)) return;
    const definition = LABEL_LIBRARY[id];
    const label = createDragLabel(definition);
    fragment.append(label);
  });
  elements.dragArea.append(fragment);
}

function openSubjectPrompt() {
  const { subjectPrompt } = elements;
  if (!subjectPrompt) return;
  subjectPrompt.hidden = false;
  subjectPrompt.removeAttribute('aria-hidden');
}

function closeSubjectPrompt() {
  const { subjectPrompt } = elements;
  if (!subjectPrompt) return;
  subjectPrompt.hidden = true;
  subjectPrompt.setAttribute('aria-hidden', 'true');
}

function createDragLabel(definition) {
  const label = document.createElement('div');
  label.className = 'drag-label';
  label.dataset.labelId = definition.id;
  label.dataset.kind = definition.kind;
  label.dataset.value = definition.value;
  label.textContent = definition.text;
  label.setAttribute('aria-label', definition.aria);
  label.addEventListener('pointerdown', (event) => handleDragStart(event, label));
  label.addEventListener('pointermove', handleDragMove);
  label.addEventListener('pointerup', handleDragEnd);
  label.addEventListener('pointercancel', handleDragEnd);
  return label;
}

function showSubjectTypePrompt(slot) {
  if (!appState.requirements.requireSubjectType) return;
  const expectedType = appState.currentSubjectTypeAnswer || slot.subjectType;
  if (!expectedType) return;

  const previousSegment = appState.subjectTypePrompt?.segment;
  if (previousSegment && previousSegment !== slot.element) {
    setSubjectTypeVisual(previousSegment, null);
  }

  const slotId = 'subject-type-slot';
  const { subjectPrompt } = elements;
  let typeSlot = appState.slots.get(slotId);
  if (!typeSlot) {
    typeSlot = {
      id: slotId,
      kind: 'SUBJECT_TYPE',
      expected: expectedType,
      assigned: null,
      element: subjectPrompt,
      segment: slot.element,
      required: true
    };
  } else {
    typeSlot.expected = expectedType;
    typeSlot.segment = slot.element;
    typeSlot.element = subjectPrompt;
  }
  typeSlot.assigned = appState.subjectTypeSelection;
  appState.slots.set(slotId, typeSlot);

  openSubjectPrompt();
  subjectPrompt.classList.remove('correct', 'incorrect', 'hint');

  appState.subjectTypePrompt = { slotId, segment: slot.element };
  updateSubjectTypeButtons(appState.subjectTypeSelection);

  if (appState.subjectTypeSelection) {
    setSubjectTypeVisual(slot.element, appState.subjectTypeSelection);
  } else {
    setSubjectTypeVisual(slot.element, null);
  }
}

function clearSubjectTypePrompt(options = {}) {
  const { preserveSelection = false } = options;
  if (appState.subjectTypePrompt) {
    setSubjectTypeVisual(appState.subjectTypePrompt.segment, null);
    appState.slots.delete(appState.subjectTypePrompt.slotId);
  }
  if (!preserveSelection) {
    appState.subjectTypeSelection = null;
  }
  const { subjectPrompt } = elements;
  closeSubjectPrompt();
  subjectPrompt.classList.remove('correct', 'incorrect', 'hint');
  if (!preserveSelection) {
    updateSubjectTypeButtons(null);
  }
  appState.subjectTypePrompt = null;
}

function updateSubjectTypeButtons(selected) {
  elements.subjectPromptOptions.forEach((button) => {
    const isActive = button.dataset.subjectType === selected;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function onSubjectTypeSelect(value) {
  if (!value) return;
  const promptState = appState.subjectTypePrompt;
  if (!promptState) return;
  const slot = appState.slots.get(promptState.slotId);
  if (!slot) return;
  appState.subjectTypeSelection = value;
  slot.assigned = value;
  slot.element.classList.remove('incorrect', 'correct', 'hint');
  updateSubjectTypeButtons(value);
  setSubjectTypeVisual(promptState.segment, value);
  closeSubjectPrompt();
}

function revealHint() {
  if (!appState.currentPhrase) return;
  const slots = Array.from(appState.slots.values());
  let target = slots.find((slot) => slot.kind === 'ROLE' && slot.expected === 'VERB');
  if (!target || target.assigned) {
    target = slots.find((slot) => !slot.assigned);
  }
  if (!target) return;
  const label = getLabelByKindAndValue(target.kind, target.expected);
  if (label) {
    if (target.kind === 'ROLE') {
      setRoleVisual(target.element, label.value);
    } else if (target.kind === 'SUBJECT_TYPE') {
      target.assigned = label.value;
      appState.subjectTypeSelection = label.value;
      updateSubjectTypeButtons(label.value);
      target.element.classList.add('assigned');
      setSubjectTypeVisual(target.segment, label.value);
      openSubjectPrompt();
    }
  }
  target.element.classList.add('hint');
  elements.helpText.textContent = `Indice : repère ${label ? label.text.toLowerCase() : 'cet élément'}.`;
}

function onValidate() {
  if (appState.hasValidated) return;
  const slots = Array.from(appState.slots.values());
  const requiredSlots = slots.filter((slot) => slot.required !== false);
  const missing = requiredSlots.filter((slot) => !slot.assigned);
  if (missing.length) {
    elements.helpText.textContent =
      "Glisse toutes les étiquettes sur la phrase avant de valider.";
    return;
  }

  let correctCount = 0;
  const slotMessages = [];
  requiredSlots.forEach((slot) => {
    const isCorrect = slot.assigned === slot.expected;
    const expectedLabel = getLabelByKindAndValue(slot.kind, slot.expected);
    const assignedLabel = getLabelByKindAndValue(slot.kind, slot.assigned);
    slot.element.classList.remove('hint');
    slot.element.classList.toggle('correct', isCorrect);
    slot.element.classList.toggle('incorrect', !isCorrect);

    if (slot.kind === 'ROLE') {
      const visualRole = isCorrect ? slot.assigned : slot.expected;
      setRoleVisual(slot.element, visualRole);
    } else if (slot.kind === 'SUBJECT_TYPE') {
      const visualType = isCorrect ? slot.assigned : slot.expected;
      if (isCorrect) {
        appState.subjectTypeSelection = slot.assigned;
      } else {
        appState.subjectTypeSelection = slot.expected;
      }
      if (visualType) {
        setSubjectTypeVisual(slot.segment, visualType);
      }
      updateSubjectTypeButtons(appState.subjectTypeSelection);
      if (!isCorrect) {
        openSubjectPrompt();
      }
    }

    if (isCorrect) {
      correctCount += 1;
      const message = SLOT_FEEDBACK[slot.kind][slot.expected]?.success || 'Bien joué !';
      slotMessages.push(`✓ ${message}`);
    } else {
      const reminder = SLOT_FEEDBACK[slot.kind][slot.expected]?.reminder || 'Observe la phrase attentivement.';
      slotMessages.push(`✗ ${reminder}`);
      if (slot.kind === 'ROLE') {
        setRoleVisual(slot.element, slot.expected);
      }
    }
  });

  const optionalAssigned = slots.filter((slot) => slot.required === false && slot.assigned);
  optionalAssigned.forEach((slot) => {
    slot.element.classList.remove('hint');
    slot.element.classList.add('incorrect');
    slot.element.classList.remove('assigned');
    setRoleVisual(slot.element, null);
    slot.assigned = null;
    slotMessages.push('✗ Ce groupe n’est pas à identifier dans ce niveau.');
  });

  const totalSlots = requiredSlots.length || 1;
  const accuracy = correctCount / totalSlots;
  let stars = 0;
  if (accuracy === 1) {
    stars = 3;
  } else if (accuracy >= 0.66) {
    stars = 2;
  } else if (accuracy > 0) {
    stars = 1;
  }

  const deltaScore = correctCount;
  const { progress, unlockedBadges } = recordResult(
    appState.progress,
    appState.currentPhrase.id,
    deltaScore,
    stars,
    { level: appState.activeLevel }
  );
  appState.progress = progress;
  updateScoreboard();
  if (unlockedBadges.length) {
    highlightUnlockedBadges(unlockedBadges);
    announceBadgeUnlock(unlockedBadges);
  }

  elements.helpText.innerHTML = slotMessages.join('<br />');
  elements.nextBtn.disabled = false;
  elements.validateBtn.disabled = true;
  appState.hasValidated = true;
}

function handleDragStart(event, label) {
  event.preventDefault();
  const definition = LABEL_LIBRARY[label.dataset.labelId];
  if (!definition) return;
  label.setPointerCapture(event.pointerId);
  const ghost = createGhost(label, event.clientX, event.clientY);
  dragState = {
    pointerId: event.pointerId,
    labelId: definition.id,
    kind: definition.kind,
    value: definition.value,
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
  const { ghost, source } = dragState;
  source.classList.remove('dragging');
  source.releasePointerCapture(event.pointerId);
  moveGhost(ghost, event.clientX, event.clientY);
  ghost.remove();
  if (!appState.hasValidated) {
    const dropTarget = document.elementFromPoint(event.clientX, event.clientY);
    const slotElement = dropTarget ? dropTarget.closest('[data-slot-id]') : null;
    if (slotElement) {
      const definition = LABEL_LIBRARY[dragState.labelId];
      assignToSlot(slotElement, definition);
    }
  }
  dragState = null;
}

function assignToSlot(slotElement, label) {
  const slotId = slotElement.dataset.slotId;
  const slot = appState.slots.get(slotId);
  if (!slot) return;
  if (slot.kind !== label.kind) {
    slotElement.classList.add('shake');
    setTimeout(() => slotElement.classList.remove('shake'), 300);
    showToast("Cette étiquette ne correspond pas à cette case.");
    return;
  }
  appState.slots.forEach((otherSlot, otherId) => {
    if (otherId === slotId || otherSlot.kind !== label.kind) return;
    if (otherSlot.assigned === label.value) {
      otherSlot.assigned = null;
      otherSlot.element.classList.remove('assigned', 'correct', 'incorrect', 'hint');
      if (otherSlot.kind === 'ROLE') {
        setRoleVisual(otherSlot.element, null);
        if (
          label.value === 'SUBJECT' &&
          appState.subjectTypePrompt?.segment === otherSlot.element
        ) {
          clearSubjectTypePrompt({ preserveSelection: true });
        }
      } else if (otherSlot.kind === 'SUBJECT_TYPE') {
        setSubjectTypeVisual(otherSlot.segment, null);
      }
    }
  });
  slot.assigned = label.value;
  slot.element.classList.remove('incorrect', 'correct', 'hint');
  if (slot.kind === 'ROLE') {
    setRoleVisual(slot.element, label.value);
    slot.element.classList.add('assigned');
    if (label.value === 'SUBJECT') {
      if (appState.requirements.requireSubjectType) {
        if (appState.subjectTypePrompt && appState.subjectTypePrompt.segment !== slot.element) {
          clearSubjectTypePrompt({ preserveSelection: true });
        }
        showSubjectTypePrompt(slot);
      } else {
        clearSubjectTypePrompt();
      }
    } else if (
      appState.subjectTypePrompt &&
      appState.subjectTypePrompt.segment === slot.element
    ) {
      clearSubjectTypePrompt();
    }
  } else if (slot.kind === 'SUBJECT_TYPE') {
    setSubjectTypeVisual(slot.segment, label.value);
  }
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

function setRoleVisual(element, role) {
  ROLE_VISUAL_CLASSES.forEach((cls) => element.classList.remove(cls));
  if (role) {
    element.classList.add(`role-${role}`);
  }
}

function setSubjectTypeVisual(segment, type) {
  if (!segment) return;
  SUBJECT_TYPE_VISUAL_CLASSES.forEach((cls) => segment.classList.remove(cls));
  if (type === 'PRONOUN') {
    segment.classList.add('subject-pronoun');
  } else if (type === 'GN') {
    segment.classList.add('subject-gn');
  }
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
  renderBadges();
}

function getLabelByKindAndValue(kind, value) {
  return LABELS_BY_KIND_VALUE.get(`${kind}-${value}`) || null;
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

function getBadgeDefinition(id) {
  return BADGE_DEFINITION_BY_ID.get(id) || null;
}

function renderBadges() {
  if (!elements.badgeGrid) return;

  const container = elements.badgeGrid;
  const badgesState = (appState.progress && appState.progress.badges) || {};
  container.innerHTML = '';
  container.setAttribute('role', 'list');

  let unlockedCount = 0;

  BADGE_DEFINITIONS.forEach((badge) => {
    const unlockedAt = badgesState[badge.id];
    const unlocked = Boolean(unlockedAt);
    if (unlocked) {
      unlockedCount += 1;
    }

    const card = document.createElement('div');
    card.className = 'badge-card';
    card.dataset.badgeId = badge.id;
    card.setAttribute('role', 'listitem');
    card.classList.add(unlocked ? 'unlocked' : 'locked');
    card.setAttribute(
      'aria-label',
      unlocked
        ? `Badge débloqué : ${badge.title}`
        : `Badge à débloquer : ${badge.title}`
    );

    const icon = document.createElement('div');
    icon.className = 'badge-icon';
    icon.textContent = `N${badge.level}`;
    icon.setAttribute('aria-hidden', 'true');

    const info = document.createElement('div');
    info.className = 'badge-info';

    const title = document.createElement('span');
    title.className = 'badge-title';
    title.textContent = badge.title;

    const status = document.createElement('span');
    status.className = 'badge-status';
    if (unlocked && unlockedAt) {
      const formatted = formatBadgeDate(unlockedAt);
      status.textContent = formatted ? `Débloqué le ${formatted}` : 'Débloqué !';
    } else {
      status.textContent = badge.description;
    }

    info.append(title, status);
    card.append(icon, info);
    container.append(card);
  });

  if (elements.badgeHelp) {
    if (unlockedCount === 0) {
      elements.badgeHelp.hidden = false;
      elements.badgeHelp.textContent =
        'Joue les niveaux 3, 4 et 5 et réussis plusieurs phrases d’affilée pour débloquer les badges.';
    } else {
      const remaining = BADGE_DEFINITIONS.length - unlockedCount;
      elements.badgeHelp.hidden = false;
      if (remaining > 0) {
        elements.badgeHelp.textContent = `Encore ${remaining} badge${
          remaining > 1 ? 's' : ''
        } à décrocher en poursuivant les séries parfaites !`;
      } else {
        elements.badgeHelp.textContent = 'Tous les badges sont débloqués, bravo !';
      }
    }
  }
}

function formatBadgeDate(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  try {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(date);
  } catch (error) {
    return date.toLocaleDateString('fr-FR');
  }
}

function highlightUnlockedBadges(unlockedIds) {
  if (!unlockedIds || !unlockedIds.length || !elements.badgeGrid) return;
  unlockedIds.forEach((id) => {
    const card = elements.badgeGrid.querySelector(`[data-badge-id="${id}"]`);
    if (!card) return;
    card.classList.add('just-unlocked');
    setTimeout(() => {
      card.classList.remove('just-unlocked');
    }, 1600);
  });
}

function announceBadgeUnlock(unlockedIds) {
  if (!unlockedIds || !unlockedIds.length) return;
  const badge = getBadgeDefinition(unlockedIds[unlockedIds.length - 1]);
  if (!badge) {
    showToast('Nouveau badge débloqué !');
    return;
  }
  showToast(`Nouveau badge ! ${badge.title}`);
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  try {
    await navigator.serviceWorker.register('service-worker.js');
  } catch (error) {
    console.warn('Service Worker indisponible :', error);
  }
}

init();
