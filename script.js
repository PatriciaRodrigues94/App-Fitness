/* =========================================================
   App-Fitness — script.js (PARTE 1/4)
   - Treino (Dias + Exercícios)
   - Base (nav, helpers, storage, modais base)
========================================================= */

const qs = s => document.querySelector(s);
const qsa = s => document.querySelectorAll(s);

const uid = () => (crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);

/* ===================== NAVEGAÇÃO ===================== */
function openScreen(id) {
  qsa('.screen').forEach(s => s.classList.remove('active'));
  const el = qs(`#${id}`);
  if (el) el.classList.add('active');
}

/* cards/botões com data-screen */
qsa('[data-screen]').forEach(btn => {
  btn.addEventListener('click', () => openScreen(btn.dataset.screen));
});
qsa('[data-screen]').forEach(el => {
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openScreen(el.dataset.screen);
    }
  });
});

/* ===================== STORAGE (TREINOS) ===================== */
const DAYS_KEY = 'ft_days';
const EX_KEY = 'ft_exercises';

const loadDays = () => JSON.parse(localStorage.getItem(DAYS_KEY) || '[]');
const saveDays = d => localStorage.setItem(DAYS_KEY, JSON.stringify(d));

const loadExercises = () => JSON.parse(localStorage.getItem(EX_KEY) || '[]');
const saveExercises = d => localStorage.setItem(EX_KEY, JSON.stringify(d));

