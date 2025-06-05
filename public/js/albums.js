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
let selectedArtistCountry = null; // Store the selected artist's country
let searchCoverObserver = null;
const searchCoverCache = new Map();
let artistImageObserver = null;
const artistImageCache = new Map();
const artistPlaceholder = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgZmlsbD0iIzU1NSIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBkPSJNMTIgMmE1IDUgMCAxMTAgMTAgNSA1IDAgMDEwLTEwem0wIDEyYy0zLjg2NiAwLTcgMy4xMzQtNyA3aDJhNSA1IDAgMDExMCAwaDJjMC0zLjg2Ni0zLjEzNC03LTctN3oiLz48L3N2Zz4K';

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
    <div class="p-3 hover:bg-gray-700 cursor-pointer rounded flex items-center gap-3"
         onclick='selectArtist(${JSON.stringify({
           id: artist.id,
           name: artist.name,
           country: artist.country || artist.area?.name || ''
         }).replace(/'/g, '&apos;')})'>
      <div class="w-10 h-10 bg-gray-700 rounded overflow-hidden flex-shrink-0">
        <img class="artist-thumbnail w-full h-full object-cover" data-artist="${escapeHtml(artist.name)}" data-mbid="${artist.id}" alt="artist">
      </div>
      <div>
        <div class="font-medium">${escapeHtml(artist.name)}</div>
        ${artist.disambiguation ? `<div class="text-sm text-gray-400">${escapeHtml(artist.disambiguation)}</div>` : ''}
        ${artist.country || artist.area?.name ? `<div class="text-xs text-gray-500">${artist.country || artist.area?.name}</div>` : ''}
      </div>
    </div>
  `).join('');

  loadArtistImages();
}

async function selectArtist(artistData) {
  selectedArtistId = artistData.id;
  selectedArtistCountry = artistData.country;
  
  // Update UI
  artistResults.innerHTML = `
    <div class="bg-gray-700 p-3 rounded mb-3">
      <div class="flex items-center justify-between">
        <div>
          <div class="font-medium">${escapeHtml(artistData.name)}</div>
          <div class="text-sm text-gray-400">Selected artist${artistData.country ? ` • ${artistData.country}` : ''}</div>
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
    const response = await fetch(`/api/search/artist/${artistData.id}/albums`);
    const albums = await response.json();
    
    displayAlbumResults(albums, artistData.name);
  } catch (error) {
    console.error('Album fetch error:', error);
    showToast('Failed to fetch albums', 'error');
  }
}

function clearArtistSelection() {
  selectedArtistId = null;
  selectedArtistCountry = null;
  artistResults.innerHTML = '';
  albumResults.innerHTML = '';
  searchResults.classList.add('hidden');
}

function displayAlbumResults(albums, artistName = null) {
  albumResults.classList.remove('hidden');

  // Remove loading spinner if it exists
  const spinner = artistResults.querySelector('.fa-spinner');
  if (spinner) spinner.parentElement.remove();
  
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
               onclick='addAlbumFromSearch(${JSON.stringify({
                 artist,
                 album: album.title,
                 albumId: album.id,
                 releaseDate,
                 country: selectedArtistCountry || ''
               }).replace(/'/g, '&apos;')})'>
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 bg-gray-700 rounded overflow-hidden flex-shrink-0">
                <img class="search-album-cover w-full h-full object-cover" data-artist="${escapeHtml(artist)}" data-album="${escapeHtml(album.title)}" data-mbid="${album.id}" alt="cover">
              </div>
              <div>
                <div class="font-medium">${escapeHtml(album.title)}</div>
                <div class="text-sm text-gray-400">${escapeHtml(artist)} ${year ? `• ${year}` : ''}</div>
              </div>
            </div>
            <button class="text-accent hover:text-accent-hover">
              <i class="fas fa-plus"></i>
            </button>
          </div>
        `;
      }).join('')}
    </div>
  `;

  loadSearchCoverImages();
}

