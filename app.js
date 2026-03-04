/* ═══════════════════════════════════════════════════
   STYLEintel — App Logic
═══════════════════════════════════════════════════ */

// ─── API base URL ────────────────────────────────
// When served via FastAPI (uvicorn), the API is on the same origin.
// When opening index.html directly from file://, point to localhost.
const API_BASE = window.location.protocol === 'file:'
  ? 'http://localhost:8000/api'
  : '/api';

// ─── State ───────────────────────────────────────
const state = {
  activeFilters: {},    // { garmentType: ['Outerwear'], style: ['Minimalist'], ... }
  activeColors: new Set(),
  searchQuery: '',
  garments: [],         // live data from API
};


// ─── Element refs ────────────────────────────────
const uploadModal   = document.getElementById('uploadModal');
const detailModal   = document.getElementById('detailModal');
const openUploadBtn = document.getElementById('openUploadBtn');
const closeUpload   = document.getElementById('closeUploadModal');
const closeDetail   = document.getElementById('closeDetailModal');
const startUpload   = document.getElementById('startUploadBtn');
const dropZone      = document.getElementById('dropZone');
const fileInput     = document.getElementById('fileInput');
const uploadQueue   = document.getElementById('uploadQueue');
const searchInput   = document.getElementById('searchInput');
const activeFiltersEl = document.getElementById('activeFilters');
const resultCount   = document.getElementById('resultCount');
const masonryGrid   = document.getElementById('masonryGrid');
const toast         = document.getElementById('toast');
const clearFiltersBtn = document.getElementById('clearFilters');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebar       = document.getElementById('sidebar');
const masonryViewBtn = document.getElementById('masonryView');
const gridViewBtn    = document.getElementById('gridView');


// ─── Upload Modal ────────────────────────────────
openUploadBtn.addEventListener('click', () => uploadModal.classList.add('open'));
closeUpload.addEventListener('click', () => closeUploadModal());
uploadModal.addEventListener('click', (e) => { if (e.target === uploadModal) closeUploadModal(); });

function closeUploadModal() {
  uploadModal.classList.remove('open');
  uploadQueue.innerHTML = '';
}

// Drag & drop
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFiles(e.dataTransfer.files);
});
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

function handleFiles(files) {
  Array.from(files).forEach(file => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => addToQueue(file, e.target.result);
    reader.readAsDataURL(file);
  });
}

function addToQueue(file, dataUrl) {
  const item = document.createElement('div');
  item.className = 'queue-item';
  const sizeMB = (file.size / 1024 / 1024).toFixed(1);
  item.innerHTML = `
    <img class="queue-thumb" src="${dataUrl}" alt="${file.name}" />
    <span class="queue-name">${file.name}</span>
    <span class="queue-size">${sizeMB} MB</span>
    <button class="queue-remove" title="Remove">×</button>
  `;
  item.querySelector('.queue-remove').addEventListener('click', () => item.remove());
  uploadQueue.appendChild(item);
}

function showToast() {
  toast.classList.add('visible');
}
function hideToast() {
  toast.classList.remove('visible');
}


// ─── Detail Modal ────────────────────────────────
closeDetail.addEventListener('click', () => detailModal.classList.remove('open'));
detailModal.addEventListener('click', (e) => { if (e.target === detailModal) detailModal.classList.remove('open'); });

// Attach detail opener to all cards
document.querySelectorAll('.card').forEach(card => {
  card.addEventListener('click', (e) => {
    if (e.target.closest('.card-btn.view-detail-btn') || e.target.closest('.card-btn')) {
      if (e.target.closest('[title="View details"]') || e.target.closest('.view-detail-btn')) {
        openDetail(card);
      }
      return;
    }
    openDetail(card);
  });
});

