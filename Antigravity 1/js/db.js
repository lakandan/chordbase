// js/db.js
// IMPORT FIREBASE SDKS HERE ONCE CONFIG IS PROVIDED
// import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
// import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
// import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Placeholder Config
const firebaseConfig = null; // REPLACE WITH ACTUAL CONFIG

// --- MOCK DATABASE IMPLEMENTATION ---
// Used until Firebase credentials are provided. Uses localStorage.

let currentUser = null;
let authStateListeners = [];

function notifyAuthListeners(user) {
  authStateListeners.forEach(listener => listener(user));
}

export function onUserAuthChange(callback) {
  authStateListeners.push(callback);
  // Check local storage for mock session
  const savedUser = localStorage.getItem('chordbase_mock_user');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    callback(currentUser);
  } else {
    callback(null);
  }
}

export async function loginWithGoogle() {
  if (firebaseConfig) {
    // REAL FIREBASE LOGIC HERE
  } else {
    // MOCK LOGIN
    currentUser = { uid: 'mock-user-123', displayName: 'Mock User', email: 'mock@example.com' };
    localStorage.setItem('chordbase_mock_user', JSON.stringify(currentUser));
    notifyAuthListeners(currentUser);
    return currentUser;
  }
}

export async function logoutUser() {
  if (firebaseConfig) {
    // REAL FIREBASE LOGIC HERE
  } else {
    currentUser = null;
    localStorage.removeItem('chordbase_mock_user');
    notifyAuthListeners(null);
  }
}

// Database Operations
function getMockStorageKey() {
  return `chordbase_songs_${currentUser ? currentUser.uid : 'public'}`;
}

function getMockSongs() {
  const data = localStorage.getItem(getMockStorageKey());
  return data ? JSON.parse(data) : [];
}

function saveMockSongs(songs) {
  localStorage.setItem(getMockStorageKey(), JSON.stringify(songs));
}

export async function getSongs() {
  if (!currentUser) return [];
  if (firebaseConfig) {
    // REAL FIREBASE LOGIC HERE
  } else {
    let songs = getMockSongs();
    if (songs.length === 0) {
      try {
        const response = await fetch('/data.json');
        songs = await response.json();
        saveMockSongs(songs);
      } catch (e) {
        console.error("Failed to load initial data.json", e);
      }
    }
    return new Promise(resolve => setTimeout(() => resolve(songs), 300));
  }
}

export async function addSong(songData) {
  if (!currentUser) throw new Error("Must be logged in");
  
  if (firebaseConfig) {
    // REAL FIREBASE LOGIC HERE
  } else {
    const songs = getMockSongs();
    const newSong = { 
      id: Date.now().toString(), 
      userId: currentUser.uid,
      createdAt: new Date().toISOString(),
      ...songData 
    };
    songs.push(newSong);
    saveMockSongs(songs);
    return newSong.id;
  }
}

export async function updateSongTags(songId, tags) {
  if (firebaseConfig) {
    // REAL FIREBASE LOGIC HERE
  } else {
    const songs = getMockSongs();
    const index = songs.findIndex(s => s.id === songId);
    if (index !== -1) {
      songs[index].tags = tags;
      saveMockSongs(songs);
    }
  }
}