/* ===================== COMPRESSÃO (IMAGENS) ===================== */
function compressImageToDataURL(file, { maxSize = 1280, quality = 0.72 } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Falha ao ler o ficheiro.'));
    reader.onload = () => {
      const img = new Image();

      img.onerror = () => reject(new Error('Ficheiro não é uma imagem válida.'));
      img.onload = () => {
        let { width: w, height: h } = img;

        if (w > h && w > maxSize) {
          h = Math.round(h * (maxSize / w));
          w = maxSize;
        } else if (h >= w && h > maxSize) {
          w = Math.round(w * (maxSize / h));
          h = maxSize;
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };

      img.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

/* ===================== MODAIS (BASE) ===================== */
const modalDay = qs('#modal-day');
const modalEx = qs('#modal-ex');
const modalProgress = qs('#modal-progress');

function openModal(el) { if (el) el.style.display = 'flex'; }
function closeModal(el) { if (el) el.style.display = 'none'; }

if (qs('#close-day-modal')) qs('#close-day-modal').onclick = () => closeModal(modalDay);
if (qs('#close-ex-modal')) qs('#close-ex-modal').onclick = () => closeModal(modalEx);

if (qs('#close-progress-modal')) qs('#close-progress-modal').onclick = () => {
  try { editingId = null; } catch {}
  closeModal(modalProgress);
};

if (modalDay) modalDay.addEventListener('click', e => { if (e.target === modalDay) closeModal(modalDay); });
if (modalEx) modalEx.addEventListener('click', e => { if (e.target === modalEx) closeModal(modalEx); });
if (modalProgress) modalProgress.addEventListener('click', e => {
  if (e.target === modalProgress) {
    try { editingId = null; } catch {}
    closeModal(modalProgress);
  }
});

/* ===================== TREINO: ESTADO ===================== */
let currentDayId = null;
let currentExId = null;

let editingDayId = null;
let editingExId = null;

/* ===================== TREINO: DIAS ===================== */
const daysList = qs('#days-list');

function renderDays() {
  if (!daysList) return;

  const days = loadDays();
  const exs = loadExercises();

  daysList.innerHTML = '';

  const sorted = [...days].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  sorted.forEach(day => {
    const dayEx = exs.filter(x => x.dayId === day.id);
    const doneCount = dayEx.filter(x => x.done).length;

    const card = document.createElement('div');
    card.className = 'list-card';

    const left = document.createElement('div');
    left.className = 'list-left';

    const titleBox = document.createElement('div');

    const title = document.createElement('div');
    title.className = 'list-title';
    title.textContent = day.title;

    const sub = document.createElement('div');
    sub.className = 'list-sub';
    sub.innerHTML = `${dayEx.length} exercícios<br>${doneCount} concluídos`;

    titleBox.append(title, sub);
    left.append(titleBox);

    const actions = document.createElement('div');
    actions.className = 'list-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = '✏️';
    editBtn.title = 'Editar dia';
    editBtn.onclick = (ev) => {
      ev.stopPropagation();
      editingDayId = day.id;
      qs('#modal-day-title').textContent = 'Editar Dia';
      qs('#day-name').value = day.title;
      openModal(modalDay);
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'remove-btn';
    delBtn.textContent = '×';
    delBtn.title = 'Eliminar dia';
    delBtn.onclick = (ev) => {
      ev.stopPropagation();
      const ok = confirm('Eliminar este dia e todos os exercícios?');
      if (!ok) return;

      const daysNow = loadDays().filter(d => d.id !== day.id);
      saveDays(daysNow);

      const exNow = loadExercises().filter(x => x.dayId !== day.id);
      saveExercises(exNow);

      renderDays();
    };

    actions.append(editBtn, delBtn);
    card.append(left, actions);

    card.onclick = () => {
      currentDayId = day.id;
      qs('#day-title').textContent = day.title;
      openScreen('screenDay');
      renderExercises();
    };

    daysList.appendChild(card);
  });

  if (sorted.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.innerHTML = `<div class="card-title">Sem dias ainda</div>
      <div style="color:#6b7280;font-size:13px;">Carrega no + para adicionar o teu primeiro dia.</div>`;
    daysList.appendChild(empty);
  }
}

if (qs('#add-day-btn')) {
  qs('#add-day-btn').onclick = () => {
    editingDayId = null;
    qs('#modal-day-title').textContent = 'Novo Dia de Treino';
    qs('#day-name').value = '';
    openModal(modalDay);
  };
}

if (qs('#save-day')) {
  qs('#save-day').onclick = () => {
    const name = qs('#day-name').value.trim();
    if (!name) return;

    const days = loadDays();

    if (editingDayId) {
      const idx = days.findIndex(d => d.id === editingDayId);
      if (idx !== -1) days[idx].title = name;
    } else {
      days.push({ id: uid(), title: name, createdAt: Date.now() });
    }

    saveDays(days);
    closeModal(modalDay);
    renderDays();
  };
}

/* ===================== TREINO: EXERCÍCIOS ===================== */
const exList = qs('#ex-list');

function renderExercises() {
  if (!exList) return;

  const exs = loadExercises().filter(x => x.dayId === currentDayId);
  const days = loadDays();
  const day = days.find(d => d.id === currentDayId);
  if (day) qs('#day-title').textContent = day.title;

  exList.innerHTML = '';

  const sorted = [...exs].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  sorted.forEach(ex => {
    const card = document.createElement('div');
    card.className = 'list-card';
    if (ex.done) card.classList.add('done');

    const left = document.createElement('div');
    left.className = 'list-left';

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'small-check';
    check.checked = !!ex.done;
    check.onclick = ev => ev.stopPropagation();
    check.onchange = () => {
      const all = loadExercises();
      const idx = all.findIndex(x => x.id === ex.id);
      if (idx !== -1) {
        all[idx].done = check.checked;
        saveExercises(all);
        renderExercises();
        renderDays();
      }
    };

    const thumb = document.createElement('div');
    thumb.className = 'thumb';

    const firstMedia = (ex.media || [])[0];
    if (firstMedia) {
      if (firstMedia.type.startsWith('image')) {
        const img = document.createElement('img');
        img.src = firstMedia.src;
        thumb.appendChild(img);
      } else {
        const vid = document.createElement('video');
        vid.src = firstMedia.src;
        vid.muted = true;
        thumb.appendChild(vid);
      }
    } else {
      thumb.textContent = '🏋️';
    }

    const titleBox = document.createElement('div');

    const title = document.createElement('div');
    title.className = 'list-title';
    title.textContent = ex.name;

    const sub = document.createElement('div');
    sub.className = 'list-sub';
    sub.textContent = ex.notes || '';

    titleBox.append(title, sub);

    left.append(check, thumb, titleBox);

    const actions = document.createElement('div');
    actions.className = 'list-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = '✏️';
    editBtn.title = 'Editar exercício';
    editBtn.onclick = (ev) => {
      ev.stopPropagation();
      editingExId = ex.id;
      qs('#modal-ex-title').textContent = 'Editar Exercício';
      qs('#ex-name').value = ex.name || '';
      qs('#ex-quick').value = ex.notes || '';
      openModal(modalEx);
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'remove-btn';
    delBtn.textContent = '×';
    delBtn.title = 'Eliminar exercício';
    delBtn.onclick = (ev) => {
      ev.stopPropagation();
      const ok = confirm('Eliminar este exercício?');
      if (!ok) return;

      const all = loadExercises().filter(x => x.id !== ex.id);
      saveExercises(all);
      renderExercises();
      renderDays();
    };

    actions.append(editBtn, delBtn);
    card.append(left, actions);

    card.onclick = () => {
      currentExId = ex.id;
      openExerciseDetail();
    };

    exList.appendChild(card);
  });

  if (sorted.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.innerHTML = `<div class="card-title">Sem exercícios</div>
      <div style="color:#6b7280;font-size:13px;">Carrega no + para adicionar um exercício.</div>`;
    exList.appendChild(empty);
  }
}

if (qs('#back-to-days')) {
  qs('#back-to-days').onclick = () => {
    openScreen('screen1');
    renderDays();
  };
}

if (qs('#add-ex-btn')) {
  qs('#add-ex-btn').onclick = () => {
    editingExId = null;
    qs('#modal-ex-title').textContent = 'Novo Exercício';
    qs('#ex-name').value = '';
    qs('#ex-quick').value = '';
    openModal(modalEx);
  };
}

if (qs('#save-ex')) {
  qs('#save-ex').onclick = () => {
    const name = qs('#ex-name').value.trim();
    const quick = qs('#ex-quick').value.trim();
    if (!name) return;

    const all = loadExercises();

    if (editingExId) {
      const idx = all.findIndex(x => x.id === editingExId);
      if (idx !== -1) {
        all[idx].name = name;
        all[idx].notes = quick;
      }
    } else {
      all.push({
        id: uid(),
        dayId: currentDayId,
        name,
        notes: quick,
        done: false,
        media: [],
        createdAt: Date.now()
      });
    }

    saveExercises(all);
    closeModal(modalEx);
    renderExercises();
    renderDays();
  };
}

/* =========================================================
   App-Fitness — script.js (PARTE 2/4)
   - Detalhe do Exercício (upload + notas + concluído)
   - Plano Alimentar (Tipos + Refeições + detalhe)
========================================================= */

/* ===================== TREINO: DETALHE DO EXERCÍCIO ===================== */
const exTitle = qs('#ex-title');
const exNotes = qs('#ex-notes');
const exDone = qs('#ex-done');
const exMediaGrid = qs('#ex-media-grid');
const exMediaInput = qs('#ex-media-input');

function getCurrentExercise() {
  const all = loadExercises();
  return all.find(x => x.id === currentExId) || null;
}

function saveCurrentExercise(patch) {
  const all = loadExercises();
  const idx = all.findIndex(x => x.id === currentExId);
  if (idx === -1) return;
  all[idx] = { ...all[idx], ...patch };
  saveExercises(all);
}

function openExerciseDetail() {
  const ex = getCurrentExercise();
  if (!ex) return;

  if (exTitle) exTitle.textContent = ex.name || 'Exercício';
  if (exNotes) exNotes.value = ex.notesLong || '';
  if (exDone) exDone.checked = !!ex.done;

  renderExerciseMedia();
  openScreen('screenExercise');
}

if (qs('#back-to-day')) {
  qs('#back-to-day').onclick = () => {
    openScreen('screenDay');
    renderExercises();
    renderDays();
  };
}

if (qs('#edit-ex-btn')) {
  qs('#edit-ex-btn').onclick = () => {
    const ex = getCurrentExercise();
    if (!ex) return;

    editingExId = ex.id;
    qs('#modal-ex-title').textContent = 'Editar Exercício';
    qs('#ex-name').value = ex.name || '';
    qs('#ex-quick').value = ex.notes || '';
    openModal(modalEx);
  };
}

if (qs('#delete-ex-btn')) {
  qs('#delete-ex-btn').onclick = () => {
    const ex = getCurrentExercise();
    if (!ex) return;

    const ok = confirm('Eliminar este exercício?');
    if (!ok) return;

    const all = loadExercises().filter(x => x.id !== currentExId);
    saveExercises(all);

    openScreen('screenDay');
    renderExercises();
    renderDays();
  };
}

if (exNotes) {
  exNotes.addEventListener('input', () => {
    saveCurrentExercise({ notesLong: exNotes.value });
  });
}

if (exDone) {
  exDone.addEventListener('change', () => {
    saveCurrentExercise({ done: exDone.checked });
    renderDays();
    renderExercises();
  });
}

/* Upload media no detalhe */
if (exMediaInput) {
  exMediaInput.onchange = async () => {
    const ex = getCurrentExercise();
    if (!ex) return;

    const mediaArr = ex.media || [];

    for (const file of exMediaInput.files) {
      if (file.type.startsWith('image')) {
        try {
          const src = await compressImageToDataURL(file, { maxSize: 1280, quality: 0.72 });
          mediaArr.push({ id: uid(), type: 'image/jpeg', src, notes: '' });
        } catch (e) {
          console.error(e);
          alert('Não foi possível processar esta imagem.');
        }
      } else if (file.type.startsWith('video')) {
        const reader = new FileReader();
        await new Promise(resolve => {
          reader.onload = e => {
            mediaArr.push({ id: uid(), type: file.type, src: e.target.result, notes: '' });
            resolve();
          };
          reader.readAsDataURL(file);
        });
      }
    }

    saveCurrentExercise({ media: mediaArr });
    exMediaInput.value = '';
    renderExerciseMedia();
    renderExercises();
    renderDays();
  };
}

function renderExerciseMedia() {
  const ex = getCurrentExercise();
  if (!ex || !exMediaGrid) return;

  exMediaGrid.innerHTML = '';
  const mediaArr = ex.media || [];

  mediaArr.forEach(m => {
    const wrap = document.createElement('div');
    wrap.className = 'media-item';

    const el = document.createElement(m.type.startsWith('image') ? 'img' : 'video');
    el.src = m.src;
    if (!m.type.startsWith('image')) el.muted = true;

    el.onclick = () => openMediaLightbox(ex.name || 'Media', m.id);

    const del = document.createElement('button');
    del.textContent = '×';
    del.onclick = (ev) => {
      ev.stopPropagation();
      const updated = mediaArr.filter(x => x.id !== m.id);
      saveCurrentExercise({ media: updated });
      renderExerciseMedia();
      renderExercises();
      renderDays();
    };

    wrap.append(el, del);
    exMediaGrid.appendChild(wrap);
  });
}

/* =========================================================
   PLANO ALIMENTAR
========================================================= */

/* STORAGE (ALIMENTAÇÃO) */
const MEALTYPES_KEY = 'ft_mealtypes';
const MEALS_KEY = 'ft_meals';

const loadMealTypes = () => JSON.parse(localStorage.getItem(MEALTYPES_KEY) || '[]');
const saveMealTypes = d => localStorage.setItem(MEALTYPES_KEY, JSON.stringify(d));

const loadMeals = () => JSON.parse(localStorage.getItem(MEALS_KEY) || '[]');
const saveMeals = d => localStorage.setItem(MEALS_KEY, JSON.stringify(d));

/* ESTADO (ALIMENTAÇÃO) */
let currentMealTypeId = null;
let currentMealId = null;

let editingMealTypeId = null;
let editingMealId = null;

/* ELEMENTOS */
const mealTypesList = qs('#mealtypes-list');
const mealsList = qs('#meals-list');

const modalMealType = qs('#modal-mealtype');
const modalMeal = qs('#modal-meal');

/* MODAIS — abrir/fechar */
function openModalX(el){ if (el) el.style.display = 'flex'; }
function closeModalX(el){ if (el) el.style.display = 'none'; }

if (qs('#close-mealtype-modal')) qs('#close-mealtype-modal').onclick = () => closeModalX(modalMealType);
if (qs('#close-meal-modal')) qs('#close-meal-modal').onclick = () => closeModalX(modalMeal);

if (modalMealType) modalMealType.addEventListener('click', e => { if (e.target === modalMealType) closeModalX(modalMealType); });
if (modalMeal) modalMeal.addEventListener('click', e => { if (e.target === modalMeal) closeModalX(modalMeal); });

/* ---------- TIPOS DE REFEIÇÃO ---------- */
function renderMealTypes() {
  if (!mealTypesList) return;

  const types = loadMealTypes();
  const meals = loadMeals();

  mealTypesList.innerHTML = '';
  const sorted = [...types].sort((a,b) => (a.createdAt||0) - (b.createdAt||0));

  sorted.forEach(t => {
    const count = meals.filter(m => m.mealTypeId === t.id).length;

    const card = document.createElement('div');
    card.className = 'list-card';

    const left = document.createElement('div');
    left.className = 'list-left';

    const titleBox = document.createElement('div');

    const title = document.createElement('div');
    title.className = 'list-title';
    title.textContent = t.title;

    const sub = document.createElement('div');
    sub.className = 'list-sub';
    sub.innerHTML = `${count} refeições`;

    titleBox.append(title, sub);
    left.append(titleBox);

    const actions = document.createElement('div');
    actions.className = 'list-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = '✏️';
    editBtn.title = 'Editar tipo';
    editBtn.onclick = (ev) => {
      ev.stopPropagation();
      editingMealTypeId = t.id;
      qs('#modal-mealtype-title').textContent = 'Editar Tipo';
      qs('#mealtype-name').value = t.title;
      openModalX(modalMealType);
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'remove-btn';
    delBtn.textContent = '×';
    delBtn.title = 'Eliminar tipo';
    delBtn.onclick = (ev) => {
      ev.stopPropagation();
      const ok = confirm('Eliminar este tipo e todas as refeições dentro dele?');
      if (!ok) return;

      saveMealTypes(loadMealTypes().filter(x => x.id !== t.id));
      saveMeals(loadMeals().filter(m => m.mealTypeId !== t.id));
      renderMealTypes();
    };

    actions.append(editBtn, delBtn);
    card.append(left, actions);

    card.onclick = () => {
      currentMealTypeId = t.id;
      qs('#mealtype-title').textContent = t.title;
      openScreen('screenMealType');
      renderMeals();
    };

    mealTypesList.appendChild(card);
  });

  if (sorted.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.innerHTML = `<div class="card-title">Sem tipos ainda</div>
      <div style="color:#6b7280;font-size:13px;">Carrega no + para adicionar (ex: Pequeno-almoço, Almoço...).</div>`;
    mealTypesList.appendChild(empty);
  }
}

if (qs('#add-mealtype-btn')) {
  qs('#add-mealtype-btn').onclick = () => {
    editingMealTypeId = null;
    qs('#modal-mealtype-title').textContent = 'Novo Tipo de Refeição';
    qs('#mealtype-name').value = '';
    openModalX(modalMealType);
  };
}

if (qs('#save-mealtype')) {
  qs('#save-mealtype').onclick = () => {
    const name = qs('#mealtype-name').value.trim();
    if (!name) return;

    const types = loadMealTypes();

    if (editingMealTypeId) {
      const idx = types.findIndex(x => x.id === editingMealTypeId);
      if (idx !== -1) types[idx].title = name;
    } else {
      types.push({ id: uid(), title: name, createdAt: Date.now() });
    }

    saveMealTypes(types);
    closeModalX(modalMealType);
    renderMealTypes();
  };
      }

/* =========================================================
   App-Fitness — script.js (PARTE 3/4)
   - Plano Alimentar (Refeições + detalhe + upload)
   - Lightbox (galeria com swipe + setas + click)
========================================================= */

/* ---------- REFEIÇÕES DO TIPO ---------- */
function renderMeals() {
  if (!mealsList) return;

  const types = loadMealTypes();
  const t = types.find(x => x.id === currentMealTypeId);
  if (t) qs('#mealtype-title').textContent = t.title;

  const meals = loadMeals().filter(m => m.mealTypeId === currentMealTypeId);

  mealsList.innerHTML = '';
  const sorted = [...meals].sort((a,b) => (a.createdAt||0) - (b.createdAt||0));

  sorted.forEach(m => {
    const card = document.createElement('div');
    card.className = 'list-card';

    const left = document.createElement('div');
    left.className = 'list-left';

    const thumb = document.createElement('div');
    thumb.className = 'thumb';

    const firstMedia = (m.media || [])[0];
    if (firstMedia) {
      if (firstMedia.type.startsWith('image')) {
        const img = document.createElement('img');
        img.src = firstMedia.src;
        thumb.appendChild(img);
      } else {
        const vid = document.createElement('video');
        vid.src = firstMedia.src;
        vid.muted = true;
        thumb.appendChild(vid);
      }
    } else {
      thumb.textContent = '🍽️';
    }

    const titleBox = document.createElement('div');

    const title = document.createElement('div');
    title.className = 'list-title';
    title.textContent = m.title;

    const sub = document.createElement('div');
    sub.className = 'list-sub';
    sub.textContent = (m.notes || '').trim();

    titleBox.append(title, sub);
    left.append(thumb, titleBox);

    const actions = document.createElement('div');
    actions.className = 'list-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = '✏️';
    editBtn.title = 'Editar refeição';
    editBtn.onclick = (ev) => {
      ev.stopPropagation();
      editingMealId = m.id;
      qs('#modal-meal-title').textContent = 'Editar Refeição';
      qs('#meal-name').value = m.title || '';
      openModalX(modalMeal);
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'remove-btn';
    delBtn.textContent = '×';
    delBtn.title = 'Eliminar refeição';
    delBtn.onclick = (ev) => {
      ev.stopPropagation();
      const ok = confirm('Eliminar esta refeição?');
      if (!ok) return;
      saveMeals(loadMeals().filter(x => x.id !== m.id));
      renderMeals();
      renderMealTypes();
    };

    actions.append(editBtn, delBtn);
    card.append(left, actions);

    card.onclick = () => {
      currentMealId = m.id;
      openMealDetail();
    };

    mealsList.appendChild(card);
  });

  if (sorted.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.innerHTML = `<div class="card-title">Sem refeições</div>
      <div style="color:#6b7280;font-size:13px;">Carrega no + para adicionar uma refeição.</div>`;
    mealsList.appendChild(empty);
  }
}

if (qs('#back-to-mealtypes')) {
  qs('#back-to-mealtypes').onclick = () => {
    openScreen('screen2');
    renderMealTypes();
  };
}

if (qs('#add-meal-btn')) {
  qs('#add-meal-btn').onclick = () => {
    editingMealId = null;
    qs('#modal-meal-title').textContent = 'Nova Refeição';
    qs('#meal-name').value = '';
    openModalX(modalMeal);
  };
}

if (qs('#save-meal')) {
  qs('#save-meal').onclick = () => {
    const title = qs('#meal-name').value.trim();
    if (!title) return;

    const all = loadMeals();

    if (editingMealId) {
      const idx = all.findIndex(x => x.id === editingMealId);
      if (idx !== -1) all[idx].title = title;
    } else {
      all.push({
        id: uid(),
        mealTypeId: currentMealTypeId,
        title,
        notes: '',
        media: [],
        createdAt: Date.now()
      });
    }

    saveMeals(all);
    closeModalX(modalMeal);
    renderMeals();
    renderMealTypes();
  };
}

/* ---------- DETALHE DA REFEIÇÃO ---------- */
const mealTitleEl = qs('#meal-title');
const mealNotesEl = qs('#meal-notes');
const mealMediaGrid = qs('#meal-media-grid');
const mealMediaInput = qs('#meal-media-input');

function getCurrentMeal() {
  const all = loadMeals();
  return all.find(x => x.id === currentMealId) || null;
}

function saveCurrentMeal(patch) {
  const all = loadMeals();
  const idx = all.findIndex(x => x.id === currentMealId);
  if (idx === -1) return;
  all[idx] = { ...all[idx], ...patch };
  saveMeals(all);
}

function openMealDetail() {
  const m = getCurrentMeal();
  if (!m) return;

  if (mealTitleEl) mealTitleEl.textContent = m.title || 'Refeição';
  if (mealNotesEl) mealNotesEl.value = m.notes || '';

  renderMealMedia();
  openScreen('screenMeal');
}

if (qs('#back-to-meals')) {
  qs('#back-to-meals').onclick = () => {
    openScreen('screenMealType');
    renderMeals();
    renderMealTypes();
  };
}

if (qs('#edit-meal-btn')) {
  qs('#edit-meal-btn').onclick = () => {
    const m = getCurrentMeal();
    if (!m) return;

    editingMealId = m.id;
    qs('#modal-meal-title').textContent = 'Editar Refeição';
    qs('#meal-name').value = m.title || '';
    openModalX(modalMeal);
  };
}

if (qs('#delete-meal-btn')) {
  qs('#delete-meal-btn').onclick = () => {
    const m = getCurrentMeal();
    if (!m) return;

    const ok = confirm('Eliminar esta refeição?');
    if (!ok) return;

    saveMeals(loadMeals().filter(x => x.id !== currentMealId));
    openScreen('screenMealType');
    renderMeals();
    renderMealTypes();
  };
}

if (mealNotesEl) {
  mealNotesEl.addEventListener('input', () => {
    saveCurrentMeal({ notes: mealNotesEl.value });
    renderMeals();
  });
}

/* Upload media no detalhe da refeição */
if (mealMediaInput) {
  mealMediaInput.onchange = async () => {
    const m = getCurrentMeal();
    if (!m) return;

    const mediaArr = m.media || [];

    for (const file of mealMediaInput.files) {
      if (file.type.startsWith('image')) {
        try {
          const src = await compressImageToDataURL(file, { maxSize: 1280, quality: 0.72 });
          mediaArr.push({ id: uid(), type: 'image/jpeg', src, notes: '' });
        } catch (e) {
          console.error(e);
          alert('Não foi possível processar esta imagem.');
        }
      } else if (file.type.startsWith('video')) {
        const reader = new FileReader();
        await new Promise(resolve => {
          reader.onload = e => {
            mediaArr.push({ id: uid(), type: file.type, src: e.target.result, notes: '' });
            resolve();
          };
          reader.readAsDataURL(file);
        });
      }
    }

    saveCurrentMeal({ media: mediaArr });
    mealMediaInput.value = '';
    renderMealMedia();
    renderMeals();
    renderMealTypes();
  };
}

function renderMealMedia() {
  const m = getCurrentMeal();
  if (!m || !mealMediaGrid) return;

  mealMediaGrid.innerHTML = '';
  const mediaArr = m.media || [];

  mediaArr.forEach(x => {
    const wrap = document.createElement('div');
    wrap.className = 'media-item';

    const el = document.createElement(x.type.startsWith('image') ? 'img' : 'video');
    el.src = x.src;
    if (!x.type.startsWith('image')) el.muted = true;

    el.onclick = () => openMealMediaLightbox(m.title || 'Media', x.id);

    const del = document.createElement('button');
    del.textContent = '×';
    del.onclick = (ev) => {
      ev.stopPropagation();
      const updated = mediaArr.filter(z => z.id !== x.id);
      saveCurrentMeal({ media: updated });
      renderMealMedia();
      renderMeals();
      renderMealTypes();
    };

    wrap.append(el, del);
    mealMediaGrid.appendChild(wrap);
  });
}

/* ===================== LIGHTBOX: GALERIA (SWIPE + CLICK + NAV) ===================== */
const lb = {
  open: false,
  title: '',
  items: [],
  index: 0,
  saveNotes: null
};

function lbShow() {
  const box = qs('#lightbox');
  const img = qs('#lightbox-img');
  const vid = qs('#lightbox-video');
  const notesEl = qs('#lightbox-notes');

  const item = lb.items[lb.index];
  if (!item || !box || !img || !vid || !notesEl) return;

  box.style.display = 'flex';
  qs('#lightbox-title').innerText = lb.title || '';

  img.style.display = 'none';
  vid.style.display = 'none';
  try { vid.pause(); } catch {}

  if (item.type.startsWith('image')) {
    img.src = item.src;
    img.style.display = 'block';
  } else {
    vid.src = item.src;
    vid.style.display = 'block';
  }

  notesEl.value = item.notes || '';
  notesEl.oninput = (e) => {
    const val = e.target.value;
    lb.items[lb.index].notes = val;
    if (typeof lb.saveNotes === 'function') lb.saveNotes(item.id, val);
  };

  lb.open = true;
}

function lbNext() {
  if (!lb.items.length) return;
  lb.index = (lb.index + 1) % lb.items.length;
  lbShow();
}

function lbPrev() {
  if (!lb.items.length) return;
  lb.index = (lb.index - 1 + lb.items.length) % lb.items.length;
  lbShow();
}

function lbBindMediaClickNext() {
  const img = qs('#lightbox-img');
  const vid = qs('#lightbox-video');
  if (img) img.onclick = () => lbNext();
  if (vid) vid.onclick = () => lbNext();
}

(function lbEnableSwipe(){
  const box = qs('#lightbox');
  if (!box) return;

  let startX = 0;
  let startY = 0;
  let touching = false;

  box.addEventListener('touchstart', (e) => {
    if (!lb.open) return;
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    touching = true;
  }, { passive: true });

  box.addEventListener('touchend', (e) => {
    if (!lb.open || !touching) return;
    touching = false;

    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;

    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (dx < 0) lbNext();
      else lbPrev();
    }
  }, { passive: true });
})();

(function lbBindNavButtons(){
  const prevBtn = qs('.lightbox-nav.prev');
  const nextBtn = qs('.lightbox-nav.next');
  if (prevBtn) prevBtn.onclick = (e) => { e.stopPropagation(); lbPrev(); };
  if (nextBtn) nextBtn.onclick = (e) => { e.stopPropagation(); lbNext(); };
})();

lbBindMediaClickNext();

/* =========================================================
   App-Fitness — script.js (PARTE 4/4)
   - Lightbox open (treino + alimentação)
   - Progresso
   - Menu ⋯ + Exportar/Importar (com Voltar e Replace/Add)
   - INIT
========================================================= */

/* ===================== LIGHTBOX TREINOS (ABRIR COM LISTA) ===================== */
function openMediaLightbox(title, mediaId) {
  const ex = getCurrentExercise();
  if (!ex) return;

  const arr = ex.media || [];
  const idx = arr.findIndex(x => x.id === mediaId);
  if (idx === -1) return;

  lb.title = title;
  lb.items = arr.map(x => ({ ...x }));
  lb.index = idx;

  lb.saveNotes = (id, value) => {
    const exNow = getCurrentExercise();
    if (!exNow) return;
    const media = exNow.media || [];
    const i = media.findIndex(x => x.id === id);
    if (i !== -1) {
      media[i].notes = value;
      saveCurrentExercise({ media });
    }
  };

  lbShow();
}

/* ===================== LIGHTBOX REFEIÇÕES (ABRIR COM LISTA) ===================== */
function openMealMediaLightbox(title, mediaId) {
  const meal = getCurrentMeal();
  if (!meal) return;

  const arr = meal.media || [];
  const idx = arr.findIndex(x => x.id === mediaId);
  if (idx === -1) return;

  lb.title = title;
  lb.items = arr.map(x => ({ ...x }));
  lb.index = idx;

  lb.saveNotes = (id, value) => {
    const mealNow = getCurrentMeal();
    if (!mealNow) return;
    const media = mealNow.media || [];
    const i = media.findIndex(x => x.id === id);
    if (i !== -1) {
      media[i].notes = value;
      saveCurrentMeal({ media });
    }
  };

  lbShow();
}

/* FECHAR LIGHTBOX */
if (qs('.lightbox-close')) {
  qs('.lightbox-close').onclick = () => {
    const box = qs('#lightbox');
    const vid = qs('#lightbox-video');
    if (box) box.style.display = 'none';
    try { vid.pause(); } catch {}
    lb.open = false;
  };
}

/* ===================== PROGRESSO ===================== */
let chart;
let editingId = null;

const loadProgress = () => {
  const data = JSON.parse(localStorage.getItem('progress') || '[]');

  let changed = false;
  for (const r of data) {
    if (!r.id) {
      r.id = uid();
      changed = true;
    }
  }
  if (changed) localStorage.setItem('progress', JSON.stringify(data));

  return data;
};

const saveProgress = d => localStorage.setItem('progress', JSON.stringify(d));

if (qs('#add-record-btn')) {
  qs('#add-record-btn').onclick = () => {
    editingId = null;
    qs('#modal-progress-title').textContent = 'Novo Registo';
    qs('#progress-form').reset?.();
    openModal(modalProgress);
  };
}

if (qs('#cancel-btn')) {
  qs('#cancel-btn').onclick = () => {
    editingId = null;
    closeModal(modalProgress);
  };
}

if (qs('#progress-form')) {
  qs('#progress-form').onsubmit = e => {
    e.preventDefault();
    const data = loadProgress();

    const payload = {
      date: qs('#date').value,
      weight: parseFloat(qs('#weight').value),
      notes: qs('#notes').value
    };

    if (editingId) {
      const idx = data.findIndex(x => x.id === editingId);
      if (idx !== -1) data[idx] = { ...data[idx], ...payload };
    } else {
      data.push({ id: uid(), ...payload });
    }

    saveProgress(data);
    editingId = null;
    e.target.reset();
    closeModal(modalProgress);
    renderProgress();
  };
}

function renderProgress() {
  const list = qs('#progress-list');
  if (!list) return;

  const data = loadProgress();
  list.innerHTML = '';

  const sortedDesc = [...data].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  sortedDesc.forEach(r => {
    const row = document.createElement('div');
    row.className = 'list-card';

    const left = document.createElement('div');
    left.className = 'list-left';

    const text = document.createElement('div');
    text.innerHTML = `<div class="list-title">${r.date}</div>
                      <div class="list-sub">${r.weight} kg${r.notes ? ` — ${r.notes}` : ''}</div>`;

    left.append(text);

    const actions = document.createElement('div');
    actions.className = 'list-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = '✏️';
    editBtn.title = 'Editar';
    editBtn.onclick = () => {
      editingId = r.id;
      qs('#date').value = r.date || '';
      qs('#weight').value = (r.weight ?? '');
      qs('#notes').value = r.notes || '';
      qs('#modal-progress-title').textContent = 'Editar Registo';
      openModal(modalProgress);
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'remove-btn';
    delBtn.textContent = '×';
    delBtn.title = 'Eliminar';
    delBtn.onclick = () => {
      const fresh = loadProgress();
      const idx = fresh.findIndex(x => x.id === r.id);
      if (idx !== -1) {
        fresh.splice(idx, 1);
        saveProgress(fresh);
        renderProgress();
      }
    };

    actions.append(editBtn, delBtn);
    row.append(left, actions);
    list.appendChild(row);
  });

  const sortedAsc = [...data].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const sumInitial = qs('#sum-initial');
  const sumCurrent = qs('#sum-current');
  const sumDiff = qs('#sum-diff');

  if (sumInitial && sumCurrent && sumDiff) {
    if (sortedAsc.length === 0) {
      sumInitial.textContent = '—';
      sumCurrent.textContent = '—';
      sumDiff.textContent = '—';
    } else {
      const initial = sortedAsc[0].weight;
      const current = sortedAsc[sortedAsc.length - 1].weight;
      const diff = current - initial;

      sumInitial.textContent = `${initial.toFixed(1)} kg`;
      sumCurrent.textContent = `${current.toFixed(1)} kg`;
      sumDiff.textContent = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)} kg`;
    }
  }

  drawChart(sortedAsc);
}

function drawChart(data) {
  const canvas = qs('#weightChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.date),
      datasets: [{
        label: 'Peso (kg)',
        data: data.map(d => d.weight),
        tension: 0.35,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 4,
        fill: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 8, right: 10, bottom: 8, left: 10 } },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { boxWidth: 14, boxHeight: 10, padding: 10, font: { size: 12, weight: '600' } }
        },
        tooltip: { titleFont: { size: 12, weight: '700' }, bodyFont: { size: 12 } }
      },
      scales: {
        x: {
          grid: { color: 'rgba(0,0,0,0.08)', borderDash: [3, 3] },
          ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 45 }
        },
        y: {
          grid: { color: 'rgba(0,0,0,0.08)', borderDash: [3, 3] },
          ticks: { font: { size: 10 }, callback: (v) => Number(v).toFixed(1) },
          title: { display: true, text: 'Peso (kg)', font: { size: 11, weight: '600' }, padding: { top: 0, bottom: 6 } }
        }
      }
    }
  });
}

/* =========================================================
   MENU ⋯ + EXPORTAR / IMPORTAR
========================================================= */
const moreBtn = qs('#more-btn');
const moreMenu = qs('#more-menu');

const openExportBtn = qs('#open-export');
const openImportBtn = qs('#open-import');
const closeMoreBtn = qs('#close-more');

const modalExport = qs('#modal-export');
const modalImport = qs('#modal-import');

/* --- helpers export/import --- */
function safeParseJSON(text) {
  try { return JSON.parse(text); } catch { return null; }
}
function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* --- abrir/fechar menu ⋯ --- */
function showMoreMenu() {
  if (!moreMenu) return;
  moreMenu.classList.add('show');
  moreMenu.setAttribute('aria-hidden', 'false');
}
function hideMoreMenu() {
  if (!moreMenu) return;
  moreMenu.classList.remove('show');
  moreMenu.setAttribute('aria-hidden', 'true');
}

if (moreBtn) moreBtn.onclick = (e) => {
  e.stopPropagation();
  if (!moreMenu) return;
  moreMenu.classList.contains('show') ? hideMoreMenu() : showMoreMenu();
};

if (closeMoreBtn) closeMoreBtn.onclick = () => hideMoreMenu();

document.addEventListener('click', (e) => {
  if (!moreMenu || !moreMenu.classList.contains('show')) return;
  if (e.target === moreBtn) return;
  if (moreMenu.contains(e.target)) return;
  hideMoreMenu();
});

/* --- export modal --- */
if (qs('#close-export-modal')) qs('#close-export-modal').onclick = () => closeModal(modalExport);
if (modalExport) modalExport.addEventListener('click', e => { if (e.target === modalExport) closeModal(modalExport); });

if (openExportBtn) openExportBtn.onclick = () => {
  hideMoreMenu();
  openModal(modalExport);
};
if (qs('#back-export')) qs('#back-export').onclick = () => {
  closeModal(modalExport);
  showMoreMenu();
};

function buildExportPayload(scope) {
  const payload = {
    app: 'App-Fitness',
    exportedAt: new Date().toISOString(),
    scope,
    data: {}
  };

  if (scope === 'all' || scope === 'train') {
    payload.data.train = {
      days: loadDays(),
      exercises: loadExercises()
    };
  }
  if (scope === 'all' || scope === 'food') {
    payload.data.food = {
      mealtypes: loadMealTypes(),
      meals: loadMeals()
    };
  }
  if (scope === 'all' || scope === 'progress') {
    payload.data.progress = {
      records: loadProgress()
    };
  }

  return payload;
}

function doExport(scope) {
  const p = buildExportPayload(scope);
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,'0');
  const d = String(date.getDate()).padStart(2,'0');
  downloadJSON(p, `App-Fitness_${scope}_${y}-${m}-${d}.json`);
}

if (qs('#exp-all')) qs('#exp-all').onclick = () => doExport('all');
if (qs('#exp-train')) qs('#exp-train').onclick = () => doExport('train');
if (qs('#exp-food')) qs('#exp-food').onclick = () => doExport('food');
if (qs('#exp-progress')) qs('#exp-progress').onclick = () => doExport('progress');

/* --- import modal + steps --- */
const impStep1 = qs('#import-step-1');
const impStep2 = qs('#import-step-2');
const impStep3 = qs('#import-step-3');

const impFile = qs('#import-file');
const goImportModeBtn = qs('#go-import-mode');
const impReplaceBtn = qs('#imp-replace');
const impAddBtn = qs('#imp-add');

let impScope = 'all';
let impJson = null;

function showImportStep(n) {
  if (!impStep1 || !impStep2 || !impStep3) return;
  impStep1.style.display = (n === 1) ? 'block' : 'none';
  impStep2.style.display = (n === 2) ? 'block' : 'none';
  impStep3.style.display = (n === 3) ? 'block' : 'none';
}

function resetImportFlow() {
  impScope = 'all';
  impJson = null;
  if (impFile) impFile.value = '';
  if (goImportModeBtn) goImportModeBtn.disabled = true;
  showImportStep(1);
}

if (qs('#close-import-modal')) qs('#close-import-modal').onclick = () => { resetImportFlow(); closeModal(modalImport); };
if (modalImport) modalImport.addEventListener('click', e => { if (e.target === modalImport) { resetImportFlow(); closeModal(modalImport); } });

if (openImportBtn) openImportBtn.onclick = () => {
  hideMoreMenu();
  resetImportFlow();
  openModal(modalImport);
};

if (qs('#back-import-1')) qs('#back-import-1').onclick = () => {
  resetImportFlow();
  closeModal(modalImport);
  showMoreMenu();
};

if (qs('#back-import-2')) qs('#back-import-2').onclick = () => showImportStep(1);
if (qs('#back-import-3')) qs('#back-import-3').onclick = () => showImportStep(2);

/* escolher scope no step 1 */
qsa('[data-imp-scope]').forEach(btn => {
  btn.addEventListener('click', () => {
    impScope = btn.dataset.impScope || 'all';
    showImportStep(2);
  });
});

/* escolher ficheiro no step 2 */
if (impFile) {
  impFile.addEventListener('change', async () => {
    impJson = null;
    if (goImportModeBtn) goImportModeBtn.disabled = true;

    const f = impFile.files?.[0];
    if (!f) return;

    const text = await f.text();
    const parsed = safeParseJSON(text);
    if (!parsed || typeof parsed !== 'object' || !parsed.data) {
      alert('Ficheiro inválido. Exporta primeiro na app para garantir o formato.');
      return;
    }

    impJson = parsed;
    if (goImportModeBtn) goImportModeBtn.disabled = false;
  });
}

if (goImportModeBtn) goImportModeBtn.onclick = () => showImportStep(3);

/* merge helpers (sem perder relações) */
function remapId(oldId, map) {
  if (!oldId) return oldId;
  return map.get(oldId) || oldId;
}

function mergeArrayById(existing, incoming, { remap = null } = {}) {
  const out = [...existing];
  const seen = new Set(existing.map(x => x?.id).filter(Boolean));
  const idMap = new Map();

  for (const item of (incoming || [])) {
    if (!item || typeof item !== 'object') continue;

    let newItem = { ...item };

    if (!newItem.id || seen.has(newItem.id)) {
      const newId = uid();
      if (newItem.id) idMap.set(newItem.id, newId);
      newItem.id = newId;
    }

    if (remap) newItem = remap(newItem, idMap);

    out.push(newItem);
    seen.add(newItem.id);
  }

  return { merged: out, idMap };
}

function applyReplace(scope, data) {
  if (scope === 'all' || scope === 'train') {
    const t = data?.train;
    if (t?.days && t?.exercises) {
      saveDays(t.days);
      saveExercises(t.exercises);
    }
  }
  if (scope === 'all' || scope === 'food') {
    const f = data?.food;
    if (f?.mealtypes && f?.meals) {
      saveMealTypes(f.mealtypes);
      saveMeals(f.meals);
    }
  }
  if (scope === 'all' || scope === 'progress') {
    const p = data?.progress;
    if (p?.records) {
      saveProgress(p.records);
    }
  }
}

function applyAdd(scope, data) {
  if (scope === 'all' || scope === 'train') {
    const t = data?.train;
    if (t?.days && t?.exercises) {
      // merge days
      const daysRes = mergeArrayById(loadDays(), t.days);
      const dayIdMap = daysRes.idMap;

      // merge exercises remap dayId if day got remapped
      const exRes = mergeArrayById(loadExercises(), t.exercises, {
        remap: (it, map) => ({
          ...it,
          dayId: remapId(it.dayId, dayIdMap)
        })
      });

      saveDays(daysRes.merged);
      saveExercises(exRes.merged);
    }
  }

  if (scope === 'all' || scope === 'food') {
    const f = data?.food;
    if (f?.mealtypes && f?.meals) {
      // merge mealtypes
      const typesRes = mergeArrayById(loadMealTypes(), f.mealtypes);
      const typeIdMap = typesRes.idMap;

      // merge meals remap mealTypeId
      const mealsRes = mergeArrayById(loadMeals(), f.meals, {
        remap: (it, map) => ({
          ...it,
          mealTypeId: remapId(it.mealTypeId, typeIdMap)
        })
      });

      saveMealTypes(typesRes.merged);
      saveMeals(mealsRes.merged);
    }
  }

  if (scope === 'all' || scope === 'progress') {
    const p = data?.progress;
    if (p?.records) {
      const res = mergeArrayById(loadProgress(), p.records);
      saveProgress(res.merged);
    }
  }
}

function afterImportRefresh() {
  renderDays();
  renderMealTypes();
  renderProgress();

  // refrescos contextuais
  if (qs('#screenDay')?.classList.contains('active')) renderExercises();
  if (qs('#screenMealType')?.classList.contains('active')) renderMeals();
  if (qs('#screenExercise')?.classList.contains('active')) {
    const ex = getCurrentExercise();
    if (ex) renderExerciseMedia();
  }
  if (qs('#screenMeal')?.classList.contains('active')) {
    const m = getCurrentMeal();
    if (m) renderMealMedia();
  }
}

/* executar import (replace/add) */
function doImport(mode) {
  if (!impJson?.data) {
    alert('Nenhum ficheiro carregado.');
    return;
  }

  // validação mínima do scope pedido vs ficheiro
  const data = impJson.data;

  // se scope escolhido não existir no ficheiro, alerta
  const hasTrain = !!data.train;
  const hasFood = !!data.food;
  const hasProg = !!data.progress;

  if (impScope === 'train' && !hasTrain) return alert('Este ficheiro não tem dados de treino.');
  if (impScope === 'food' && !hasFood) return alert('Este ficheiro não tem dados de alimentação.');
  if (impScope === 'progress' && !hasProg) return alert('Este ficheiro não tem dados de progresso.');
  if (impScope === 'all' && !(hasTrain || hasFood || hasProg)) return alert('Este ficheiro não tem dados reconhecidos.');

  if (mode === 'replace') {
    applyReplace(impScope, data);
  } else {
    applyAdd(impScope, data);
  }

  afterImportRefresh();
  alert('Importação concluída ✅');

  resetImportFlow();
  closeModal(modalImport);
}

if (impReplaceBtn) impReplaceBtn.onclick = () => {
  const ok = confirm('Substituir vai apagar os dados existentes nessa secção. Queres continuar?');
  if (!ok) return;
  doImport('replace');
};

if (impAddBtn) impAddBtn.onclick = () => doImport('add');

/* ===================== INIT ===================== */
window.onload = () => {
  renderDays();
  renderProgress();
  renderMealTypes();
};