async function addAlbumFromSearch(albumData) {
  if (!app.currentList) {
    showToast('Please select or create a list first', 'error');
    return;
  }
  
  // Check if album already exists
  const exists = app.lists[app.currentList].data.some(a => a.album_id === albumData.albumId);
  if (exists) {
    showToast('Album already in list', 'warning');
    return;
  }
  
  // Create album object with artist's country
  const newAlbum = {
    artist: albumData.artist,
    album: albumData.album,
    album_id: albumData.albumId,
    release_date: albumData.releaseDate,
    country: albumData.country, // Now includes the artist's country
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
  fetchCoverArt(albumData.artist, albumData.album, albumData.albumId);
  
  showToast('Album added successfully', 'success');
  logActivity('album_added', { 
    method: 'search',
    albumId: albumData.albumId,
    artist: albumData.artist,
    album: albumData.album,
    country: albumData.country,
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
  const albumElement = document.querySelector(`[data-index="${index}"] .album-cover`);
  if (albumElement) {
    albumElement.src = base64;
    albumElement.classList.add('loaded');
  }
}

// Unified album menu (works for both mobile and desktop)
function showAlbumMenu(event, index) {
  event.stopPropagation();
  
  // Remove any existing menu
  document.querySelectorAll('.context-menu').forEach(menu => menu.remove());
  
  const album = app.lists[app.currentList].data[index];
  
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.innerHTML = `
    <div class="context-menu-item" onclick="showEditModal(${index})">
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
      document.removeEventListener('click', closeMenu);
    }
  };
  
  setTimeout(() => {
    document.addEventListener('click', closeMenu);
  }, 0);
}

// Unified edit modal (for mobile menu and can be used for desktop too)
function showEditModal(index) {
  const album = app.lists[app.currentList].data[index];
  
  // Remove existing modals
  document.querySelectorAll('.edit-modal').forEach(m => m.remove());
  
  // Create edit modal
  const modal = document.createElement('div');
  modal.className = 'modal fixed inset-0 z-50 flex items-center justify-center p-4 edit-modal';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
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
    
    logActivity('album_edited', {
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
  selectedArtistCountry = null;
}

function initializeSearchCoverObserver() {
  if (searchCoverObserver) return;
  searchCoverObserver = new IntersectionObserver(async (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const img = entry.target;
        const mbid = img.dataset.mbid;
        if (searchCoverCache.has(mbid)) {
          img.src = searchCoverCache.get(mbid);
          img.classList.add('loaded');
        } else {
          const base64 = await fetchSearchCover(img.dataset.artist, img.dataset.album, mbid);
          if (base64) {
            searchCoverCache.set(mbid, base64);
            img.src = base64;
            img.onload = () => img.classList.add('loaded');
          }
        }
        searchCoverObserver.unobserve(img);
      }
    }
  }, { rootMargin: '100px 0px', threshold: 0.01 });
}

function loadSearchCoverImages() {
  initializeSearchCoverObserver();
  document.querySelectorAll('.search-album-cover').forEach(img => {
    if (!img.dataset.mbid) return;
    searchCoverObserver.observe(img);
  });
}

async function fetchSearchCover(artist, album, mbid) {
  try {
    const response = await fetch('/api/cover-art', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist, album, mbid })
    });
    if (response.ok) {
      const data = await response.json();
      return await urlToBase64(data.url);
    }
  } catch (err) {
    console.error('Search cover fetch error:', err);
  }
  return null;
}

function initializeArtistImageObserver() {
  if (artistImageObserver) return;
  artistImageObserver = new IntersectionObserver(async (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const img = entry.target;
        const name = img.dataset.artist;
        const mbid = img.dataset.mbid || '';
        const cacheKey = mbid || name;
        if (artistImageCache.has(cacheKey)) {
          img.src = artistImageCache.get(cacheKey);
          img.classList.add('loaded');
        } else {
          const base64 = await fetchArtistThumbnail(name, mbid);
          if (base64) {
            artistImageCache.set(cacheKey, base64);
            img.src = base64;
            img.onload = () => img.classList.add('loaded');
          } else {
            artistImageCache.set(cacheKey, artistPlaceholder);
            img.src = artistPlaceholder;
            img.classList.add('loaded');
          }
        }
        artistImageObserver.unobserve(img);
      }
    }
  }, { rootMargin: '100px 0px', threshold: 0.01 });
}

function loadArtistImages() {
  initializeArtistImageObserver();
  document.querySelectorAll('.artist-thumbnail').forEach(img => {
    artistImageObserver.observe(img);
  });
}

async function fetchArtistThumbnail(artist, mbid) {
  try {
    const response = await fetch('/api/artist-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist, mbid })
    });
    if (response.ok) {
      const data = await response.json();
      return await urlToBase64(data.url);
    }
  } catch (err) {
    console.error('Artist image fetch error:', err);
  }
  return null;
}
