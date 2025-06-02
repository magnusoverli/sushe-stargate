// Album search functionality
const searchModeToggle = document.getElementById('search-mode-toggle');
const searchInput = document.getElementById('album-search-input');
const searchButton = document.getElementById('search-button');
const searchResults = document.getElementById('search-results');
const artistResults = document.getElementById('artist-results');
const albumResults = document.getElementById('album-results');
const manualEntryToggle = document.getElementById('manual-entry-toggle');
const manualEntryForm = document.getElementById('manual-entry-form');

let currentSearchMode = 'artist';
let selectedArtistId = null;

// Toggle search mode
searchModeToggle?.addEventListener('click', () => {
  currentSearchMode = currentSearchMode === 'artist' ? 'album' : 'artist';
  
  searchModeToggle.innerHTML = currentSearchMode === 'artist' ?
    '<i class="fas fa-user mr-1"></i>Artist Search' :
    '<i class="fas fa-compact-disc mr-1"></i>Album Search';
  
  searchInput.placeholder = currentSearchMode === 'artist' ?
    'Search for an artist...' :
    'Search for an album...';
  
  // Clear results
  searchResults.classList.add('hidden');
  artistResults.innerHTML = '';
  albumResults.innerHTML = '';
});

// Search handler
searchButton?.addEventListener('click', performSearch);
searchInput?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    performSearch();
  }
});

async function performSearch() {
  const query = searchInput.value.trim();
  if (!query) return;
  
  // Show loading
  searchButton.disabled = true;
  searchButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  
  try {
    if (currentSearchMode === 'artist') {
      const response = await fetch(`/api/search/artist?query=${encodeURIComponent(query)}`);
      const artists = await response.json();
      
      displayArtistResults(artists);
    } else {
      const response = await fetch(`/api/search/album?query=${encodeURIComponent(query)}`);
      const albums = await response.json();
      
      displayAlbumResults(albums);
    }
    
    searchResults.classList.remove('hidden');
    
  } catch (error) {
    console.error('Search error:', error);
    showToast('Search failed', 'error');
  } finally {
    searchButton.disabled = false;
    searchButton.innerHTML = '<i class="fas fa-search"></i>';
  }
}

function displayArtistResults(artists) {
  artistResults.classList.remove('hidden');
  albumResults.classList.add('hidden');
  
  if (artists.length === 0) {
    artistResults.innerHTML = '<p class="text-gray-500 text-center py-4">No artists found</p>';
    return;
  }
  
  artistResults.innerHTML = artists.slice(0, 20).map(artist => `
    <div class="p-3 hover:bg-gray-700 cursor-pointer rounded" onclick="selectArtist('${artist.id}', '${escapeHtml(artist.name)}')">
      <div class="font-medium">${escapeHtml(artist.name)}</div>
      ${artist.disambiguation ? `<div class="text-sm text-gray-400">${escapeHtml(artist.disambiguation)}</div>` : ''}
      ${artist.country ? `<div class="text-xs text-gray-500">${artist.country}</div>` : ''}
    </div>
  `).join('');
}

async function selectArtist(artistId, artistName) {
  selectedArtistId = artistId;
  
  // Update UI
  artistResults.innerHTML = `
    <div class="bg-gray-700 p-3 rounded mb-3">
      <div class="flex items-center justify-between">
        <div>
          <div class="font-medium">${escapeHtml(artistName)}</div>
          <div class="text-sm text-gray-400">Selected artist</div>
        </div>
        <button onclick="clearArtistSelection()" class="text-gray-400 hover:text-white">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
    <div class="text-center py-4">
      <i class="fas fa-spinner fa-spin text-2xl"></i>
    </div>
  `;
  
  // Fetch albums
  try {
    const response = await fetch(`/api/search/artist/${artistId}/albums`);
    const albums = await response.json();
    
    displayAlbumResults(albums, artistName);
  } catch (error) {
    console.error('Album fetch error:', error);
    showToast('Failed to fetch albums', 'error');
  }
}

function clearArtistSelection() {
  selectedArtistId = null;
  artistResults.innerHTML = '';
  albumResults.innerHTML = '';
  searchResults.classList.add('hidden');
}

