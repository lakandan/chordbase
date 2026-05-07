import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// --- State ---
let songs = [];
let currentSong = null;
let transposeAmount = 0;
let isSimplified = false;
let autoScrollInterval = null;
let supabase = null;

const CHORD_REGEX = /\[(.*?)\]/g;
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// --- DOM Elements ---
const el = {
    songList: document.getElementById('song-list'),
    emptyState: document.getElementById('empty-state'),
    songView: document.getElementById('song-view'),
    viewTitle: document.getElementById('view-title'),
    viewArtist: document.getElementById('view-artist'),
    viewTags: document.getElementById('view-tags'),
    songContent: document.getElementById('song-content'),
    printTitle: document.getElementById('print-title'),
    printArtist: document.getElementById('print-artist'),
    
    // Modals
    editModal: document.getElementById('edit-modal'),
    // Views
    settingsView: document.getElementById('settings-view'),
    btnSettingsSidebar: document.getElementById('btn-settings-sidebar'),
    editTitle: document.getElementById('edit-title'),
    editArtist: document.getElementById('edit-artist'),
    editTags: document.getElementById('edit-tags'),
    editContent: document.getElementById('edit-content'),
    supabaseUrl: document.getElementById('supabase-url'),
    supabaseKey: document.getElementById('supabase-key'),
    
    // Controls
    transVal: document.getElementById('trans-val'),
    simplifyToggle: document.getElementById('simplify-toggle'),
    scrollToggle: document.getElementById('scroll-toggle'),
    scrollSpeed: document.getElementById('scroll-speed'),
    fontSizeSlider: document.getElementById('font-size-slider'),
    fontSizeDisplay: document.getElementById('font-size-display'),
    searchInput: document.getElementById('search-input')
};

// --- Initialization ---
function init() {
    setupEventListeners();
    loadSettings();
    initSupabase();
}

function initSupabase() {
    const url = localStorage.getItem('chordbase_supabase_url');
    const key = localStorage.getItem('chordbase_supabase_key');
    
    if (url && key) {
        try {
            supabase = createClient(url, key);
            
            // Set inputs
            el.supabaseUrl.value = url;
            el.supabaseKey.value = key;

            // Fetch initial data
            fetchSongs();

            // Real-time listener
            supabase.channel('songs_channel')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, payload => {
                    fetchSongs(); // Re-fetch all to ensure sync
                })
                .subscribe();
                
        } catch(e) {
            showToast("Invalid Supabase Config", "error");
            fallbackLocal();
        }
    } else {
        fallbackLocal();
        showToast("Running in local mode. Setup Supabase in settings to sync.", "info");
    }
}

async function fetchSongs() {
    if(!supabase) return;
    const { data, error } = await supabase.from('songs').select('*');
    if (error) {
        console.error('Error fetching songs', error);
        return;
    }
    songs = data || [];
    renderSongList();
    
    if(currentSong) {
        const updated = songs.find(s => s.id === currentSong.id);
        if(updated) renderSongContentForUpdated(updated);
        else closeSong();
    }
}

function renderSongContentForUpdated(updated) {
    currentSong = updated;
    el.viewTitle.textContent = updated.title;
    el.viewArtist.textContent = updated.artist || '';
    el.printTitle.textContent = updated.title;
    el.printArtist.textContent = updated.artist || '';
    
    el.viewTags.innerHTML = '';
    if(updated.tags && updated.tags.length) {
        updated.tags.forEach(t => {
            const span = document.createElement('span');
            span.className = 'tag';
            span.textContent = t;
            el.viewTags.appendChild(span);
        });
    }
    renderSongContent();
}

function fallbackLocal() {
    const localSongs = localStorage.getItem('chordbase_local_songs');
    if(localSongs) songs = JSON.parse(localSongs);
    renderSongList();
}