function openDetail(card) {
  const img = card.querySelector('img');
  document.getElementById('detailImage').src = img.src;
  document.getElementById('detailImage').alt = img.alt;
  document.getElementById('detailTitle').textContent = card.querySelector('.card-title').textContent;
  document.getElementById('detailDesc').textContent = card.dataset.description || '';
  document.getElementById('detailSeason').textContent = card.dataset.season || '';
  document.getElementById('detailLocation').textContent = card.dataset.market || '';

  const attrGrid = document.getElementById('attrGrid');
  const garment  = card.dataset.garment || '–';
  const style    = card.dataset.style || '–';
  const color    = card.dataset.color || '–';
  const season   = card.dataset.season || '–';
  const occ      = card.dataset.occasion || '–';
  const market   = card.dataset.market || '–';

  const attrMap = {
    'Garment': garment, 'Style': style, 'Color': color,
    'Season': season, 'Occasion': occ, 'Market': market,
    'Material': inferMaterial(garment),
    'Trend': inferTrend(style),
  };
  attrGrid.innerHTML = Object.entries(attrMap).map(([k, v]) => `
    <div class="attr-item">
      <span class="attr-key">${k}</span>
      <span class="attr-val">${v}</span>
    </div>
  `).join('');

  detailModal.classList.add('open');
}

function inferMaterial(garment) {
  const map = {
    'Outerwear': 'Wool / Cashmere', 'Dress': 'Silk / Charmeuse',
    'Knitwear': 'Merino Wool', 'Suit': 'Wool Twill',
    'Trousers': 'Crepe', 'Skirt': 'Cotton Voile',
    'Top': 'Jersey', 'Streetwear': 'Technical Nylon',
  };
  return map[garment] || 'Mixed Fabric';
}

function inferTrend(style) {
  const map = {
    'Minimalist': 'Quiet Luxury', 'Avant-garde': 'Neo-Sculptural',
    'Streetwear': 'Tech Utility', 'Classic': 'New Classics',
    'Bohemian': 'Artisanal Revival', 'Romantic': 'Sheer Femininity',
  };
  return map[style] || 'Emerging';
}


// ─── Filter Collapsing ───────────────────────────
document.querySelectorAll('.filter-label[data-toggle]').forEach(label => {
  label.addEventListener('click', () => {
    const id = label.dataset.toggle;
    const opts = document.getElementById(id);
    const chevron = label.querySelector('.chevron');
    opts.classList.toggle('open');
    chevron.style.transform = opts.classList.contains('open') ? '' : 'rotate(-90deg)';
  });
});


// ─── Filter Checkboxes ───────────────────────────
document.querySelectorAll('.filter-chip input[type="checkbox"]').forEach(cb => {
  cb.addEventListener('change', () => {
    const group = cb.closest('.filter-options').id;
    if (!state.activeFilters[group]) state.activeFilters[group] = new Set();
    if (cb.checked) {
      state.activeFilters[group].add(cb.value);
    } else {
      state.activeFilters[group].delete(cb.value);
      if (state.activeFilters[group].size === 0) delete state.activeFilters[group];
    }
    applyFilters();
    renderActiveFilterTags();
  });
});


// ─── Color Swatches ──────────────────────────────
document.querySelectorAll('.swatch').forEach(swatch => {
  swatch.addEventListener('click', () => {
    const color = swatch.dataset.color;
    if (state.activeColors.has(color)) {
      state.activeColors.delete(color);
      swatch.classList.remove('active');
    } else {
      state.activeColors.add(color);
      swatch.classList.add('active');
    }
    applyFilters();
    renderActiveFilterTags();
  });
});


// ─── Search ──────────────────────────────────────
searchInput.addEventListener('input', () => {
  state.searchQuery = searchInput.value.toLowerCase().trim();
  applyFilters();
});