function displayAlbumResults(albums, artistName = null) {
  albumResults.classList.remove('hidden');
  
  if (albums.length === 0) {
    albumResults.innerHTML = '<p class="text-gray-500 text-center py-4">No albums found</p>';
    return;
  }
  
  albumResults.innerHTML = `
    <h4 class="font-medium mb-3">${artistName ? `Albums by ${escapeHtml(artistName)}` : 'Album Results'}</h4>
    <div class="space-y-2 max-h-96 overflow-y-auto">
      ${albums.map(album => {
        const artist = artistName || album['artist-credit']?.[0]?.name || 'Unknown Artist';
        const releaseDate = album['first-release-date'] || '';
        const year = releaseDate.split('-')[0];
        
        return `
          <div class="p-3 hover:bg-gray-700 cursor-pointer rounded flex justify-between items-center" 
               onclick="addAlbumFromSearch('${escapeHtml(artist)}', '${escapeHtml(album.title)}', '${album.id}', '${releaseDate}')">
            <div>
              <div class="font-medium">${escapeHtml(album.title)}</div>
              <div class="text-sm text-gray-400">${escapeHtml(artist)} ${year ? `• ${year}` : ''}</div>
            </div>
            <button class="text-accent hover:text-accent-hover">
              <i class="fas fa-plus"></i>
            </button>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

async function addAlbumFromSearch(artist, album, albumId, releaseDate) {
  if (!app.currentList) {
    showToast('Please select or create a list first', 'error');
    return;
  }
  
  // Check if album already exists
  const exists = app.lists[app.currentList].data.some(a => a.album_id === albumId);
  if (exists) {
    showToast('Album already in list', 'warning');
    return;
  }
  
  // Create album object
  const newAlbum = {
    artist,
    album,
    album_id: albumId,
    release_date: releaseDate,
    country: '',
    genre_1: '',
    genre_2: '',
    comments: '',
    cover_image: null,
    cover_image_format: null
  };
  
  // Add to list
  app.lists[app.currentList].data.push(newAlbum);
  
  // Save and update UI
  await saveCurrentList();
  displayAlbums();
  
  // Try to fetch cover art
  fetchCoverArt(artist, album, albumId);
  
  showToast('Album added successfully', 'success');
  logActivity('album_added', { 
    method: 'search',
    albumId,
    artist,
    album,
    listName: app.currentList
  });
  
  // Close modal
  document.getElementById('add-album-modal').classList.add('hidden');
  clearSearchForm();
}

// Manual entry toggle
manualEntryToggle?.addEventListener('click', () => {
  const isManual = manualEntryForm.classList.contains('hidden');
  
  if (isManual) {
    manualEntryForm.classList.remove('hidden');
    document.getElementById('search-form').classList.add('hidden');
    manualEntryToggle.innerHTML = '<i class="fas fa-search mr-1"></i>Search Mode';
  } else {
    manualEntryForm.classList.add('hidden');
    document.getElementById('search-form').classList.remove('hidden');
    manualEntryToggle.innerHTML = '<i class="fas fa-edit mr-1"></i>Manual Entry';
  }
});

// Manual entry form
document.getElementById('manual-album-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (!app.currentList) {
    showToast('Please select or create a list first', 'error');
    return;
  }
  
  const formData = new FormData(e.target);
  
  // Create album object
  const newAlbum = {
    artist: formData.get('artist').trim(),
    album: formData.get('album').trim(),
    album_id: generateAlbumId(),
    release_date: formData.get('release_date') || '',
    country: formData.get('country') || '',
    genre_1: '',
    genre_2: '',
    comments: '',
    cover_image: null,
    cover_image_format: null
  };
  
  // Handle cover upload
  const coverFile = formData.get('cover');
  if (coverFile && coverFile.size > 0) {
    try {
      const base64 = await fileToBase64(coverFile);
      newAlbum.cover_image = base64;
      newAlbum.cover_image_format = coverFile.type.split('/')[1].toUpperCase();
    } catch (error) {
      console.error('Cover upload error:', error);
      showToast('Failed to process cover image', 'warning');
    }
  }
  
  // Add to list
  app.lists[app.currentList].data.push(newAlbum);
  
  // Save and update UI
  await saveCurrentList();
  displayAlbums();
  
  showToast('Album added successfully', 'success');
  logActivity('album_added', { 
    method: 'manual',
    artist: newAlbum.artist,
    album: newAlbum.album,
    listName: app.currentList
  });
  
  // Close modal and reset form
  document.getElementById('add-album-modal').classList.add('hidden');
  e.target.reset();
});

// Fetch cover art
async function fetchCoverArt(artist, album, mbid) {
  try {
    const response = await fetch('/api/cover-art', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist, album, mbid })
    });
    
    if (response.ok) {
      const data = await response.json();
      
      // Convert URL to base64
      const base64 = await urlToBase64(data.url);
      
      // Update album
      const albumIndex = app.lists[app.currentList].data.findIndex(a => a.album_id === mbid);
      if (albumIndex !== -1) {
        app.lists[app.currentList].data[albumIndex].cover_image = base64;
        app.lists[app.currentList].data[albumIndex].cover_image_format = 'JPEG';
        
        // Save and update display
        await saveCurrentList();
        updateAlbumCover(albumIndex, base64);
      }
    }
  } catch (error) {
    console.error('Cover art fetch error:', error);
  }
}

// Update album cover in UI
function updateAlbumCover(index, base64) {
  const row = document.querySelector(`tr[data-index="${index}"]`);
  if (row) {
    const coverCell = row.querySelector('td:nth-child(2) div');
    coverCell.innerHTML = `<img class="w-full h-full object-cover" src="${base64}" alt="Cover">`;
  }
  
  const card = document.querySelector(`.album-card[data-index="${index}"]`);
  if (card) {
    const coverDiv = card.querySelector('.w-20.h-20');
    coverDiv.innerHTML = `<img class="w-full h-full object-cover" src="${base64}" alt="Cover">`;
  }
}