// --- Event Listeners ---
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(`tab-${e.target.dataset.tab}`).classList.add('active');
        });
    });

    // Modals
    document.getElementById('new-song-btn').addEventListener('click', () => openEditModal());
    document.getElementById('btn-edit').addEventListener('click', () => openEditModal(currentSong));
    el.btnSettingsSidebar.addEventListener('click', () => {
        el.emptyState.style.display = 'none';
        el.songView.style.display = 'none';
        el.settingsView.style.display = 'block';
        stopScroll();
    });
    
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.getElementById(e.currentTarget.dataset.close).style.display = 'none';
        });
    });

    // Search
    el.searchInput.addEventListener('input', renderSongList);

    // Save Song
    document.getElementById('save-song-btn').addEventListener('click', saveSong);
    document.getElementById('btn-delete').addEventListener('click', deleteCurrentSong);

    // Controls
    document.getElementById('trans-up').addEventListener('click', () => setTranspose(1));
    document.getElementById('trans-down').addEventListener('click', () => setTranspose(-1));
    el.simplifyToggle.addEventListener('change', (e) => {
        isSimplified = e.target.checked;
        if(currentSong) renderSongContent();
    });

    // Autoscroll
    el.scrollToggle.addEventListener('click', toggleScroll);
    
    // Print/PDF
    document.getElementById('btn-print').addEventListener('click', () => window.print());

    // Settings
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const theme = e.target.dataset.theme;
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('chordbase_theme', theme);
        });
    });

    el.fontSizeSlider.addEventListener('input', (e) => {
        const size = e.target.value;
        document.documentElement.style.setProperty('--base-font-size', `${size}px`);
        el.fontSizeDisplay.textContent = `${size}px`;
        localStorage.setItem('chordbase_fontsize', size);
    });

    document.getElementById('btn-fullscreen').addEventListener('click', () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else if (document.exitFullscreen) document.exitFullscreen();
    });

    document.getElementById('save-supabase-btn').addEventListener('click', () => {
        let url = el.supabaseUrl.value.trim();
        const key = el.supabaseKey.value.trim();
        
        // Clean up URL to prevent "Invalid path specified in request URL"
        if (url) {
            if (!url.startsWith('http')) url = 'https://' + url;
            // Remove trailing slashes or accidental api paths
            url = url.replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
        }

        if(url && key) {
            localStorage.setItem('chordbase_supabase_url', url);
            localStorage.setItem('chordbase_supabase_key', key);
        } else {
            localStorage.removeItem('chordbase_supabase_url');
            localStorage.removeItem('chordbase_supabase_key');
        }
        location.reload();
    });

    // Search Online
    document.getElementById('btn-search-online').addEventListener('click', () => {
        const title = el.editTitle.value.trim() || "song";
        const artist = el.editArtist.value.trim() || "";
        const query = encodeURIComponent(`chords for ${title} ${artist}`);
        window.open(`https://www.google.com/search?q=${query}`, '_blank');
    });
}

