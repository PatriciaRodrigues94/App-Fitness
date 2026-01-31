// ===== ERUDA (debug) — ativa só com ?debug=1 =====
(() => {
  try {
    const params = new URLSearchParams(location.search);
    if (!params.has('debug')) return;

    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/eruda';
    s.onload = () => {
      eruda.init();
      console.log('✅ Eruda ativo');
    };
    document.head.appendChild(s);
  } catch (e) {
    console.log('Eruda falhou:', e);
  }
})();

/* =========================================================
   App-Fitness — script.js (FINAL / 1 ficheiro)
   ✅ FIX MEMÓRIA: fotos/vídeos em IndexedDB (Blob)
   ✅ UI/HTML/CSS iguais, funcionalidades mantidas
   ✅ Export/Import com e sem media + compatível com JSON antigo (src inline)
   ✅ Limpeza de media não usado + Migração 1x do formato antigo
========================================================= */

/* ===================== HELPERS ===================== */
const qs  = (s) => document.querySelector(s);
const qsa = (s) => document.querySelectorAll(s);
const uid = () => (crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);

/* ===================== NAVEGAÇÃO ===================== */
function openScreen(id) {
  qsa('.screen').forEach(s => s.classList.remove('active'));
  const el = qs(`#${id}`);
  if (el) el.classList.add('active');

  // 👉 sempre que entrar no Progresso, abrir no separador "Registos"
  if (id === 'screen3') {
    setProgressTab('records');
  }
}

// elementos com data-screen (home cards + botões voltar)
qsa('[data-screen]').forEach(el => {
  el.addEventListener('click', () => openScreen(el.dataset.screen));
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openScreen(el.dataset.screen);
    }
  });
});

/* ===================== STORAGE (TREINOS) ===================== */
const DAYS_KEY = 'ft_days';
const EX_KEY   = 'ft_exercises';

const loadDays = () => JSON.parse(localStorage.getItem(DAYS_KEY) || '[]');
const saveDays = (d) => localStorage.setItem(DAYS_KEY, JSON.stringify(d));

const loadExercises = () => JSON.parse(localStorage.getItem(EX_KEY) || '[]');
const saveExercises = (d) => localStorage.setItem(EX_KEY, JSON.stringify(d));

/* ===================== STORAGE (ALIMENTAÇÃO) ===================== */
const MEALTYPES_KEY = 'ft_mealtypes';
const MEALS_KEY     = 'ft_meals';

const loadMealTypes = () => JSON.parse(localStorage.getItem(MEALTYPES_KEY) || '[]');
const saveMealTypes = (d) => localStorage.setItem(MEALTYPES_KEY, JSON.stringify(d));

const loadMeals = () => JSON.parse(localStorage.getItem(MEALS_KEY) || '[]');
const saveMeals = (d) => localStorage.setItem(MEALS_KEY, JSON.stringify(d));

/* ===================== STORAGE (PROGRESSO) ===================== */
const PROGRESS_KEY = 'progress';

function loadProgress() {
  const data = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '[]');

  // garantir ids (para editar/apagar)
  let changed = false;
  for (const r of data) {
    if (!r.id) { r.id = uid(); changed = true; }
  }
  if (changed) localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));

  return data;
}
const saveProgress = (d) => localStorage.setItem(PROGRESS_KEY, JSON.stringify(d));

/* =========================================================
   ✅ MEDIA STORE (INDEXEDDB) — guarda Blob/File
   - Exercícios/refeições guardam apenas refs:
     media: [{ id, type, ref, notes }]
========================================================= */
const IDB_NAME    = 'AppFitnessMediaDB';
const IDB_VERSION = 1;
const IDB_STORE   = 'media'; // keyPath: id

let __dbPromise = null;

function openMediaDB() {
  if (__dbPromise) return __dbPromise;

  __dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Erro ao abrir IndexedDB'));
  });

  return __dbPromise;
}

async function idbPut(record) {
  const db = await openMediaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(record);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error('Erro no put()'));
  });
}

async function idbGet(id) {
  const db = await openMediaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error('Erro no get()'));
  });
}

async function idbDelete(id) {
  const db = await openMediaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error('Erro no delete()'));
  });
}

async function idbGetAllKeys() {
  const db = await openMediaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).getAllKeys();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error || new Error('Erro no getAllKeys()'));
  });
}

async function idbGetAll() {
  const db = await openMediaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error || new Error('Erro no getAll()'));
  });
}

/* -------- API MediaStore (para o resto do código) -------- */
async function mediaEnsureDB() {
  await openMediaDB();
}

async function mediaAddBlob({ type, blob }) {
  const id = uid();
  const record = {
    id,
    type: type || blob?.type || 'application/octet-stream',
    blob,
    createdAt: Date.now()
  };
  await idbPut(record);
  return id;
}

async function mediaPutBlobWithId({ id, type, blob, createdAt }) {
  if (!id) throw new Error('mediaPutBlobWithId: id em falta');
  const record = {
    id,
    type: type || blob?.type || 'application/octet-stream',
    blob,
    createdAt: createdAt || Date.now()
  };
  await idbPut(record);
  return id;
}

async function mediaGetRecord(id) {
  return await idbGet(id); // {id,type,blob,createdAt} | null
}

async function mediaDelete(id) {
  await idbDelete(id);
}

async function mediaListIds() {
  return await idbGetAllKeys();
}

async function mediaListAllMeta() {
  const all = await idbGetAll();
  return all.map(r => ({
    id: r.id,
    type: r.type || r?.blob?.type || 'application/octet-stream',
    size: r?.blob?.size || 0,
    createdAt: r.createdAt || 0
  }));
}

async function mediaClearAll() {
  const ids = await mediaListIds();
  for (const id of ids) await mediaDelete(id);
}

/* ===================== objectURL cache (evitar leaks) ===================== */
const __objectUrlCache = new Map(); // mediaId -> objectURL

async function getMediaObjectURL(mediaId) {
  if (!mediaId) return null;
  if (__objectUrlCache.has(mediaId)) return __objectUrlCache.get(mediaId);

  const rec = await mediaGetRecord(mediaId);
  if (!rec?.blob) return null;

  const url = URL.createObjectURL(rec.blob);
  __objectUrlCache.set(mediaId, url);
  return url;
}

function revokeMediaObjectURL(mediaId) {
  if (!mediaId) return;
  const url = __objectUrlCache.get(mediaId);
  if (url) {
    try { URL.revokeObjectURL(url); } catch {}
    __objectUrlCache.delete(mediaId);
  }
}

function revokeAllMediaObjectURLs() {
  for (const url of __objectUrlCache.values()) {
    try { URL.revokeObjectURL(url); } catch {}
  }
  __objectUrlCache.clear();
}

/* ===================== COMPRESSÃO (IMAGENS) -> Blob ===================== */
function compressImageToBlob(file, { maxSize = 1280, quality = 0.72 } = {}) {
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

        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Falha ao comprimir imagem.'));
          resolve(blob);
        }, 'image/jpeg', quality);
      };

      img.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

/* ===================== JSON helpers ===================== */
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

/* ===================== dataURL <-> Blob ===================== */
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('Falha ao ler blob'));
    r.onload = () => resolve(r.result);
    r.readAsDataURL(blob);
  });
}

function dataURLToBlob(dataUrl) {
  try {
    const str = String(dataUrl || '');
    const comma = str.indexOf(',');
    if (comma === -1) return null;

    const meta = str.slice(0, comma);
    const b64  = str.slice(comma + 1);

    const mime = (meta.match(/data:(.*?);base64/) || [])[1] || 'application/octet-stream';
    const bin = atob(b64);
    const len = bin.length;
    const arr = new Uint8Array(len);

    for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  } catch {
    return null;
  }
}

/* =========================================================
   MODAIS (BASE)
========================================================= */
const modalDay = qs('#modal-day');
const modalEx  = qs('#modal-ex');
const modalProgress = qs('#modal-progress');

function openModal(el) { if (el) el.style.display = 'flex'; }
function closeModal(el){ if (el) el.style.display = 'none'; }