// ─── Clear Filters ───────────────────────────────
clearFiltersBtn.addEventListener('click', () => {
  state.activeFilters = {};
  state.activeColors = new Set();
  state.searchQuery = '';
  searchInput.value = '';
  document.querySelectorAll('.filter-chip input:checked').forEach(cb => cb.checked = false);
  document.querySelectorAll('.swatch.active').forEach(s => s.classList.remove('active'));
  activeFiltersEl.innerHTML = '';
  applyFilters();
});


// ─── Apply Filters ───────────────────────────────
function applyFilters() {
  const cards = document.querySelectorAll('.card');
  let visible = 0;

  cards.forEach(card => {
    const match = cardMatchesFilters(card);
    card.classList.toggle('hidden', !match);
    if (match) visible++;
  });

  resultCount.textContent = `${visible} garment${visible !== 1 ? 's' : ''}`;
}

function cardMatchesFilters(card) {
  // Text search against description
  if (state.searchQuery) {
    const desc = (card.dataset.description || '').toLowerCase();
    const title = card.querySelector('.card-title')?.textContent.toLowerCase() || '';
    const tags  = [card.dataset.garment, card.dataset.style, card.dataset.color, card.dataset.market].join(' ').toLowerCase();
    if (!desc.includes(state.searchQuery) && !title.includes(state.searchQuery) && !tags.includes(state.searchQuery)) {
      return false;
    }
  }

  // Checkbox filters
  for (const [group, values] of Object.entries(state.activeFilters)) {
    if (values.size === 0) continue;
    // Map group id -> card data attribute
    const attrMap = {
      'garment-type': 'garment',
      'style': 'style',
      'season': 'season',
      'occasion': 'occasion',
      'market': 'market',
    };
    const attr = attrMap[group];
    if (!attr) continue;
    const cardVal = card.dataset[attr] || '';
    if (![...values].some(v => cardVal.toLowerCase().includes(v.toLowerCase()))) {
      return false;
    }
  }

  // Color filters
  if (state.activeColors.size > 0) {
    const cardColor = card.dataset.color || '';
    if (![...state.activeColors].some(c => cardColor.toLowerCase().includes(c.toLowerCase()))) {
      return false;
    }
  }

  return true;
}


// ─── Active Filter Tags ──────────────────────────
function renderActiveFilterTags() {
  const tags = [];

  for (const [group, values] of Object.entries(state.activeFilters)) {
    values.forEach(v => tags.push({ group, value: v, type: 'checkbox' }));
  }
  state.activeColors.forEach(c => tags.push({ group: 'color', value: c, type: 'color' }));

  activeFiltersEl.innerHTML = tags.map(t => `
    <span class="active-filter-tag" data-group="${t.group}" data-value="${t.value}" data-type="${t.type}">
      ${t.value}
      <button>×</button>
    </span>
  `).join('');

  activeFiltersEl.querySelectorAll('.active-filter-tag button').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.closest('.active-filter-tag');
      const { group, value, type } = tag.dataset;
      if (type === 'checkbox') {
        if (state.activeFilters[group]) {
          state.activeFilters[group].delete(value);
          if (state.activeFilters[group].size === 0) delete state.activeFilters[group];
          const cb = document.querySelector(`.filter-options#${group} input[value="${value}"]`);
          if (cb) cb.checked = false;
        }
      } else if (type === 'color') {
        state.activeColors.delete(value);
        const sw = document.querySelector(`.swatch[data-color="${value}"]`);
        if (sw) sw.classList.remove('active');
      }
      applyFilters();
      renderActiveFilterTags();
    });
  });
}


// ─── Sidebar Toggle ──────────────────────────────
sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
});


// ─── View Toggle (Masonry / Grid) ────────────────
masonryViewBtn.addEventListener('click', () => {
  masonryGrid.classList.remove('grid-view');
  masonryViewBtn.classList.add('active');
  gridViewBtn.classList.remove('active');
});
gridViewBtn.addEventListener('click', () => {
  masonryGrid.classList.add('grid-view');
  gridViewBtn.classList.add('active');
  masonryViewBtn.classList.remove('active');
});


