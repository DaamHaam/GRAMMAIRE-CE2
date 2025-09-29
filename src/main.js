import { loadProgress, recordResult, updateLastLevel, resetProgress } from './storage.js';

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
  subjectTypePrompt: null
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
  subjectPrompt: document.getElementById('subject-type-prompt'),
  subjectPromptQuestion: document.getElementById('subject-type-question'),
  subjectPromptDrop: document.getElementById('subject-type-drop'),
  subjectPromptChoices: document.getElementById('subject-type-choices'),
  dragArea: document.getElementById('drag-area'),
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
  appState.progress = updateLastLevel(appState.progress, level);
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
  appState.slots = new Map();
  appState.hasValidated = false;
  clearSubjectTypePrompt();
  elements.validateBtn.disabled = false;
  elements.nextBtn.disabled = true;
  elements.helpText.textContent = appState.instruction;
  renderPhrase(phrase);
  renderLabels(phrase);
}

function renderPhrase(phrase) {
  elements.phraseText.innerHTML = '';
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
    const needsRole = shouldRequireRole(part.role);
    if (needsRole) {
      const slotId = `segment-${index}-role`;
      segment.dataset.slotId = slotId;
      segment.dataset.slotType = 'ROLE';
      segment.dataset.expectedValue = part.role;
      appState.slots.set(slotId, {
        id: slotId,
        kind: 'ROLE',
        expected: part.role,
        assigned: null,
        element: segment,
        subjectType: part.subjectType || null
      });
    } else {
      segment.classList.add('readonly');
    }

    elements.phraseText.append(segment);
  });
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
  const expectedType = slot.subjectType;
  if (!expectedType) return;
  const segmentText = slot.element.textContent.trim();
  clearSubjectTypePrompt();

  const slotId = 'subject-type-slot';
  const { subjectPrompt, subjectPromptQuestion, subjectPromptDrop, subjectPromptChoices } = elements;
  subjectPrompt.hidden = false;
  subjectPromptQuestion.textContent = `Quel est le type du groupe sujet « ${segmentText} » ?`;

  subjectPromptDrop.textContent = 'Glisse ta réponse ici';
  subjectPromptDrop.className = 'prompt-drop';
  subjectPromptDrop.dataset.slotId = slotId;
  subjectPromptDrop.dataset.slotType = 'SUBJECT_TYPE';
  subjectPromptDrop.dataset.expectedValue = expectedType;
  subjectPromptDrop.classList.remove('assigned', 'correct', 'incorrect', 'hint');

  subjectPromptChoices.innerHTML = '';
  ['SUBJECT_TYPE_PRONOUN', 'SUBJECT_TYPE_GN'].forEach((id) => {
    const definition = LABEL_LIBRARY[id];
    const choice = createDragLabel(definition);
    choice.classList.add('prompt-label');
    subjectPromptChoices.append(choice);
  });

  const typeSlot = {
    id: slotId,
    kind: 'SUBJECT_TYPE',
    expected: expectedType,
    assigned: null,
    element: subjectPromptDrop,
    segment: slot.element
  };
  appState.slots.set(slotId, typeSlot);
  appState.subjectTypePrompt = { slotId, segment: slot.element };
}

function clearSubjectTypePrompt() {
  if (appState.subjectTypePrompt) {
    appState.slots.delete(appState.subjectTypePrompt.slotId);
    setSubjectTypeVisual(appState.subjectTypePrompt.segment, null);
  }
  const { subjectPrompt, subjectPromptQuestion, subjectPromptDrop, subjectPromptChoices } = elements;
  subjectPrompt.hidden = true;
  subjectPromptQuestion.textContent = '';
  subjectPromptDrop.textContent = 'Glisse ta réponse ici';
  subjectPromptDrop.className = 'prompt-drop';
  subjectPromptDrop.removeAttribute('data-slot-id');
  subjectPromptDrop.removeAttribute('data-slot-type');
  subjectPromptDrop.removeAttribute('data-expected-value');
  subjectPromptDrop.classList.remove('assigned', 'correct', 'incorrect', 'hint');
  subjectPromptChoices.innerHTML = '';
  appState.subjectTypePrompt = null;
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
      target.element.textContent = label.text;
    }
  }
  target.element.classList.add('hint');
  elements.helpText.textContent = `Indice : repère ${label ? label.text.toLowerCase() : 'cet élément'}.`;
}

function onValidate() {
  if (appState.hasValidated) return;
  const slots = Array.from(appState.slots.values());
  const missing = slots.filter((slot) => !slot.assigned);
  if (missing.length) {
    elements.helpText.textContent =
      "Glisse toutes les étiquettes sur la phrase avant de valider.";
    return;
  }

  let correctCount = 0;
  const slotMessages = [];
  slots.forEach((slot) => {
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
      const choiceText = (assignedLabel || expectedLabel)?.text;
      if (choiceText) {
        slot.element.textContent = choiceText;
      }
      const visualType = isCorrect ? slot.assigned : slot.expected;
      setSubjectTypeVisual(slot.segment, visualType);
    }

    if (isCorrect) {
      correctCount += 1;
      const message = SLOT_FEEDBACK[slot.kind][slot.expected]?.success || 'Bien joué !';
      slotMessages.push(`✓ ${message}`);
    } else {
      const reminder = SLOT_FEEDBACK[slot.kind][slot.expected]?.reminder || 'Observe la phrase attentivement.';
      slotMessages.push(`✗ ${reminder}`);
      if (slot.kind === 'SUBJECT_TYPE' && expectedLabel) {
        slot.element.textContent = expectedLabel.text;
        setSubjectTypeVisual(slot.segment, slot.expected);
      }
      if (slot.kind === 'ROLE') {
        setRoleVisual(slot.element, slot.expected);
      }
    }
  });

  const totalSlots = slots.length || 1;
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
  appState.progress = recordResult(
    appState.progress,
    appState.currentPhrase.id,
    deltaScore,
    stars
  );
  updateScoreboard();

  elements.helpText.innerHTML = slotMessages.join('<br />');
  showToast(`${correctCount}/${totalSlots} réponse${correctCount > 1 ? 's' : ''} correcte${
    correctCount > 1 ? 's' : ''
  }.`);
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
  slot.assigned = label.value;
  slot.element.classList.remove('incorrect', 'correct', 'hint');
  if (slot.kind === 'ROLE') {
    setRoleVisual(slot.element, label.value);
    slot.element.classList.add('assigned');
    if (slot.expected === 'SUBJECT') {
      if (
        label.value === 'SUBJECT' &&
        appState.requirements.requireSubjectType &&
        slot.subjectType
      ) {
        showSubjectTypePrompt(slot);
      } else {
        clearSubjectTypePrompt();
      }
    }
  } else if (slot.kind === 'SUBJECT_TYPE') {
    slot.element.textContent = label.text;
    slot.element.classList.add('assigned');
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

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

init();