// Helper functions
function generateAlbumId() {
  return `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function urlToBase64(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return fileToBase64(blob);
  } catch (error) {
    console.error('URL to base64 error:', error);
    return null;
  }
}

function clearSearchForm() {
  searchInput.value = '';
  artistResults.innerHTML = '';
  albumResults.innerHTML = '';
  searchResults.classList.add('hidden');
  selectedArtistId = null;
}

// Album menu for mobile
function showAlbumMenu(event, index) {
  event.stopPropagation();
  
  // Remove any existing menu
  document.querySelectorAll('.context-menu').forEach(menu => menu.remove());
  
  const album = app.lists[app.currentList].data[index];
  
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.innerHTML = `
    <div class="context-menu-item" onclick="editAlbum(${index})">
      <i class="fas fa-edit"></i>
      <span>Edit</span>
    </div>
    <div class="context-menu-item" onclick="removeAlbum(${index})">
      <i class="fas fa-trash"></i>
      <span>Remove</span>
    </div>
  `;
  
  document.body.appendChild(menu);
  
  const rect = menu.getBoundingClientRect();
  const x = Math.min(event.pageX, window.innerWidth - rect.width - 10);
  const y = Math.min(event.pageY, window.innerHeight - rect.height - 10);
  
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  
  // Close on click outside
  const closeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEvent

      document.removeEventListener('click', closeMenu);
    }
  };
  
  setTimeout(() => {
    document.addEventListener('click', closeMenu);
  }, 0);
}

// Edit album (mobile)
function editAlbum(index) {
  const album = app.lists[app.currentList].data[index];
  
  // Create edit modal
  const modal = document.createElement('div');
  modal.className = 'modal fixed inset-0 z-50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-content relative z-10 w-full max-w-md">
      <div class="bg-gray-900 rounded-lg p-6">
        <h3 class="text-xl font-semibold mb-4">Edit Album</h3>
        <form id="edit-album-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">Artist</label>
            <input type="text" name="artist" value="${escapeHtml(album.artist)}" class="input-dark w-full" readonly>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Album</label>
            <input type="text" name="album" value="${escapeHtml(album.album)}" class="input-dark w-full" readonly>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Country</label>
            <input type="text" name="country" value="${album.country || ''}" list="country-options" class="input-dark w-full">
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Genre 1</label>
            <input type="text" name="genre_1" value="${album.genre_1 || ''}" list="genre-options" class="input-dark w-full">
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Genre 2</label>
            <input type="text" name="genre_2" value="${album.genre_2 || ''}" list="genre-options" class="input-dark w-full">
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Comments</label>
            <textarea name="comments" rows="3" class="input-dark w-full">${album.comments || ''}</textarea>
          </div>
          <div class="flex gap-3 mt-6">
            <button type="submit" class="btn-primary flex-1">Save</button>
            <button type="button" onclick="this.closest('.modal').remove()" class="btn-secondary flex-1">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add datalists if not present
  if (!document.getElementById('country-options')) {
    const countryDatalist = document.createElement('datalist');
    countryDatalist.id = 'country-options';
    countryDatalist.innerHTML = window.countries.map(c => `<option value="${c}">`).join('');
    document.body.appendChild(countryDatalist);
  }
  
  if (!document.getElementById('genre-options')) {
    const genreDatalist = document.createElement('datalist');
    genreDatalist.id = 'genre-options';
    genreDatalist.innerHTML = window.genres.map(g => `<option value="${g}">`).join('');
    document.body.appendChild(genreDatalist);
  }
  
  // Handle form submission
  document.getElementById('edit-album-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    
    // Update album
    album.country = formData.get('country') || null;
    album.genre_1 = formData.get('genre_1') || null;
    album.genre_2 = formData.get('genre_2') || null;
    album.comments = formData.get('comments') || null;
    
    // Save
    await saveCurrentList();
    displayAlbums();
    
    modal.remove();
    showToast('Album updated', 'success');
    
    logActivity('album_edited_mobile', {
      albumId: album.album_id,
      fields: ['country', 'genre_1', 'genre_2', 'comments']
    });
  });
}

// Remove album
async function removeAlbum(index) {
  const album = app.lists[app.currentList].data[index];
  
  if (!confirm(`Remove "${album.album}" by ${album.artist}?`)) return;
  
  // Remove from list
  app.lists[app.currentList].data.splice(index, 1);
  
  // Save and update
  await saveCurrentList();
  displayAlbums();
  
  showToast('Album removed', 'success');
  
  logActivity('album_removed', {
    albumId: album.album_id,
    artist: album.artist,
    album: album.album,
    listName: app.currentList
  });
}