// ─── Keyboard shortcuts ──────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    uploadModal.classList.remove('open');
    detailModal.classList.remove('open');
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    searchInput.focus();
  }
});


// ═══════════════════════════════════════════════
// API INTEGRATION
// When the backend is running, uploaded images and
// their AI classifications load dynamically.
// ═══════════════════════════════════════════════

// ─── Upload: send to real API ────────────────────
startUpload.addEventListener('click', async () => {
  const items = uploadQueue.querySelectorAll('.queue-item');
  if (!items.length) { alert('Add at least one photo.'); return; }

  const seasonEl   = document.querySelector('.meta-select');
  const locationEl = document.querySelectorAll('.meta-input')[0];
  const noteEl     = document.querySelectorAll('.meta-input')[1];

  const formData = new FormData();
  // Re-collect files from the queue thumbs' src (data URLs → Blob)
  const thumbs = uploadQueue.querySelectorAll('.queue-thumb');
  const names  = uploadQueue.querySelectorAll('.queue-name');

  // Fallback: if we only have data URLs, convert them back to blobs
  const fetchBlobs = Array.from(thumbs).map(async (thumb, i) => {
    const res  = await fetch(thumb.src);
    const blob = await res.blob();
    formData.append('files', blob, names[i].textContent.trim());
  });

  await Promise.all(fetchBlobs);
  if (seasonEl?.value)   formData.append('upload_season',   seasonEl.value);
  if (locationEl?.value) formData.append('upload_location', locationEl.value);
  if (noteEl?.value)     formData.append('upload_note',     noteEl.value);

  closeUploadModal();
  showToast();

  try {
    const res = await fetch(`${API_BASE}/garments/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error(await res.text());
    const newGarments = await res.json();
    newGarments.forEach(g => prependApiCard(g));
    applyFilters();
  } catch (err) {
    console.error('[upload]', err);
  } finally {
    hideToast();
  }
}, { once: false });
// Remove the simulated upload listener added earlier (it's the first listener)
// — we registered the real one above. The simulated one in the earlier block
//   is a no-op now since closeUploadModal() is called first.


// ─── Render a card from API data ────────────────
function prependApiCard(g) {
  const colorDot = colorToDot(g.color_palette);
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.garment  = g.garment_type     || '';
  card.dataset.style    = g.style            || '';
  card.dataset.season   = g.season           || g.upload_season || '';
  card.dataset.color    = g.color_palette    || '';
  card.dataset.occasion = g.occasion         || '';
  card.dataset.market   = g.location_context || g.upload_location || '';
  card.dataset.description = g.ai_description || g.upload_note || '';
  card.dataset.apiId    = g.id;

  const title    = g.original_filename.replace(/\.[^.]+$/, '');
  const season   = g.season || g.upload_season || '';
  const location = g.location_context || g.upload_location || '';
  const status   = g.is_classified ? '' : '<span class="qtag" style="background:rgba(200,150,0,.8)">Classifying…</span>';

  card.innerHTML = `
    <div class="card-img-wrap" style="height:300px">
      <img src="${g.image_url}" alt="${title}" loading="lazy" />
      <div class="card-overlay">
        <div class="card-quick-tags">
          ${g.garment_type ? `<span class="qtag">${g.garment_type}</span>` : ''}
          ${g.style        ? `<span class="qtag">${g.style}</span>`        : ''}
          ${season         ? `<span class="qtag">${season}</span>`         : ''}
          ${status}
        </div>
        <div class="card-actions">
          <button class="card-btn" title="Add to mood board">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </button>
        </div>
      </div>
    </div>
    <div class="card-body">
      <div class="card-meta">
        <span class="card-market">${[location, season].filter(Boolean).join(' · ')}</span>
        <span class="card-dot" style="background:${colorDot}"></span>
      </div>
      <h3 class="card-title">${title}</h3>
      <p class="card-desc">${g.ai_description ? g.ai_description.slice(0, 100) + '…' : 'Classifying…'}</p>
    </div>
  `;

  card.addEventListener('click', () => openDetail(card));

  // If not yet classified, poll for updates every 4s (max 10 polls)
  if (!g.is_classified) {
    let polls = 0;
    const interval = setInterval(async () => {
      polls++;
      try {
        const res = await fetch(`${API_BASE}/garments/${g.id}`);
        if (!res.ok) return;
        const updated = await res.json();
        if (updated.is_classified) {
          clearInterval(interval);
          refreshApiCard(card, updated);
        }
      } catch { /* ignore */ }
      if (polls >= 10) clearInterval(interval);
    }, 4000);
  }

  masonryGrid.prepend(card);
}

function refreshApiCard(card, g) {
  card.dataset.garment     = g.garment_type     || '';
  card.dataset.style       = g.style            || '';
  card.dataset.season      = g.season           || g.upload_season || '';
  card.dataset.color       = g.color_palette    || '';
  card.dataset.occasion    = g.occasion         || '';
  card.dataset.market      = g.location_context || g.upload_location || '';
  card.dataset.description = g.ai_description   || '';

  const title    = g.original_filename.replace(/\.[^.]+$/, '');
  const season   = g.season || g.upload_season || '';
  const location = g.location_context || g.upload_location || '';

  card.querySelector('.card-title').textContent = title;
  card.querySelector('.card-desc').textContent  = g.ai_description
    ? g.ai_description.slice(0, 100) + '…'
    : '';
  card.querySelector('.card-market').textContent = [location, season].filter(Boolean).join(' · ');
  card.querySelector('.card-dot').style.background = colorToDot(g.color_palette);

  const tags = card.querySelector('.card-quick-tags');
  tags.innerHTML = [g.garment_type, g.style, season]
    .filter(Boolean)
    .map(t => `<span class="qtag">${t}</span>`)
    .join('');
}

function colorToDot(palette) {
  if (!palette) return '#ccc';
  const map = {
    black: '#1a1a1a', cream: '#f5f0eb', ivory: '#f5f0eb',
    camel: '#8b6f47', red: '#c0392b', navy: '#2c3e50',
    violet: '#6c5ce7', purple: '#6c5ce7', green: '#27ae60',
    terracotta: '#e67e22', orange: '#e67e22', white: '#f9f9f9',
    grey: '#888', gray: '#888', blue: '#2980b9', pink: '#e84393',
  };
  const lower = palette.toLowerCase();
  for (const [key, hex] of Object.entries(map)) {
    if (lower.includes(key)) return hex;
  }
  return '#aaa';
}


// ─── Annotation save ────────────────────────────
document.querySelector('.btn-save-annotation').addEventListener('click', async () => {
  const garmentId = detailModal.dataset.garmentId;
  const text = document.querySelector('.annotation-input').value.trim();
  if (!garmentId || !text) return;

  try {
    await fetch(`${API_BASE}/garments/${garmentId}/annotation`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ custom_annotation: text }),
    });
  } catch (err) {
    console.error('[annotation]', err);
  }
});

// Store current garment id when detail opens (patch openDetail)
const _originalOpenDetail = openDetail;
// Override card click to store id on modal
document.getElementById('masonryGrid').addEventListener('click', (e) => {
  const card = e.target.closest('.card[data-api-id]');
  if (card) detailModal.dataset.garmentId = card.dataset.apiId;
});


// ─── Load existing garments from API on page load ─
async function loadGarmentsFromApi() {
  try {
    const res = await fetch(`${API_BASE}/garments?limit=200`);
    if (!res.ok) return;
    const garments = await res.json();
    garments.forEach(g => prependApiCard(g));
    applyFilters();
  } catch {
    // Backend not running — demo cards remain visible
  }
}

loadGarmentsFromApi();
