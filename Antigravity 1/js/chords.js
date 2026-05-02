// js/chords.js

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function getNoteIndex(note) {
  // Normalize flats to sharps for simplicity in internal logic
  const flatToSharp = {
    'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#'
  };
  const normalizedNote = flatToSharp[note] || note;
  return NOTES.indexOf(normalizedNote);
}

export function transposeChord(chord, steps) {
  // Extract the root note (e.g. C# from C#min7)
  const rootMatch = chord.match(/^[A-G][#b]?/);
  if (!rootMatch) return chord;
  
  const root = rootMatch[0];
  const suffix = chord.slice(root.length);
  
  const index = getNoteIndex(root);
  if (index === -1) return chord;
  
  // Calculate new index wrapping around 12
  let newIndex = (index + steps) % 12;
  if (newIndex < 0) newIndex += 12;
  
  return NOTES[newIndex] + suffix;
}

export function simplifyChord(chord) {
  // Keep only the root, major/minor indication
  // e.g. Cmaj7 -> C, Cmin7 -> Cm, Csus4 -> C
  const rootMatch = chord.match(/^[A-G][#b]?/);
  if (!rootMatch) return chord;
  const root = rootMatch[0];
  
  // Check if it's minor
  if (chord.includes('m') && !chord.includes('maj')) {
    return root + 'm';
  }
  
  return root;
}

export function processChordSheet(text, currentTranspose = 0, isSimplified = false) {
  if (!text) return '';
  const lines = text.split('\n');
  
  let html = '';
  
  for (const line of lines) {
    // A simple heuristic for chord lines: mostly chords, lots of spaces
    // Alternatively, just regex match standard chords.
    // We'll wrap words that look like chords.
    
    // Regex for chords: start with A-G, optional #/b, optional min/maj/sus/dim/aug/numbers
    const chordRegex = /\b([A-G][#b]?(m|min|maj|sus|dim|aug)?\d*(/[A-G][#b]?)?)\b/g;
    
    // Check if line is mostly spaces and chords
    const words = line.trim().split(/\s+/);
    let isChordLine = false;
    
    if (words.length > 0) {
      const chordCount = words.filter(w => w.match(/^[A-G][#b]?/)).length;
      if (chordCount / words.length > 0.5) {
        isChordLine = true;
      }
    }

    if (isChordLine) {
      let processedLine = line.replace(chordRegex, (match) => {
        let finalChord = match;
        if (currentTranspose !== 0) {
          finalChord = transposeChord(finalChord, currentTranspose);
        }
        if (isSimplified) {
          finalChord = simplifyChord(finalChord);
        }
        return `<span class="chord" data-original="${match}">${finalChord}</span>`;
      });
      html += `<div>${processedLine || '&nbsp;'}</div>`;
    } else {
      // Lyrics line
      html += `<div>${line || '&nbsp;'}</div>`;
    }
  }
  
  return html;
}
