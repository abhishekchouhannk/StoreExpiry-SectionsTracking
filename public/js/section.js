// Read section ID from URL: section.html?id=chocolate
const params  = new URLSearchParams(window.location.search);
const sectionId = params.get('id');

// Placeholder section metadata map
const sectionMeta = {
  'chocolate':       { title: 'Chocolate',       icon: '🍫', location: 'Aisle 3' },
  'novelty-candy':   { title: 'Novelty Candy',   icon: '🍬', location: 'Aisle 4' },
  'meat-snacks':     { title: 'Meat Snacks',      icon: '🥩', location: 'Aisle 5' },
  'candy-pegs':      { title: 'Candy Pegs',       icon: '🍭', location: 'End Cap A' },
  'chocolate-pegs':  { title: 'Chocolate Pegs',   icon: '🍫', location: 'End Cap B' },
};

// Update the header to reflect which section was clicked
if (sectionId && sectionMeta[sectionId]) {
  const meta = sectionMeta[sectionId];
  document.getElementById('section-title').textContent    = meta.title;
  document.getElementById('section-icon').textContent     = meta.icon;
  document.getElementById('section-location').textContent = meta.location;
  document.title = `${meta.title} — Store Manager`;
}

// Placeholder — will fetch real data from Express API later
// e.g. fetch(`/api/cleaning-logs?sectionId=${sectionId}&year=2025&month=6`)
console.log(`Section page ready for: ${sectionId}`);