function loadSettings() {
    const theme = localStorage.getItem('chordbase_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    
    const size = localStorage.getItem('chordbase_fontsize') || 16;
    document.documentElement.style.setProperty('--base-font-size', `${size}px`);
    el.fontSizeSlider.value = size;
    el.fontSizeDisplay.textContent = `${size}px`;
}

// --- Render Logic ---
function renderSongList() {
    const term = el.searchInput.value.toLowerCase();
    const filtered = songs.filter(s => 
        s.title.toLowerCase().includes(term) || 
        s.artist?.toLowerCase().includes(term) ||
        (s.tags && s.tags.some(t => t.toLowerCase().includes(term)))
    );

    el.songList.innerHTML = '';
    filtered.forEach(song => {
        const li = document.createElement('li');
        if(currentSong && currentSong.id === song.id) li.classList.add('active');
        li.innerHTML = `
            <div class="item-title">${escapeHTML(song.title)}</div>
            <div class="item-subtitle">${escapeHTML(song.artist || 'Unknown Artist')}</div>
        `;
        li.addEventListener('click', () => selectSong(song));
        el.songList.appendChild(li);
    });
}

function selectSong(song) {
    currentSong = song;
    transposeAmount = 0;
    isSimplified = el.simplifyToggle.checked;
    el.transVal.textContent = '0';
    stopScroll();
    
    el.emptyState.style.display = 'none';
    el.settingsView.style.display = 'none';
    el.songView.style.display = 'block';
    
    renderSongContentForUpdated(song);
    renderSongList(); // update active state
}

function closeSong() {
    currentSong = null;
    el.emptyState.style.display = 'flex';
    el.songView.style.display = 'none';
    el.settingsView.style.display = 'none';
    stopScroll();
}

function renderSongContent() {
    if(!currentSong) return;
    
    let content = currentSong.content || '';
    
    // Parse format [C]Lyrics into HTML
    const lines = content.split('\n');
    let html = '';

    lines.forEach(line => {
        if(line.trim() === '') {
            html += '<br>';
            return;
        }

        // Check if line contains only bracketed chords
        const bracketChordLine = /^(?:\[.*?\]\s*)+$/.test(line.trim());
        
        // Check if line contains only bare chords (e.g. "C G/B Am F")
        const words = line.trim().split(/\s+/);
        const BARE_CHORD_REGEX = /^[A-G][b#]?(?:m|M|maj|min|aug|dim|sus|add)?\d*(?:\/[A-G][b#]?)?$/;
        const allWordsAreChords = words.length > 0 && words.every(w => BARE_CHORD_REGEX.test(w));
        
        if (bracketChordLine) {
             let parsedLine = line.replace(CHORD_REGEX, (match, chordStr) => {
                 return `<span class="chord">${processChord(chordStr)}</span>`;
             });
             html += `<span class="chord-line">${parsedLine}</span>\n`;
        } else if (allWordsAreChords) {
             let parsedLine = line.replace(/\S+/g, (match) => {
                 return `<span class="chord">${processChord(match)}</span>`;
             });
             html += `<span class="chord-line">${parsedLine}</span>\n`;
        } else {
             // Inline chords like "To[C]day is gonna be"
             let parsedLine = line.replace(CHORD_REGEX, (match, chordStr) => {
                 return `<span class="inline-chord">${processChord(chordStr)}</span>`;
             });
             html += `<span class="lyric-with-chord">${parsedLine}</span>\n`;
        }
    });

    el.songContent.innerHTML = html;
}

// --- Chord Processing (Transpose & Simplify) ---
function setTranspose(dir) {
    transposeAmount += dir;
    if(transposeAmount > 11) transposeAmount -= 12;
    if(transposeAmount < -11) transposeAmount += 12;
    
    let displayVal = transposeAmount > 0 ? `+${transposeAmount}` : transposeAmount;
    el.transVal.textContent = displayVal;
    renderSongContent();
}

function processChord(chord) {
    if(!chord) return '';
    let parsed = chord;

    // Simplify: remove extensions (maj7, m7, sus4, /G, etc.)
    if (isSimplified) {
        // Keep only base note and 'm' for minor
        const m = parsed.match(/^([A-G]#?)(m)?/);
        if (m) parsed = m[1] + (m[2] || '');
    }

    // Transpose
    if (transposeAmount !== 0) {
        // Find the base note
        parsed = parsed.replace(/([A-G]#?)/g, (match) => {
            let index = NOTES.indexOf(match);
            if (index === -1) return match; // fallback
            
            let newIndex = (index + transposeAmount) % 12;
            if (newIndex < 0) newIndex += 12;
            return NOTES[newIndex];
        });
    }

    return parsed;
}

// --- Autoscroll ---
function toggleScroll() {
    if(autoScrollInterval) {
        stopScroll();
    } else {
        startScroll();
    }
}

function startScroll() {
    const icon = el.scrollToggle.querySelector('i');
    icon.classList.remove('fa-play');
    icon.classList.add('fa-pause');
    
    autoScrollInterval = setInterval(() => {
        const speed = parseInt(el.scrollSpeed.value); // 1 to 10
        const pixelsPerTick = speed * 0.5;
        window.scrollBy(0, pixelsPerTick);
        document.querySelector('.main-content').scrollBy(0, pixelsPerTick);
        
        // Stop if reached bottom
        const main = document.querySelector('.main-content');
        if (main.scrollHeight - main.scrollTop <= main.clientHeight) {
            stopScroll();
        }
    }, 50);
}

function stopScroll() {
    if(autoScrollInterval) clearInterval(autoScrollInterval);
    autoScrollInterval = null;
    const icon = el.scrollToggle.querySelector('i');
    if(icon) {
        icon.classList.remove('fa-pause');
        icon.classList.add('fa-play');
    }
}

// --- CRUD Operations ---
function openEditModal(song = null) {
    el.editModal.style.display = 'flex';
    if(song) {
        document.getElementById('edit-modal-title').textContent = 'Edit Song';
        el.editTitle.value = song.title || '';
        el.editArtist.value = song.artist || '';
        el.editTags.value = song.tags ? song.tags.join(', ') : '';
        el.editContent.value = song.content || '';
        el.editModal.dataset.editId = song.id;
    } else {
        document.getElementById('edit-modal-title').textContent = 'Add Song';
        el.editTitle.value = '';
        el.editArtist.value = '';
        el.editTags.value = '';
        el.editContent.value = '';
        delete el.editModal.dataset.editId;
    }
}

async function saveSong() {
    const title = el.editTitle.value.trim();
    if(!title) {
        showToast("Title is required", "error");
        return;
    }

    const songData = {
        title,
        artist: el.editArtist.value.trim(),
        tags: el.editTags.value.split(',').map(t => t.trim()).filter(t => t),
        content: el.editContent.value
    };

    const editId = el.editModal.dataset.editId;

    if (supabase) {
        try {
            if (editId) {
                const { error } = await supabase.from('songs').update(songData).eq('id', editId);
                if(error) throw error;
                showToast("Song updated");
            } else {
                const { error } = await supabase.from('songs').insert([songData]);
                if(error) throw error;
                showToast("Song added");
            }
        } catch(e) {
            showToast("Error: " + (e.message || e.details || JSON.stringify(e)), "error");
            console.error(e);
        }
    } else {
        // Local mode fallback
        if(editId) {
            const index = songs.findIndex(s => s.id === editId);
            if(index > -1) songs[index] = { ...songData, id: editId };
        } else {
            songs.push({ ...songData, id: 'local_' + Date.now() });
        }
        localStorage.setItem('chordbase_local_songs', JSON.stringify(songs));
        renderSongList();
        if(editId && currentSong && currentSong.id === editId) selectSong(songs.find(s=>s.id === editId));
        showToast("Saved locally");
    }

    el.editModal.style.display = 'none';
}

async function deleteCurrentSong() {
    if(!currentSong) return;
    if(!confirm(`Delete "${currentSong.title}"?`)) return;

    if (supabase) {
        try {
            const { error } = await supabase.from('songs').delete().eq('id', currentSong.id);
            if(error) throw error;
            showToast("Song deleted");
        } catch(e) {
            showToast("Error deleting: " + (e.message || e.details || JSON.stringify(e)), "error");
        }
    } else {
        songs = songs.filter(s => s.id !== currentSong.id);
        localStorage.setItem('chordbase_local_songs', JSON.stringify(songs));
        renderSongList();
        showToast("Deleted locally");
    }
    closeSong();
}

// --- Utils ---
function showToast(msg, type = "success") {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    if(type === 'error') toast.style.backgroundColor = 'var(--danger)';
    container.appendChild(toast);
    setTimeout(() => {
        if(toast.parentElement) toast.remove();
    }, 3000);
}

function escapeHTML(str) {
    const p = document.createElement('p');
    p.appendChild(document.createTextNode(str));
    return p.innerHTML;
}

// Service worker registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(reg => {
            console.log('SW Registered');
        }).catch(err => {
            console.warn('SW failed', err);
        });
    });
}

// Run
init();