if (qs('#close-day-modal')) qs('#close-day-modal').onclick = () => closeModal(modalDay);
if (qs('#close-ex-modal'))  qs('#close-ex-modal').onclick  = () => closeModal(modalEx);
if (qs('#close-progress-modal')) qs('#close-progress-modal').onclick = () => closeModal(modalProgress);

if (modalDay) modalDay.addEventListener('click', e => { if (e.target === modalDay) closeModal(modalDay); });
if (modalEx)  modalEx.addEventListener('click',  e => { if (e.target === modalEx)  closeModal(modalEx); });
if (modalProgress) modalProgress.addEventListener('click', e => { if (e.target === modalProgress) closeModal(modalProgress); });

/* =========================================================
   TREINO — estado
========================================================= */
let currentDayId = null;
let currentExId  = null;

let editingDayId = null;
let editingExId  = null;

/* ===================== TREINO: DIAS ===================== */
const daysList = qs('#days-list');

function renderDays() {
  if (!daysList) return;

  const days = loadDays();
  const exs  = loadExercises();

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

      // remover exercícios do dia
      const exNow = loadExercises().filter(x => x.dayId !== day.id);
      saveExercises(exNow);

      // remover dia
      const daysNow = loadDays().filter(d => d.id !== day.id);
      saveDays(daysNow);

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

/* ===================== TREINO: EXERCÍCIOS (LISTA) ===================== */
const exList = qs('#ex-list');

function renderExercises() {
  if (!exList) return;

  const exs = loadExercises().filter(x => x.dayId === currentDayId);
  const day = loadDays().find(d => d.id === currentDayId);
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
    thumb.textContent = '🏋️';

    // thumb via IndexedDB (primeiro media ref)
    const firstRef = (ex.media || [])[0]?.ref;
    if (firstRef) {
      (async () => {
        const rec = await mediaGetRecord(firstRef);
        if (!rec?.blob) return;

        const url = await getMediaObjectURL(firstRef);
        if (!url) return;

        // ainda existe no DOM?
        if (!thumb.isConnected) return;

        thumb.textContent = '';
        if ((rec.type || '').startsWith('image')) {
          const img = document.createElement('img');
          img.src = url;
          thumb.appendChild(img);
        } else {
          const vid = document.createElement('video');
          vid.src = url;
          vid.muted = true;
          vid.playsInline = true;
          thumb.appendChild(vid);
        }
      })().catch(() => {});
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
        media: [], // refs: [{id,type,ref,notes}]
        createdAt: Date.now()
      });
    }

    saveExercises(all);
    closeModal(modalEx);
    renderExercises();
    renderDays();
  };
}

/* ===================== TREINO: DETALHE DO EXERCÍCIO ===================== */
const exTitle = qs('#ex-title');
const exNotes = qs('#ex-notes');
const exDone  = qs('#ex-done');
const exMediaGrid  = qs('#ex-media-grid');
const exMediaInput = qs('#ex-media-input');

/* ===== HERO (EXERCÍCIO) ===== */
const exHero = qs('#ex-hero');
const exHeroImg = qs('#ex-hero-img');
const exHeroVideo = qs('#ex-hero-video');
let currentExHeroMediaLocalId = null;

function exHeroClear(){
  currentExHeroMediaLocalId = null;

  if (exHeroImg) {
    exHeroImg.style.display = 'none';
    exHeroImg.src = '';
  }
  if (exHeroVideo) {
    try { exHeroVideo.pause(); } catch {}
    exHeroVideo.style.display = 'none';
    exHeroVideo.src = '';
  }

  if (exHero) exHero.classList.add('is-hidden');
}

async function exHeroShowByLocalId(mediaLocalId){
  const ex = getCurrentExercise();
  if (!ex) return;

  const item = (ex.media || []).find(x => x.id === mediaLocalId);
  if (!item?.ref) { exHeroClear(); return; }

  const rec = await mediaGetRecord(item.ref);
  if (!rec?.blob) { exHeroClear(); return; }

  const url = await getMediaObjectURL(item.ref);
  if (!url) { exHeroClear(); return; }

  currentExHeroMediaLocalId = mediaLocalId;

  if (exHero) exHero.classList.remove('is-hidden');

  if ((rec.type || '').startsWith('image')) {
    if (exHeroVideo) {
      try { exHeroVideo.pause(); } catch {}
      exHeroVideo.style.display = 'none';
      exHeroVideo.src = '';
    }
    if (exHeroImg) {
      exHeroImg.src = url;
      exHeroImg.style.display = 'block';
    }
  } else {
    if (exHeroImg) {
      exHeroImg.style.display = 'none';
      exHeroImg.src = '';
    }
    if (exHeroVideo) {
      exHeroVideo.src = url;
      exHeroVideo.style.display = 'block';
    }
  }
}

/* ✅ HERO (EXERCÍCIO): swipe para anterior/seguinte (sem abrir lightbox) */
function exGetMediaIdsInOrder() {
  const ex = getCurrentExercise();
  return (ex?.media || []).map(x => x.id).filter(Boolean);
}

async function exHeroGo(delta) {
  const ids = exGetMediaIdsInOrder();
  if (!ids.length) return;

  let idx = ids.indexOf(currentExHeroMediaLocalId);
  if (idx === -1) idx = 0;

  idx = (idx + delta + ids.length) % ids.length;
  await exHeroShowByLocalId(ids[idx]);
}

(function enableExHeroSwipe() {
  if (!exHero) return;

  let startX = 0, startY = 0, touching = false;

  exHero.addEventListener('touchstart', (e) => {
    if (!currentExHeroMediaLocalId) return;
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    touching = true;
  }, { passive: true });

  exHero.addEventListener('touchend', async (e) => {
    if (!touching) return;
    touching = false;

    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;

    // swipe horizontal claro
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (dx < 0) await exHeroGo(+1); // esquerda -> seguinte
      else        await exHeroGo(-1); // direita -> anterior
    }
  }, { passive: true });
})();

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

