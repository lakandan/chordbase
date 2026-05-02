// js/app.js
import { onUserAuthChange, loginWithGoogle, logoutUser, getSongs, addSong, updateSongTags } from './db.js';
import { processChordSheet } from './chords.js';

// --- UI Elements ---
const viewAuth = document.getElementById('view-auth');
const viewSongList = document.getElementById('view-song-list');
const viewSongDetail = document.getElementById('view-song-detail');

const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const btnGoogleLogin = document.getElementById('btn-google-login');
const btnAddSong = document.getElementById('btn-add-song');
const btnBack = document.getElementById('btn-back');
const btnInstall = document.getElementById('btn-install');

const songGrid = document.getElementById('song-grid');
const searchInput = document.getElementById('search-input');

// Detail View
const detailTitle = document.getElementById('detail-title');
const detailArtist = document.getElementById('detail-artist');
const detailTags = document.getElementById('detail-tags');
const chordSheet = document.getElementById('chord-sheet');
const btnTransUp = document.getElementById('btn-trans-up');
const btnTransDown = document.getElementById('btn-trans-down');
const transposeLabel = document.getElementById('transpose-label');
const toggleSimplify = document.getElementById('toggle-simplify');

// Modals
const btnEditTags = document.getElementById('btn-edit-tags');
const modalOverlay = document.getElementById('modal-overlay');
const modalTags = document.getElementById('modal-tags');
const newTagInput = document.getElementById('new-tag-input');
const modalTagList = document.getElementById('modal-tag-list');
const btnCloseTags = document.getElementById('btn-close-tags');

// --- State ---
let songs = [];
let currentSong = null;
let currentTranspose = 0;
let isSimplified = false;
let deferredPrompt;

// --- Authentication ---
onUserAuthChange(async (user) => {
  if (user) {
    // Logged in
    btnLogin.classList.add('hidden');
    btnLogout.classList.remove('hidden');
    btnAddSong.classList.remove('hidden');
    viewAuth.classList.remove('active');
    viewSongList.classList.add('active');
    await loadSongs();
  } else {
    // Logged out
    btnLogin.classList.remove('hidden');
    btnLogout.classList.add('hidden');
    btnAddSong.classList.add('hidden');
    viewAuth.classList.add('active');
    viewSongList.classList.remove('active');
    viewSongDetail.classList.remove('active');
  }
});

btnLogin.addEventListener('click', () => viewAuth.classList.add('active'));
btnGoogleLogin.addEventListener('click', loginWithGoogle);
btnLogout.addEventListener('click', logoutUser);

// --- PWA Installation ---
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  btnInstall.classList.remove('hidden');
});

btnInstall.addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      btnInstall.classList.add('hidden');
    }
    deferredPrompt = null;
  }
});

// --- Data Loading & Rendering ---
async function loadSongs() {
  songs = await getSongs();
  renderSongList();
}

function renderSongList(filter = '') {
  songGrid.innerHTML = '';
  const lowerFilter = filter.toLowerCase();
  
  const filtered = songs.filter(s => 
    s.title.toLowerCase().includes(lowerFilter) || 
    s.artist.toLowerCase().includes(lowerFilter) ||
    s.tags.some(t => t.toLowerCase().includes(lowerFilter))
  );

  filtered.forEach(song => {
    const card = document.createElement('div');
    card.className = 'song-card';
    card.innerHTML = `
      <h3>${song.title}</h3>
      <p>${song.artist}</p>
      <div class="tag-container">
        ${song.tags.map(t => `<span class="tag">${t}</span>`).join('')}
      </div>
    `;
    card.addEventListener('click', () => openSongDetail(song));
    songGrid.appendChild(card);
  });
}

searchInput.addEventListener('input', (e) => renderSongList(e.target.value));

// --- Song Detail View ---
function openSongDetail(song) {
  currentSong = song;
  currentTranspose = 0;
  isSimplified = toggleSimplify.checked;
  
  detailTitle.textContent = song.title;
  detailArtist.textContent = song.artist;
  renderDetailTags();
  
  updateChordSheet();
  
  viewSongList.classList.remove('active');
  viewSongDetail.classList.add('active');
}

function renderDetailTags() {
  detailTags.innerHTML = currentSong.tags.map(t => `<span class="tag">${t}</span>`).join('');
}

function updateChordSheet() {
  transposeLabel.textContent = `Key: ${currentTranspose === 0 ? 'Original' : (currentTranspose > 0 ? '+'+currentTranspose : currentTranspose)}`;
  chordSheet.innerHTML = processChordSheet(currentSong.chords, currentTranspose, isSimplified);
}

btnBack.addEventListener('click', () => {
  viewSongDetail.classList.remove('active');
  viewSongList.classList.add('active');
  currentSong = null;
});

// --- Transpose & Simplify ---
btnTransUp.addEventListener('click', () => {
  currentTranspose++;
  updateChordSheet();
});

btnTransDown.addEventListener('click', () => {
  currentTranspose--;
  updateChordSheet();
});

toggleSimplify.addEventListener('change', (e) => {
  isSimplified = e.target.checked;
  updateChordSheet();
});

// --- Modals & Tag Editing ---
btnEditTags.addEventListener('click', () => {
  renderModalTags();
  modalOverlay.classList.remove('hidden');
  modalTags.classList.remove('hidden');
});

function renderModalTags() {
  modalTagList.innerHTML = currentSong.tags.map(t => `
    <span class="tag">
      ${t}
      <span class="remove-tag" data-tag="${t}">&times;</span>
    </span>
  `).join('');
  
  modalTagList.querySelectorAll('.remove-tag').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const tagToRemove = e.target.getAttribute('data-tag');
      currentSong.tags = currentSong.tags.filter(t => t !== tagToRemove);
      renderModalTags();
      renderDetailTags();
      await updateSongTags(currentSong.id, currentSong.tags);
    });
  });
}

newTagInput.addEventListener('keypress', async (e) => {
  if (e.key === 'Enter') {
    const newTag = e.target.value.trim();
    if (newTag && !currentSong.tags.includes(newTag)) {
      currentSong.tags.push(newTag);
      e.target.value = '';
      renderModalTags();
      renderDetailTags();
      await updateSongTags(currentSong.id, currentSong.tags);
    }
  }
});

btnCloseTags.addEventListener('click', () => {
  modalOverlay.classList.add('hidden');
  modalTags.classList.add('hidden');
});

// Adding new song stub
btnAddSong.addEventListener('click', async () => {
  const newId = await addSong({
    title: "New Song",
    artist: "Unknown",
    tags: ["New"],
    chords: "C G Am F\nLyrics go here..."
  });
  await loadSongs();
  openSongDetail(songs.find(s => s.id === newId));
});