async function openExerciseDetail() {
  const ex = getCurrentExercise();
  if (!ex) return;

  if (exTitle) exTitle.textContent = ex.name || 'Exercício';
  if (exNotes) exNotes.value = ex.notesLong || '';
  if (exDone)  exDone.checked = !!ex.done;

  renderExerciseMedia();
  openScreen('screenExercise');

  // ✅ ao entrar, mostrar logo a 1ª foto/vídeo (se existir)
  const firstId = (ex.media || [])[0]?.id || null;
  if (firstId) await exHeroShowByLocalId(firstId);
  else exHeroClear();
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

/* ========= Upload media (IndexedDB + refs) ========= */
if (exMediaInput) {
  exMediaInput.onchange = async () => {
    const ex = getCurrentExercise();
    if (!ex) return;

    const mediaRefs = Array.isArray(ex.media) ? [...ex.media] : [];

    for (const file of (exMediaInput.files || [])) {
      if (file.type.startsWith('image')) {
        try {
          const blob = await compressImageToBlob(file, { maxSize: 1280, quality: 0.72 });
          const ref  = await mediaAddBlob({ type: 'image/jpeg', blob });
          mediaRefs.push({ id: uid(), type: 'image/jpeg', ref, notes: '' });
        } catch (e) {
          console.error(e);
          alert('Não foi possível processar esta imagem.');
        }
      } else if (file.type.startsWith('video')) {
        try {
          const ref = await mediaAddBlob({ type: file.type, blob: file });
          mediaRefs.push({ id: uid(), type: file.type, ref, notes: '' });
        } catch (e) {
          console.error(e);
          alert('Não foi possível guardar este vídeo.');
        }
      }
    }

    saveCurrentExercise({ media: mediaRefs });
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
  const mediaArr = Array.isArray(ex.media) ? ex.media : [];

  mediaArr.forEach(m => {
    const wrap = document.createElement('div');
    wrap.className = 'media-item';

    const placeholder = document.createElement('div');
    placeholder.style.fontSize = '22px';
    placeholder.style.display = 'grid';
    placeholder.style.placeItems = 'center';
    placeholder.textContent = '⏳';
    wrap.appendChild(placeholder);

    (async () => {
      const rec = m?.ref ? await mediaGetRecord(m.ref) : null;
      if (!rec?.blob) return;

      const url = await getMediaObjectURL(m.ref);
      if (!url) return;
      if (!wrap.isConnected) return;

      if (wrap.contains(placeholder)) wrap.removeChild(placeholder);

      const el = document.createElement((rec.type || '').startsWith('image') ? 'img' : 'video');
      el.src = url;

      if (!(rec.type || '').startsWith('image')) {
        el.muted = true;
        el.playsInline = true;
      }

      // ✅ clicar na miniatura troca o HERO
      el.onclick = async () => {
        await exHeroShowByLocalId(m.id);
      };

      const del = document.createElement('button');
      del.textContent = '×';
      del.onclick = async (ev) => {
        ev.stopPropagation();

        const exNow = getCurrentExercise();
        if (!exNow) return;

        const updated = (exNow.media || []).filter(x => x.id !== m.id);
        saveCurrentExercise({ media: updated });

        // ✅ se apagou o que estava no hero, escolher novo hero (ou esconder)
        if (currentExHeroMediaLocalId === m.id) {
          const nextId = updated[0]?.id || null;
          if (nextId) await exHeroShowByLocalId(nextId);
          else exHeroClear();
        } else {
          // se não havia hero e agora ainda há media, manter comportamento normal
          if (!currentExHeroMediaLocalId) {
            const firstId = updated[0]?.id || null;
            if (firstId) await exHeroShowByLocalId(firstId);
          }
        }

        renderExerciseMedia();
        renderExercises();
        renderDays();
      };

      wrap.append(el, del);
    })().catch(() => {});

    exMediaGrid.appendChild(wrap);
  });

  // ✅ se não há media, garantir hero escondido
  if (!mediaArr.length) exHeroClear();
}

/* =========================================================
   LIGHTBOX (galeria) — treino + alimentação
========================================================= */
const lb = {
  open: false,
  title: '',
  items: [],     // [{id, type, src(objectURL), notes}]
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

  if ((item.type || '').startsWith('image')) {
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
  if (vid) {
    vid.onclick = (e) => {
      e.stopPropagation();
      if (vid.paused) vid.play();
      else vid.pause();
    };
  }
}

(function lbEnableSwipe(){
  const box = qs('#lightbox');
  if (!box) return;

  let startX = 0, startY = 0, touching = false;

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

// fechar ao clicar fora do conteúdo
(function bindLightboxBackdropClose(){
  const box = qs('#lightbox');
  const content = qs('#lightbox .lightbox-content');
  if (!box || !content) return;

  box.addEventListener('click', (e) => {
    if (e.target === box) {
      try { qs('#lightbox-video')?.pause?.(); } catch {}
      box.style.display = 'none';
      lb.open = false;
    }
  });
})();

/* ---------- abrir lightbox do TREINO ---------- */
async function openMediaLightbox(title, mediaLocalId) {
  const ex = getCurrentExercise();
  if (!ex) return;

  const refs = Array.isArray(ex.media) ? ex.media : [];
  const idx = refs.findIndex(x => x.id === mediaLocalId);
  if (idx === -1) return;

  const items = [];
  for (const x of refs) {
    if (!x?.ref) continue;
    const rec = await mediaGetRecord(x.ref);
    if (!rec?.blob) continue;
    const url = await getMediaObjectURL(x.ref);
    if (!url) continue;
    items.push({ id: x.id, type: rec.type || x.type || 'image/jpeg', src: url, notes: x.notes || '' });
  }

  const idx2 = items.findIndex(x => x.id === mediaLocalId);
  if (idx2 === -1) return;

  lb.title = title;
  lb.items = items.map(x => ({ ...x }));
  lb.index = idx2;

  lb.saveNotes = (id, value) => {
    const exNow = getCurrentExercise();
    if (!exNow) return;
    const media = Array.isArray(exNow.media) ? [...exNow.media] : [];
    const i = media.findIndex(x => x.id === id);
    if (i !== -1) {
      media[i] = { ...media[i], notes: value };
      saveCurrentExercise({ media });
    }
  };

  lbShow();
}

/* FECHAR LIGHTBOX (botão ×) */
if (qs('.lightbox-close')) {
  qs('.lightbox-close').onclick = () => {
    const box = qs('#lightbox');
    const vid = qs('#lightbox-video');
    if (box) box.style.display = 'none';
    try { vid.pause(); } catch {}
    lb.open = false;
  };
}

/* =========================================================
   ALIMENTAÇÃO — estado/modais
========================================================= */
let currentMealTypeId = null;
let currentMealId = null;

let editingMealTypeId = null;
let editingMealId = null;

const mealTypesList = qs('#mealtypes-list');
const mealsList = qs('#meals-list');

const modalMealType = qs('#modal-mealtype');
const modalMeal = qs('#modal-meal');

function openModalX(el){ if (el) el.style.display = 'flex'; }
function closeModalX(el){ if (el) el.style.display = 'none'; }

if (qs('#close-mealtype-modal')) qs('#close-mealtype-modal').onclick = () => closeModalX(modalMealType);
if (qs('#close-meal-modal'))     qs('#close-meal-modal').onclick     = () => closeModalX(modalMeal);

if (modalMealType) modalMealType.addEventListener('click', e => { if (e.target === modalMealType) closeModalX(modalMealType); });
if (modalMeal)     modalMeal.addEventListener('click',     e => { if (e.target === modalMeal)     closeModalX(modalMeal); });

/* ===================== TIPOS DE REFEIÇÃO ===================== */
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

/* ===================== REFEIÇÕES DO TIPO ===================== */
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
    thumb.textContent = '🍽️';

    const firstRef = (m.media || [])[0]?.ref;
    if (firstRef) {
      (async () => {
        const rec = await mediaGetRecord(firstRef);
        if (!rec?.blob) return;

        const url = await getMediaObjectURL(firstRef);
        if (!url) return;

        if (!thumb.isConnected) return;

        thumb.textContent = '';
        if ((rec.type || '').startsWith('image')) {
          const img = document.createElement('img');
          img.src = url;
          thumb.appendChild(img);
        } else {
          const vid = document.createElement('video');
          vid.src = url;
          vid.muted = true;
          vid.playsInline = true;
          thumb.appendChild(vid);
        }
      })().catch(() => {});
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

/* ===================== DETALHE DA REFEIÇÃO ===================== */
const mealTitleEl = qs('#meal-title');
const mealNotesEl = qs('#meal-notes');
const mealMediaGrid  = qs('#meal-media-grid');
const mealMediaInput = qs('#meal-media-input');

/* ===== HERO (REFEIÇÃO) ===== */
const mealHero = qs('#meal-hero');
const mealHeroImg = qs('#meal-hero-img');
const mealHeroVideo = qs('#meal-hero-video');
let currentMealHeroMediaLocalId = null;

function mealHeroClear(){
  currentMealHeroMediaLocalId = null;

  if (mealHeroImg) {
    mealHeroImg.style.display = 'none';
    mealHeroImg.src = '';
  }
  if (mealHeroVideo) {
    try { mealHeroVideo.pause(); } catch {}
    mealHeroVideo.style.display = 'none';
    mealHeroVideo.src = '';
  }

  if (mealHero) mealHero.classList.add('is-hidden');
}

async function mealHeroShowByLocalId(mediaLocalId){
  const meal = getCurrentMeal();
  if (!meal) return;

  const item = (meal.media || []).find(x => x.id === mediaLocalId);
  if (!item?.ref) { mealHeroClear(); return; }

  const rec = await mediaGetRecord(item.ref);
  if (!rec?.blob) { mealHeroClear(); return; }

  const url = await getMediaObjectURL(item.ref);
  if (!url) { mealHeroClear(); return; }

  currentMealHeroMediaLocalId = mediaLocalId;

  if (mealHero) mealHero.classList.remove('is-hidden');

  if ((rec.type || '').startsWith('image')) {
    if (mealHeroVideo) {
      try { mealHeroVideo.pause(); } catch {}
      mealHeroVideo.style.display = 'none';
      mealHeroVideo.src = '';
    }
    if (mealHeroImg) {
      mealHeroImg.src = url;
      mealHeroImg.style.display = 'block';
    }
  } else {
    if (mealHeroImg) {
      mealHeroImg.style.display = 'none';
      mealHeroImg.src = '';
    }
    if (mealHeroVideo) {
      mealHeroVideo.src = url;
      mealHeroVideo.style.display = 'block';
    }
  }
}

/* ✅ HERO (REFEIÇÃO): swipe para anterior/seguinte (sem abrir lightbox) */
function mealGetMediaIdsInOrder() {
  const m = getCurrentMeal();
  return (m?.media || []).map(x => x.id).filter(Boolean);
}

async function mealHeroGo(delta) {
  const ids = mealGetMediaIdsInOrder();
  if (!ids.length) return;

  let idx = ids.indexOf(currentMealHeroMediaLocalId);
  if (idx === -1) idx = 0;

  idx = (idx + delta + ids.length) % ids.length;
  await mealHeroShowByLocalId(ids[idx]);
}

(function enableMealHeroSwipe() {
  if (!mealHero) return;

  let startX = 0, startY = 0, touching = false;

  mealHero.addEventListener('touchstart', (e) => {
    if (!currentMealHeroMediaLocalId) return;
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    touching = true;
  }, { passive: true });

  mealHero.addEventListener('touchend', async (e) => {
    if (!touching) return;
    touching = false;

    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;

    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (dx < 0) await mealHeroGo(+1);
      else        await mealHeroGo(-1);
    }
  }, { passive: true });
})();

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

async function openMealDetail() {
  const m = getCurrentMeal();
  if (!m) return;

  if (mealTitleEl) mealTitleEl.textContent = m.title || 'Refeição';
  if (mealNotesEl) mealNotesEl.value = m.notes || '';

  renderMealMedia();
  openScreen('screenMeal');

  // ✅ ao entrar, mostrar logo a 1ª foto/vídeo (se existir)
  const firstId = (m.media || [])[0]?.id || null;
  if (firstId) await mealHeroShowByLocalId(firstId);
  else mealHeroClear();
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

/* ========= Upload media (IndexedDB + refs) ========= */
if (mealMediaInput) {
  mealMediaInput.onchange = async () => {
    const m = getCurrentMeal();
    if (!m) return;

    const mediaRefs = Array.isArray(m.media) ? [...m.media] : [];

    for (const file of (mealMediaInput.files || [])) {
      if (file.type.startsWith('image')) {
        try {
          const blob = await compressImageToBlob(file, { maxSize: 1280, quality: 0.72 });
          const ref  = await mediaAddBlob({ type: 'image/jpeg', blob });
          mediaRefs.push({ id: uid(), type: 'image/jpeg', ref, notes: '' });
        } catch (e) {
          console.error(e);
          alert('Não foi possível processar esta imagem.');
        }
      } else if (file.type.startsWith('video')) {
        try {
          const ref = await mediaAddBlob({ type: file.type, blob: file });
          mediaRefs.push({ id: uid(), type: file.type, ref, notes: '' });
        } catch (e) {
          console.error(e);
          alert('Não foi possível guardar este vídeo.');
        }
      }
    }

    saveCurrentMeal({ media: mediaRefs });
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
  const mediaArr = Array.isArray(m.media) ? m.media : [];

  mediaArr.forEach(x => {
    const wrap = document.createElement('div');
    wrap.className = 'media-item';

    const placeholder = document.createElement('div');
    placeholder.style.fontSize = '22px';
    placeholder.style.display = 'grid';
    placeholder.style.placeItems = 'center';
    placeholder.textContent = '⏳';
    wrap.appendChild(placeholder);

    (async () => {
      const rec = x?.ref ? await mediaGetRecord(x.ref) : null;
      if (!rec?.blob) return;

      const url = await getMediaObjectURL(x.ref);
      if (!url) return;

      if (!wrap.isConnected) return;
      if (wrap.contains(placeholder)) wrap.removeChild(placeholder);

      const el = document.createElement((rec.type || '').startsWith('image') ? 'img' : 'video');
      el.src = url;

      if (!(rec.type || '').startsWith('image')) {
        el.muted = true;
        el.playsInline = true;
      }

      // ✅ clicar na miniatura troca o HERO
      el.onclick = async () => {
        await mealHeroShowByLocalId(x.id);
      };

      const del = document.createElement('button');
      del.textContent = '×';
      del.onclick = async (ev) => {
        ev.stopPropagation();

        const mealNow = getCurrentMeal();
        if (!mealNow) return;

        const updated = (mealNow.media || []).filter(z => z.id !== x.id);
        saveCurrentMeal({ media: updated });

        // ✅ se apagou o que estava no hero, escolher novo hero (ou esconder)
        if (currentMealHeroMediaLocalId === x.id) {
          const nextId = updated[0]?.id || null;
          if (nextId) await mealHeroShowByLocalId(nextId);
          else mealHeroClear();
        } else {
          if (!currentMealHeroMediaLocalId) {
            const firstId = updated[0]?.id || null;
            if (firstId) await mealHeroShowByLocalId(firstId);
          }
        }

        renderMealMedia();
        renderMeals();
        renderMealTypes();
      };

      wrap.append(el, del);
    })().catch(() => {});

    mealMediaGrid.appendChild(wrap);
  });

  if (!mediaArr.length) mealHeroClear();
}

/* ---------- abrir lightbox da ALIMENTAÇÃO ---------- */
async function openMealMediaLightbox(title, mediaLocalId) {
  const meal = getCurrentMeal();
  if (!meal) return;

  const refs = Array.isArray(meal.media) ? meal.media : [];
  const idx = refs.findIndex(x => x.id === mediaLocalId);
  if (idx === -1) return;

  const items = [];
  for (const x of refs) {
    if (!x?.ref) continue;
    const rec = await mediaGetRecord(x.ref);
    if (!rec?.blob) continue;
    const url = await getMediaObjectURL(x.ref);
    if (!url) continue;
    items.push({ id: x.id, type: rec.type || x.type || 'image/jpeg', src: url, notes: x.notes || '' });
  }

  const idx2 = items.findIndex(x => x.id === mediaLocalId);
  if (idx2 === -1) return;

  lb.title = title;
  lb.items = items.map(x => ({ ...x }));
  lb.index = idx2;

  lb.saveNotes = (id, value) => {
    const mealNow = getCurrentMeal();
    if (!mealNow) return;
    const media = Array.isArray(mealNow.media) ? [...mealNow.media] : [];
    const i = media.findIndex(x => x.id === id);
    if (i !== -1) {
      media[i] = { ...media[i], notes: value };
      saveCurrentMeal({ media });
    }
  };

  lbShow();
}

/* =========================================================
   ✅ PROGRESSO — TABS (Registos / Comparar)
========================================================= */
const tabRecords = qs('#tab-progress-records');
const tabCompare = qs('#tab-progress-compare');
const panelRecords = qs('#progress-panel-records');
const panelCompare = qs('#progress-panel-compare');

function setProgressTab(name) {
  const isRecords = name === 'records';

  tabRecords?.classList.toggle('active', isRecords);
  tabCompare?.classList.toggle('active', !isRecords);

  tabRecords?.setAttribute('aria-selected', isRecords ? 'true' : 'false');
  tabCompare?.setAttribute('aria-selected', !isRecords ? 'true' : 'false');

  panelRecords?.classList.toggle('active', isRecords);
  panelCompare?.classList.toggle('active', !isRecords);

  // quando abre "Comparar", refresca lista + grid
  if (!isRecords) {
    renderComparePicker();
    renderCompareGrid();
  }
}

tabRecords?.addEventListener('click', () => setProgressTab('records'));
tabCompare?.addEventListener('click', () => setProgressTab('compare'));

/* =========================================================
   ✅ PROGRESSO — COMPARAR FOTOS (picker + grid)
========================================================= */
const comparePickerList = qs('#compare-picker-list');
const compareGrid = qs('#compare-grid');
const compareApplyBtn = qs('#compare-apply');
const compareClearBtn = qs('#compare-clear');

// guarda ids selecionados
let compareSelectedIds = new Set();

function fmtKg(w) {
  const n = Number(w);
  if (Number.isFinite(n)) return `${n.toFixed(1)} kg`;
  return '';
}

function getSortedProgressDesc() {
  const data = loadProgress();
  return [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function hasAnyProgressPhotos(r) {
  const p = r?.photos || {};
  return !!(p.front || p.side || p.back);
}

function renderComparePicker() {
  if (!comparePickerList) return;

  const data = getSortedProgressDesc();

  comparePickerList.innerHTML = '';

  // se não há registos
  if (!data.length) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.innerHTML = `<div class="card-title">Sem registos</div>
      <div style="color:#6b7280;font-size:13px;">Cria registos no separador “Registos”.</div>`;
    comparePickerList.appendChild(empty);
    return;
  }

  // limpar seleções que já não existam
  const existingIds = new Set(data.map(r => r.id));
  compareSelectedIds = new Set([...compareSelectedIds].filter(id => existingIds.has(id)));

  data.forEach(r => {
    const card = document.createElement('div');
    card.className = 'list-card';

    const left = document.createElement('div');
    left.className = 'list-left';

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'small-check';
    check.checked = compareSelectedIds.has(r.id);

    check.onclick = ev => ev.stopPropagation();
    check.onchange = () => {
      if (check.checked) compareSelectedIds.add(r.id);
      else compareSelectedIds.delete(r.id);
    };

    const text = document.createElement('div');
    const hasPhotos = hasAnyProgressPhotos(r);
    text.innerHTML = `
      <div class="list-title">${r.date || '—'}${r.weight != null ? ` • ${fmtKg(r.weight)}` : ''}</div>
      <div class="list-sub">${hasPhotos ? '✅ tem fotos (Frente/Lado/Costas)' : '— sem fotos'}</div>
    `;

    left.append(check, text);
    card.append(left);

    // clicar na linha também alterna
    card.onclick = () => {
      check.checked = !check.checked;
      check.dispatchEvent(new Event('change'));
    };

    comparePickerList.appendChild(card);
  });
}

async function renderCompareGrid() {
  if (!compareGrid) return;

  const data = getSortedProgressDesc();
  const selected = data.filter(r => compareSelectedIds.has(r.id));

  compareGrid.innerHTML = '';

  if (selected.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.innerHTML = `<div class="card-title">Nada selecionado</div>
      <div style="color:#6b7280;font-size:13px;">Seleciona registos acima e carrega em “Comparar”.</div>`;
    compareGrid.appendChild(empty);
    return;
  }

  // cria as linhas por registo
  for (const r of selected) {
    const row = document.createElement('div');
    row.className = 'compare-row';

    const badge = document.createElement('div');
    badge.className = 'compare-badge';
    badge.textContent = `${r.date || '—'}${r.weight != null ? ` • ${fmtKg(r.weight)}` : ''}`;

    const photosWrap = document.createElement('div');
    photosWrap.className = 'compare-photos';

    // 3 slots fixos: front/side/back
    const positions = [
      { key: 'front', label: 'Frente' },
      { key: 'side',  label: 'Lado' },
      { key: 'back',  label: 'Costas' }
    ];

    for (const pos of positions) {
      const cell = document.createElement('div');
      cell.className = 'compare-photo';

      const ref = r?.photos?.[pos.key] || null;
      if (!ref) {
        // placeholder simples
        const ph = document.createElement('div');
        ph.style.width = '100%';
        ph.style.height = '100%';
        ph.style.display = 'grid';
        ph.style.placeItems = 'center';
        ph.style.color = '#6b7280';
        ph.style.fontSize = '12px';
        ph.style.fontWeight = '800';
        ph.textContent = pos.label;
        cell.appendChild(ph);
      } else {
        try {
          const url = await getMediaObjectURL(ref);
          if (url) {
            const img = document.createElement('img');
            img.src = url;
            img.alt = `${pos.label} — ${r.date || ''}`;
            cell.appendChild(img);

            // click abre no lightbox (simples: só esta imagem)
            img.onclick = () => {
              lb.title = `Progresso • ${r.date || ''}`;
              lb.items = [{ id: `${r.id}-${pos.key}`, type: 'image/jpeg', src: url, notes: '' }];
              lb.index = 0;
              lb.saveNotes = null;
              lbShow();
            };
          }
        } catch (e) {
          // se falhar, deixa placeholder
        }
      }

      photosWrap.appendChild(cell);
    }

    row.append(badge, photosWrap);
    compareGrid.appendChild(row);
  }
}

if (compareApplyBtn) {
  compareApplyBtn.onclick = () => {
    // só desenha o grid com o que já está selecionado
    renderCompareGrid();
  };
}

if (compareClearBtn) {
  compareClearBtn.onclick = () => {
    compareSelectedIds.clear();
    renderComparePicker();
    renderCompareGrid();
  };
}

/* =========================================================
   PROGRESSO
========================================================= */
let chart = null;
let editingProgressId = null;

/* ✅ PROGRESSO: Preview das 3 fotos (Frente/Lado/Costas) */
function bindProgressPhotoPreview(inputSel, imgSel) {
  const input = qs(inputSel);
  const img = qs(imgSel);
  if (!input || !img) return;

  let lastUrl = null;

  input.addEventListener('change', () => {
    const file = input.files?.[0];

    if (lastUrl) {
      try { URL.revokeObjectURL(lastUrl); } catch {}
      lastUrl = null;
    }

    if (!file) {
      img.src = '';
      img.classList.remove('is-visible');
      return;
    }

    lastUrl = URL.createObjectURL(file);
    img.src = lastUrl;
    img.classList.add('is-visible');
  });
}

bindProgressPhotoPreview('#progress-photo-front', '#progress-photo-front-preview');
bindProgressPhotoPreview('#progress-photo-side',  '#progress-photo-side-preview');
bindProgressPhotoPreview('#progress-photo-back',  '#progress-photo-back-preview');

// ✅ Trocar fotos (abre o seletor do input correspondente)
function bindSwapButton(btnSel, inputSel) {
  const btn = qs(btnSel);
  const input = qs(inputSel);
  if (!btn || !input) return;

  btn.addEventListener('click', () => input.click());
}

bindSwapButton('#swap-front', '#progress-photo-front');
bindSwapButton('#swap-side',  '#progress-photo-side');
bindSwapButton('#swap-back',  '#progress-photo-back');

// ✅ Remover foto (×) — funciona no "Novo Registo" e no "Editar Registo"
async function removeProgressPhoto(pos) {
  // pos: 'front' | 'side' | 'back'
  const input = qs(`#progress-photo-${pos}`);
  const img   = qs(`#progress-photo-${pos}-preview`);

  // 1) Se existir ficheiro escolhido (ainda não guardado), limpa só o input + preview
  if (input) input.value = '';
  if (img) {
    img.src = '';
    img.classList.remove('is-visible');
  }

  // 2) Se estivermos a editar um registo existente, também remove do registo + apaga do IDB
  if (!editingProgressId) return;

  const data = loadProgress();
  const idx = data.findIndex(r => r.id === editingProgressId);
  if (idx === -1) return;

  const photos = data[idx].photos || {};
  const ref = photos[pos];

  // já está "vazio"
  if (!ref) {
    data[idx].photos = { ...photos, [pos]: null };
    saveProgress(data);
    renderProgress();
    renderComparePicker();
    renderCompareGrid();
    return;
  }

  // apaga do IDB + limpa ref no registo
  try {
    await mediaDelete(ref);
    revokeMediaObjectURL(ref);
  } catch {}

  data[idx].photos = { ...photos, [pos]: null };
  saveProgress(data);

  // refresca UI
  renderProgress();
  renderComparePicker();
  renderCompareGrid();
}

// bind dos 3 botões ×
// ✅ Delegation: funciona mesmo se o DOM ainda não existia quando o script correu
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.progress-photo-remove');
  if (!btn) return;

  e.preventDefault();
  e.stopPropagation();

  const pos = btn.dataset.pos; // front|side|back
  if (!pos) return;

  await removeProgressPhoto(pos);
});

if (qs('#add-record-btn')) {
  qs('#add-record-btn').onclick = () => {
    editingProgressId = null;

    qs('#modal-progress-title').textContent = 'Novo Registo';
    qs('#progress-form')?.reset?.();

    // ✅ limpar previews
    ['front', 'side', 'back'].forEach(pos => {
      const img = qs(`#progress-photo-${pos}-preview`);
      if (img) {
        img.src = '';
        img.classList.remove('is-visible');
      }
      const input = qs(`#progress-photo-${pos}`);
      if (input) input.value = '';
    });

    openModal(modalProgress);
  };
}

if (qs('#cancel-btn')) {
  qs('#cancel-btn').onclick = () => {
    editingProgressId = null;
    closeModal(modalProgress);
  };
}

if (qs('#progress-form')) {
  qs('#progress-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = loadProgress();

    // ler fotos (se existirem)
    const fFront = qs('#progress-photo-front')?.files?.[0] || null;
    const fSide  = qs('#progress-photo-side')?.files?.[0]  || null;
    const fBack  = qs('#progress-photo-back')?.files?.[0]  || null;

    // helper para guardar 1 foto (com compressão) e devolver ref
    async function savePhoto(file) {
      if (!file) return null;
      try {
        const blob = await compressImageToBlob(file, { maxSize: 1280, quality: 0.72 });
        const ref  = await mediaAddBlob({ type: 'image/jpeg', blob });
        return ref;
      } catch (err) {
        console.error(err);
        alert('Não foi possível processar uma das fotos.');
        return null;
      }
    }
    const payload = {
      date: qs('#date').value,
      weight: parseFloat(qs('#weight').value),
      notes: qs('#notes').value,
      
      // ✅ NOVO: 3 refs fixas no registo de progresso
      photos: {
        front: await savePhoto(fFront),
        side:  await savePhoto(fSide),
        back:  await savePhoto(fBack)
      }
    };

    if (editingProgressId) {
      const idx = data.findIndex(x => x.id === editingProgressId);
      if (idx !== -1) {
        const old = data[idx]?.photos || {};
        
        // ✅ se escolheu nova foto, apagar a anterior (evita lixo no IDB)
        for (const k of ['front', 'side', 'back']) {
          const newRef = payload.photos[k];
          const oldRef = old[k];
          
          if (newRef && oldRef && newRef !== oldRef) {
            try {
              await mediaDelete(oldRef);
              revokeMediaObjectURL(oldRef);
            } catch {}
          }
        }
        
        data[idx] = {
          ...data[idx],
          ...payload,
          photos: {
            front: payload.photos.front || old.front || null,
            side:  payload.photos.side  || old.side  || null,
            back:  payload.photos.back  || old.back  || null
          }
        };
      }
    } else {
      data.push({ id: uid(), ...payload });
    }
    
    saveProgress(data);
    editingProgressId = null;

    // limpar inputs
    e.target.reset();
    closeModal(modalProgress);
    renderProgress();
    
    // ✅ limpar previews (mantém o CSS consistente com o botão ×)
    ['front', 'side', 'back'].forEach(pos => {
      const img = qs(`#progress-photo-${pos}-preview`);
      if (img) {
        img.src = '';
        img.classList.remove('is-visible');
      }
    });
  };
}

function renderProgress() {
  const list = qs('#progress-list');
  if (!list) return;

  const data = loadProgress();
  list.innerHTML = '';

  const sortedDesc = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
    editBtn.onclick = async () => {
      editingProgressId = r.id;
      qs('#date').value = r.date || '';
      qs('#weight').value = (r.weight ?? '');
      qs('#notes').value = r.notes || '';
      qs('#modal-progress-title').textContent = 'Editar Registo';
      
      // ✅ limpar inputs (para não ficarem ficheiros anteriores)
      ['front', 'side', 'back'].forEach(pos => {
        const input = qs(`#progress-photo-${pos}`);
        if (input) input.value = '';
      });
      
      // ✅ mostrar previews das fotos já guardadas (se existirem)
      // ✅ + permitir abrir em grande (lightbox)
      // (IMPORTANTE: usar a classe .is-visible, porque é isso que faz aparecer o botão × no CSS)
      const photos = r.photos || {};
      
      for (const pos of ['front', 'side', 'back']) {
        const img = qs(`#progress-photo-${pos}-preview`);
        if (!img) continue;
        
        // reset completo
        img.src = '';
        img.onclick = null;
        img.classList.remove('is-visible');
        img.style.display = 'none';
        
        const ref = photos[pos];
        if (!ref) continue;
        
        const url = await getMediaObjectURL(ref);
        if (!url) continue;
        
        // mostrar preview
        img.src = url;
        img.classList.add('is-visible');
        img.style.display = 'block';
        
        // ✅ abrir em grande (Android-friendly)
        img.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          lb.title = `Progresso • ${r.date || ''}`;
          lb.items = [{
            id: `${r.id}-${pos}`,
            type: 'image/jpeg',
            src: url,
            notes: ''
          }];
          lb.index = 0;
          lb.saveNotes = null;
          lbShow();
        };
      }
           
      openModal(modalProgress);
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'remove-btn';
    delBtn.textContent = '×';
    delBtn.title = 'Eliminar';
    delBtn.onclick = async () => {
      const ok = confirm('Eliminar este registo?');
      if (!ok) return;
      
      const fresh = loadProgress();
      const idx = fresh.findIndex(x => x.id === r.id);
      if (idx === -1) return;
      
      // ✅ apagar fotos associadas ao registo (se existirem)
      const photos = fresh[idx]?.photos || {};
      for (const k of ['front', 'side', 'back']) {
        const ref = photos[k];
        if (ref) {
          try {
            await mediaDelete(ref);
            revokeMediaObjectURL(ref);
          } catch {}
        }
      }
      
      // remover registo
      fresh.splice(idx, 1);
      saveProgress(fresh);
      
      renderProgress();
      
      // se estiver no separador comparar, refresca também
      renderComparePicker();
      renderCompareGrid();
    };

    actions.append(editBtn, delBtn);
    row.append(left, actions);
    list.appendChild(row);

    // ✅ clicar no registo abre ecrã só com fotos
    row.onclick = () => openProgressPhotosView(r.id);
  });

  const sortedAsc = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const sumInitial = qs('#sum-initial');
  const sumCurrent = qs('#sum-current');
  const sumDiff = qs('#sum-diff');

  if (sumInitial && sumCurrent && sumDiff) {
    if (sortedAsc.length === 0) {
      sumInitial.textContent = '—';
      sumCurrent.textContent = '—';
      sumDiff.textContent = '—';
    } else {
      const initial = Number(sortedAsc[0].weight);
      const current = Number(sortedAsc[sortedAsc.length - 1].weight);
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
   MENU ⋯ + EXPORTAR / IMPORTAR + LIMPEZA
========================================================= */
const moreBtn = qs('#more-btn');
const moreMenu = qs('#more-menu');

const openExportBtn = qs('#open-export');
const openImportBtn = qs('#open-import');
const openCleanBtn  = qs('#open-clean');
const closeMoreBtn  = qs('#close-more');

const modalExport = qs('#modal-export');
const modalImport = qs('#modal-import');
const modalClean  = qs('#modal-clean');

/* --- menu ⋯ --- */
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

/* ===================== EXPORT ===================== */
if (qs('#close-export-modal')) qs('#close-export-modal').onclick = () => closeModal(modalExport);
if (modalExport) modalExport.addEventListener('click', e => { if (e.target === modalExport) closeModal(modalExport); });

if (openExportBtn) openExportBtn.onclick = () => { hideMoreMenu(); openModal(modalExport); };
if (qs('#back-export')) qs('#back-export').onclick = () => { closeModal(modalExport); showMoreMenu(); };

async function mediaExportAll() {
  const ids = await mediaListIds();
  const items = {};

  for (const id of ids) {
    const rec = await mediaGetRecord(id);
    if (!rec?.blob) continue;
    const src = await blobToDataURL(rec.blob);
    items[id] = { id, type: rec.type || 'application/octet-stream', src, createdAt: rec.createdAt || Date.now() };
  }

  return { version: 1, items };
}

async function buildExportPayload(scope, includeMedia) {
  const payload = {
    app: 'App-Fitness',
    exportedAt: new Date().toISOString(),
    scope,
    includesMedia: !!includeMedia,
    data: {}
  };

  if (scope === 'all' || scope === 'train') {
    payload.data.train = { days: loadDays(), exercises: loadExercises() };
  }
  if (scope === 'all' || scope === 'food') {
    payload.data.food = { mealtypes: loadMealTypes(), meals: loadMeals() };
  }
  if (scope === 'all' || scope === 'progress') {
    payload.data.progress = { records: loadProgress() };
  }

  if (includeMedia) {
    payload.data.media = { store: await mediaExportAll() };
  }

  return payload;
}

async function doExport(scope) {
  const includeMedia = confirm('Exportar com fotos/vídeos? (OK = com, Cancelar = sem)');
  const p = await buildExportPayload(scope, includeMedia);

  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,'0');
  const d = String(date.getDate()).padStart(2,'0');

  const suffix = includeMedia ? 'COM_MEDIA' : 'SEM_MEDIA';
  downloadJSON(p, `App-Fitness_${scope}_${suffix}_${y}-${m}-${d}.json`);
}

if (qs('#exp-all'))      qs('#exp-all').onclick      = () => doExport('all');
if (qs('#exp-train'))    qs('#exp-train').onclick    = () => doExport('train');
if (qs('#exp-food'))     qs('#exp-food').onclick     = () => doExport('food');
if (qs('#exp-progress')) qs('#exp-progress').onclick = () => doExport('progress');

/* ===================== IMPORT ===================== */
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
if (modalImport) modalImport.addEventListener('click', e => {
  if (e.target === modalImport) { resetImportFlow(); closeModal(modalImport); }
});

if (openImportBtn) openImportBtn.onclick = () => { hideMoreMenu(); resetImportFlow(); openModal(modalImport); };

if (qs('#back-import-1')) qs('#back-import-1').onclick = () => { resetImportFlow(); closeModal(modalImport); showMoreMenu(); };
if (qs('#back-import-2')) qs('#back-import-2').onclick = () => showImportStep(1);
if (qs('#back-import-3')) qs('#back-import-3').onclick = () => showImportStep(2);

qsa('[data-imp-scope]').forEach(btn => {
  btn.addEventListener('click', () => {
    impScope = btn.dataset.impScope || 'all';
    showImportStep(2);
  });
});

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

/* ---- merge helpers ---- */
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

/* ---- Import: store IDB ---- */
async function mergeMediaStoreReplace_IDB(incomingStore) {
  const items = incomingStore?.items || {};
  await mediaClearAll();

  for (const [id, it] of Object.entries(items)) {
    if (!it) continue;

    // formato novo: src = dataURL
    if (typeof it.src === 'string' && it.src.startsWith('data:')) {
      const blob = dataURLToBlob(it.src);
      if (!blob) continue;
      await mediaPutBlobWithId({
        id,
        type: it.type || blob.type || 'application/octet-stream',
        blob,
        createdAt: it.createdAt || Date.now()
      });
    }
  }
}

async function mergeMediaStoreAdd_IDB(incomingStore) {
  const items = incomingStore?.items || {};
  const idMap = new Map();
  const existing = new Set(await mediaListIds());

  for (const [id, it] of Object.entries(items)) {
    if (!it) continue;
    if (typeof it.src !== 'string' || !it.src.startsWith('data:')) continue;

    let targetId = id;
    if (existing.has(id)) {
      targetId = uid();
      idMap.set(id, targetId);
    }

    const blob = dataURLToBlob(it.src);
    if (!blob) continue;

    await mediaPutBlobWithId({
      id: targetId,
      type: it.type || blob.type || 'application/octet-stream',
      blob,
      createdAt: it.createdAt || Date.now()
    });

    existing.add(targetId);
  }

  return idMap;
}

function remapMediaRefsInTrainAndFood(data, mediaIdMap) {
  if (!mediaIdMap || !(mediaIdMap instanceof Map) || mediaIdMap.size === 0) return;

  (data?.train?.exercises || []).forEach(ex => (ex.media || []).forEach(m => {
    if (m?.ref && mediaIdMap.has(m.ref)) m.ref = mediaIdMap.get(m.ref);
  }));

  (data?.food?.meals || []).forEach(meal => (meal.media || []).forEach(m => {
    if (m?.ref && mediaIdMap.has(m.ref)) m.ref = mediaIdMap.get(m.ref);
  }));
}

function remapMediaRefsInProgress(data, mediaIdMap) {
  if (!mediaIdMap || !(mediaIdMap instanceof Map) || mediaIdMap.size === 0) return;

  (data?.progress?.records || []).forEach(r => {
    const p = r?.photos;
    if (!p) return;

    for (const k of ['front', 'side', 'back']) {
      const ref = p[k];
      if (ref && mediaIdMap.has(ref)) p[k] = mediaIdMap.get(ref);
    }
  });
}

/* ---- Converter media inline (src base64) -> refs IDB ---- */
async function convertInlineSrcMediaToRefs_INCOMING_IDB(data, { idMapFromStore = null } = {}) {
  if (!data || typeof data !== 'object') return;

  async function ensureRef(item) {
    if (!item || typeof item !== 'object') return;

    // já tem ref? só remap se preciso
    if (item.ref) {
      if (idMapFromStore && idMapFromStore.has(item.ref)) item.ref = idMapFromStore.get(item.ref);
      if ('src' in item) delete item.src;
      return;
    }

    // src inline -> cria blob + guarda em IDB + ref
    if (typeof item.src === 'string' && item.src.startsWith('data:')) {
      const blob = dataURLToBlob(item.src);
      if (!blob) return;

      const type = item.type || blob.type || (item.src.startsWith('data:video') ? 'video/mp4' : 'image/jpeg');
      const ref = await mediaAddBlob({ type, blob });

      item.ref = ref;
      item.type = type;
      delete item.src;
    }
  }

  async function convertArray(arr) {
    if (!Array.isArray(arr)) return;
    for (const item of arr) await ensureRef(item);
  }

  const exs = data?.train?.exercises;
  if (Array.isArray(exs)) for (const ex of exs) if (Array.isArray(ex.media)) await convertArray(ex.media);

  const meals = data?.food?.meals;
  if (Array.isArray(meals)) for (const meal of meals) if (Array.isArray(meal.media)) await convertArray(meal.media);
}

/* ---- Apply import modes ---- */
async function applyReplace(scope, data) {
  if (data?.media?.store) await mergeMediaStoreReplace_IDB(data.media.store);
  await convertInlineSrcMediaToRefs_INCOMING_IDB(data);

  if (scope === 'all' || scope === 'train') {
    const t = data?.train;
    if (t?.days && t?.exercises) { saveDays(t.days); saveExercises(t.exercises); }
  }

  if (scope === 'all' || scope === 'food') {
    const f = data?.food;
    if (f?.mealtypes && f?.meals) { saveMealTypes(f.mealtypes); saveMeals(f.meals); }
  }

  if (scope === 'all' || scope === 'progress') {
    const p = data?.progress;
    if (p?.records) saveProgress(p.records);
  }
}

async function applyAdd(scope, data) {
  let mediaIdMap = null;
  if (data?.media?.store) {
    mediaIdMap = await mergeMediaStoreAdd_IDB(data.media.store);
    remapMediaRefsInTrainAndFood(data, mediaIdMap);
    remapMediaRefsInProgress(data, mediaIdMap);
  }

  await convertInlineSrcMediaToRefs_INCOMING_IDB(data, { idMapFromStore: mediaIdMap });

  if (scope === 'all' || scope === 'train') {
    const t = data?.train;
    if (t?.days && t?.exercises) {
      const daysRes = mergeArrayById(loadDays(), t.days);
      const dayIdMap = daysRes.idMap;

      const exRes = mergeArrayById(loadExercises(), t.exercises, {
        remap: (it) => ({ ...it, dayId: remapId(it.dayId, dayIdMap) })
      });

      saveDays(daysRes.merged);
      saveExercises(exRes.merged);
    }
  }

  if (scope === 'all' || scope === 'food') {
    const f = data?.food;
    if (f?.mealtypes && f?.meals) {
      const typesRes = mergeArrayById(loadMealTypes(), f.mealtypes);
      const typeIdMap = typesRes.idMap;

      const mealsRes = mergeArrayById(loadMeals(), f.meals, {
        remap: (it) => ({ ...it, mealTypeId: remapId(it.mealTypeId, typeIdMap) })
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

async function doImport(mode) {
  if (!impJson?.data) return alert('Nenhum ficheiro carregado.');

  const data = impJson.data;
  const hasTrain = !!data.train;
  const hasFood  = !!data.food;
  const hasProg  = !!data.progress;

  if (impScope === 'train'    && !hasTrain) return alert('Este ficheiro não tem dados de treino.');
  if (impScope === 'food'     && !hasFood)  return alert('Este ficheiro não tem dados de alimentação.');
  if (impScope === 'progress' && !hasProg)  return alert('Este ficheiro não tem dados de progresso.');
  if (impScope === 'all'      && !(hasTrain || hasFood || hasProg)) return alert('Este ficheiro não tem dados reconhecidos.');

  if (mode === 'replace') await applyReplace(impScope, data);
  else await applyAdd(impScope, data);

  afterImportRefresh();
  alert('Importação concluída ✅');

  resetImportFlow();
  closeModal(modalImport);
}

if (impReplaceBtn) impReplaceBtn.onclick = async () => {
  const ok = confirm('Substituir vai apagar os dados existentes nessa secção. Queres continuar?');
  if (!ok) return;
  await doImport('replace');
};

if (impAddBtn) impAddBtn.onclick = async () => {
  await doImport('add');
};

/* =========================================================
   LIMPEZA: remover media não usados (IndexedDB)
========================================================= */
function collectUsedMediaIds() {
  const used = new Set();

  // Treino
  loadExercises().forEach(ex => (ex.media || []).forEach(m => {
    if (m?.ref) used.add(m.ref);
  }));

  // Alimentação
  loadMeals().forEach(meal => (meal.media || []).forEach(m => {
    if (m?.ref) used.add(m.ref);
  }));

  // Progresso (Frente/Lado/Costas)
  loadProgress().forEach(r => {
    const p = r?.photos || {};
    if (p.front) used.add(p.front);
    if (p.side)  used.add(p.side);
    if (p.back)  used.add(p.back);
  });

  return used;
}

async function countMediaStats_IDB() {
  const all = await mediaListAllMeta();
  let bytes = 0;
  for (const it of all) bytes += (it.size || 0);
  return { count: all.length, bytes };
}

async function cleanUnusedMedia_IDB({ dryRun = true } = {}) {
  const used = collectUsedMediaIds();
  const all = await mediaListAllMeta();
  const unused = all.filter(x => !used.has(x.id));

  if (dryRun) {
    const before = await countMediaStats_IDB();
    const unusedBytes = unused.reduce((acc, x) => acc + (x.size || 0), 0);
    const afterBytes = Math.max(0, before.bytes - unusedBytes);
    return { unusedCount: unused.length, before, after: { count: before.count - unused.length, bytes: afterBytes } };
  }

  for (const x of unused) {
    await mediaDelete(x.id);
    revokeMediaObjectURL(x.id);
  }

  const after = await countMediaStats_IDB();
  return { unusedCount: unused.length, after };
}

async function updateCleanModalInfo() {
  const info = qs('#clean-info');
  if (!info) return;

  const stats = await countMediaStats_IDB();
  const dry = await cleanUnusedMedia_IDB({ dryRun: true });

  const mb = (n) => (n / (1024*1024)).toFixed(2);

  info.innerHTML = `
    <div style="font-weight:800;margin-bottom:6px;">Estado do armazenamento</div>
    <div style="color:#6b7280;font-size:13px;line-height:18px;">
      Itens no armazenamento: <b>${stats.count}</b><br>
      Tamanho aprox.: <b>${mb(stats.bytes)} MB</b><br><br>
      Itens não usados (podem ser limpos): <b>${dry.unusedCount}</b><br>
      Se limpares, fica aprox.: <b>${mb(dry.after.bytes)} MB</b>
    </div>
  `;
}

if (openCleanBtn) openCleanBtn.onclick = async () => {
  hideMoreMenu();
  await updateCleanModalInfo();
  openModal(modalClean);
};

if (qs('#close-clean-modal')) qs('#close-clean-modal').onclick = () => closeModal(modalClean);
if (modalClean) modalClean.addEventListener('click', e => { if (e.target === modalClean) closeModal(modalClean); });

if (qs('#back-clean')) qs('#back-clean').onclick = () => {
  closeModal(modalClean);
  showMoreMenu();
};

if (qs('#do-clean')) {
  qs('#do-clean').onclick = async () => {
    const dry = await cleanUnusedMedia_IDB({ dryRun: true });
    if (dry.unusedCount === 0) {
      alert('Não há fotos/vídeos não usados para limpar ✅');
      await updateCleanModalInfo();
      return;
    }

    const ok = confirm(`Isto vai remover ${dry.unusedCount} itens não usados do armazenamento.\nQueres continuar?`);
    if (!ok) return;

    await cleanUnusedMedia_IDB({ dryRun: false });
    alert(`Limpeza concluída ✅\nRemovidos: ${dry.unusedCount}`);
    await updateCleanModalInfo();
  };
}

/* =========================================================
   MIGRAÇÃO (1x): converter dados antigos (inline src) -> refs IDB
========================================================= */
const MIGRATION_KEY = 'ft_media_migrated_idb_v1';

async function migrateInlineMediaToIDBOnce() {
  if (localStorage.getItem(MIGRATION_KEY) === '1') return;

  let changed = false;

  // exercícios: legacy [{id,type,src,notes}] -> [{id,type,ref,notes}]
  const exs = loadExercises();
  for (const ex of exs) {
    const arr = Array.isArray(ex.media) ? ex.media : [];

    // se já tem refs, ignora
    if (arr.some(m => m && typeof m === 'object' && 'ref' in m)) continue;

    const newArr = [];
    for (const m of arr) {
      if (!m || typeof m !== 'object') continue;
      if (!m.src || typeof m.src !== 'string' || !m.src.startsWith('data:')) continue;

      const blob = dataURLToBlob(m.src);
      if (!blob) continue;

      const type = m.type || blob.type || 'image/jpeg';
      const ref = await mediaAddBlob({ type, blob });

      newArr.push({ id: m.id || uid(), type, ref, notes: m.notes || '' });
      changed = true;
    }
    ex.media = newArr;
  }

  // refeições
  const meals = loadMeals();
  for (const meal of meals) {
    const arr = Array.isArray(meal.media) ? meal.media : [];

    if (arr.some(m => m && typeof m === 'object' && 'ref' in m)) continue;

    const newArr = [];
    for (const m of arr) {
      if (!m || typeof m !== 'object') continue;
      if (!m.src || typeof m.src !== 'string' || !m.src.startsWith('data:')) continue;

      const blob = dataURLToBlob(m.src);
      if (!blob) continue;

      const type = m.type || blob.type || 'image/jpeg';
      const ref = await mediaAddBlob({ type, blob });

      newArr.push({ id: m.id || uid(), type, ref, notes: m.notes || '' });
      changed = true;
    }
    meal.media = newArr;
  }

  if (changed) {
    saveExercises(exs);
    saveMeals(meals);
  }

  localStorage.setItem(MIGRATION_KEY, '1');
}

/* =========================================================
   INIT (robusto em mobile/PWA)
========================================================= */
let __appInited = false;

async function initApp() {
  if (__appInited) return;
  __appInited = true;

  try { await mediaEnsureDB(); } catch (e) { console.error('mediaEnsureDB error', e); }
  try { await migrateInlineMediaToIDBOnce(); } catch (e) { console.error('Migration error', e); }

  try { renderDays(); } catch (e) { console.error('renderDays error', e); }
  try { renderMealTypes(); } catch (e) { console.error('renderMealTypes error', e); }
  try { renderProgress(); } catch (e) { console.error('renderProgress error', e); }
}

// iOS/Safari às vezes precisa disto:
document.addEventListener('DOMContentLoaded', () => { initApp(); });
window.addEventListener('load', () => { initApp(); });
window.addEventListener('pageshow', () => { initApp(); });

// libertar objectURLs ao sair
window.addEventListener('beforeunload', () => {
  try { revokeAllMediaObjectURLs(); } catch {}
});
