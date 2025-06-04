// Global app state
const app = {
  currentList: null,
  lists: {},
  touchStartY: 0,
  touchEndY: 0,
  isLoading: false,
  coverQueue: [],
  coverCache: new Map(),
  observer: null
};

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  // Apply user theme
  applyUserTheme();
  
  // Initialize components
  initializeModals();
  initializeTooltips();
  initializeSearch();
  initializeContextMenus();
  initializeMobileMenu();
  
  // Load user data
  await loadUserLists();
  
  // Set up event listeners
  setupEventListeners();
  
  // Initialize intersection observer for lazy loading
  initializeIntersectionObserver();
  
  // Check for admin status
  checkAdminStatus();
});

// Apply user's accent color theme
function applyUserTheme() {
  const accentColor = document.querySelector('meta[name="user-accent-color"]')?.content || '#dc2626';
  
  // Convert hex to RGB for calculations
  const hex2rgb = hex => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };
  
  const rgb = hex2rgb(accentColor);
  if (rgb) {
    // Calculate variations
    const hover = `#${Math.min(255, rgb.r + 30).toString(16).padStart(2, '0')}${Math.min(255, rgb.g + 30).toString(16).padStart(2, '0')}${Math.min(255, rgb.b + 30).toString(16).padStart(2, '0')}`;
    const light = `#${Math.min(255, rgb.r + 100).toString(16).padStart(2, '0')}${Math.min(255, rgb.g + 100).toString(16).padStart(2, '0')}${Math.min(255, rgb.b + 100).toString(16).padStart(2, '0')}`;
    const dark = `#${Math.max(0, rgb.r - 50).toString(16).padStart(2, '0')}${Math.max(0, rgb.g - 50).toString(16).padStart(2, '0')}${Math.max(0, rgb.b - 50).toString(16).padStart(2, '0')}`;
    
    // Apply to CSS variables
    document.documentElement.style.setProperty('--accent-color', accentColor);
    document.documentElement.style.setProperty('--accent-color-hover', hover);
    document.documentElement.style.setProperty('--accent-color-light', light);
    document.documentElement.style.setProperty('--accent-color-dark', dark);
    document.documentElement.style.setProperty('--accent-color-shadow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`);
  }
}

// Load user lists
async function loadUserLists() {
  try {
    const response = await fetch('/api/lists');
    const lists = await response.json();
    
    app.lists = {};
    lists.forEach(list => {
      app.lists[list.name] = list;
    });
    
    // Update UI
    updateListsUI();
    
    // Select last used list or first available
    const lastList = document.querySelector('meta[name="last-selected-list"]')?.content;
    if (lastList && app.lists[lastList]) {
      selectList(lastList);
    } else if (Object.keys(app.lists).length > 0) {
      selectList(Object.keys(app.lists)[0]);
    }
  } catch (error) {
    console.error('Failed to load lists:', error);
    showToast('Failed to load lists', 'error');
  }
}

// Update lists UI
function updateListsUI() {
  const desktop = document.getElementById('desktop-lists');
  const mobile = document.getElementById('mobile-lists');
  
  const listsHTML = Object.keys(app.lists).map(name => `
    <button class="list-item w-full text-left px-4 py-2 hover:bg-gray-700 rounded flex justify-between items-center group ${app.currentList === name ? 'bg-gray-700' : ''}"
            onclick="selectList('${name}')"
            oncontextmenu="showListContextMenu(event, '${name}')">
      <span class="truncate">${escapeHtml(name)}</span>
      <span class="text-gray-500 text-sm opacity-0 group-hover:opacity-100 transition-opacity">
        ${app.lists[name].data?.length || 0}
      </span>
    </button>
  `).join('');
  
  if (desktop) desktop.innerHTML = listsHTML;
  if (mobile) mobile.innerHTML = listsHTML;
  
  // Update list selector in add album modal
  const listSelector = document.getElementById('list-selector');
  if (listSelector) {
    listSelector.innerHTML = Object.keys(app.lists).map(name => `
      <option value="${name}" ${app.currentList === name ? 'selected' : ''}>${escapeHtml(name)}</option>
    `).join('');
  }
}

// Select a list
async function selectList(listName) {
  if (!app.lists[listName]) return;
  
  app.currentList = listName;
  
  // Update UI
  document.querySelectorAll('.list-item').forEach(item => {
    item.classList.toggle('bg-gray-700', item.textContent.includes(listName));
  });
  
  // Update current list display
  const currentListEl = document.getElementById('current-list-name');
  if (currentListEl) {
    currentListEl.textContent = listName;
  }
  
  // Display albums
  displayAlbums();
  
  // Save preference
  await fetch('/api/user/last-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listName })
  });
  
  // Log activity
  logActivity('list_selected', { listName });
}

// Display albums
function displayAlbums() {
  if (!app.currentList || !app.lists[app.currentList]) return;
  
  const albums = app.lists[app.currentList].data || [];
  const container = document.getElementById('album-container');
  
  if (albums.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 text-gray-500">
        <i class="fas fa-compact-disc text-6xl mb-4"></i>
        <p class="text-xl">No albums in this list yet</p>
        <p class="mt-2">Click the + button to add your first album</p>
      </div>
    `;
    return;
  }
  
  // Check if mobile
  const isMobile = window.innerWidth < 1024;
  
  if (isMobile) {
    // Mobile card layout
    container.innerHTML = albums.map((album, index) => createAlbumCard(album, index)).join('');
  } else {
    // Desktop table layout
    container.innerHTML = `
      <table class="table-dark">
        <thead>
          <tr>
            <th class="w-12">#</th>
            <th class="w-20">Cover</th>
            <th>Album</th>
            <th>Artist</th>
            <th class="w-32">Country</th>
            <th class="w-32">Genre 1</th>
            <th class="w-32">Genre 2</th>
            <th>Comment</th>
          </tr>
        </thead>
        <tbody id="album-list">
          ${albums.map((album, index) => createAlbumRow(album, index)).join('')}
        </tbody>
      </table>
    `;
  }
  
  // Load cover images
  loadVisibleCovers();
}

// Create album row for desktop
function createAlbumRow(album, index) {
  return `
    <tr class="album-row" data-index="${index}">
      <td class="font-medium">${index + 1}</td>
      <td>
        <div class="w-16 h-16 bg-gray-700 rounded overflow-hidden">
          ${album.cover_image ? 
            `<img class="album-cover w-full h-full object-cover" data-src="${album.cover_image}" alt="Cover">` :
            `<div class="w-full h-full flex items-center justify-center text-gray-500">
              <i class="fas fa-compact-disc text-2xl"></i>
            </div>`
          }
        </div>
      </td>
      <td class="font-medium">${escapeHtml(album.album)}</td>
      <td>${escapeHtml(album.artist)}</td>
      <td>
        <span class="editable-field cursor-pointer hover:bg-gray-700 px-2 py-1 rounded" 
              data-field="country" 
              data-index="${index}"
              onclick="editField(this)">
          ${escapeHtml(album.country || '-')}
        </span>
      </td>
      <td>
        <span class="editable-field cursor-pointer hover:bg-gray-700 px-2 py-1 rounded" 
              data-field="genre_1" 
              data-index="${index}"
              onclick="editField(this)">
          ${escapeHtml(album.genre_1 || '-')}
        </span>
      </td>
      <td>
        <span class="editable-field cursor-pointer hover:bg-gray-700 px-2 py-1 rounded" 
              data-field="genre_2" 
              data-index="${index}"
              onclick="editField(this)">
          ${escapeHtml(album.genre_2 || '-')}
        </span>
      </td>
      <td>
        <span class="editable-field cursor-pointer hover:bg-gray-700 px-2 py-1 rounded" 
              data-field="comments" 
              data-index="${index}"
              onclick="editField(this)">
          ${escapeHtml(album.comments || '-')}
        </span>
      </td>
    </tr>
  `;
}

// Create album card for mobile
function createAlbumCard(album, index) {
  return `
    <div class="album-card mb-4" data-index="${index}">
      <div class="flex gap-4">
        <div class="flex-shrink-0">
          <div class="w-20 h-20 bg-gray-700 rounded overflow-hidden">
            ${album.cover_image ? 
              `<img class="album-cover w-full h-full object-cover" data-src="${album.cover_image}" alt="Cover">` :
              `<div class="w-full h-full flex items-center justify-center text-gray-500">
                <i class="fas fa-compact-disc text-3xl"></i>
              </div>`
            }
          </div>
        </div>
        <div class="flex-grow">
          <h3 class="font-semibold text-lg">${escapeHtml(album.album)}</h3>
          <p class="text-gray-400">${escapeHtml(album.artist)}</p>
          <div class="mt-2 text-sm text-gray-500">
            ${album.country ? `<span class="mr-3"><i class="fas fa-globe mr-1"></i>${escapeHtml(album.country)}</span>` : ''}
            ${album.genre_1 ? `<span><i class="fas fa-music mr-1"></i>${escapeHtml(album.genre_1)}</span>` : ''}
          </div>
        </div>
        <div class="flex-shrink-0">
          <button class="text-gray-400 hover:text-white" onclick="showAlbumMenu(event, ${index})">
            <i class="fas fa-ellipsis-v"></i>
          </button>
        </div>
      </div>
      ${album.comments ? `
        <div class="mt-3 text-sm text-gray-400">
          <i class="fas fa-comment mr-1"></i>
          ${escapeHtml(album.comments)}
        </div>
      ` : ''}
    </div>
  `;
}

// Save current list
async function saveCurrentList() {
  if (!app.currentList || !app.lists[app.currentList]) return;
  
  try {
    const response = await fetch(`/api/lists/${encodeURIComponent(app.currentList)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: app.lists[app.currentList].data })
    });
    
    if (!response.ok) {
      throw new Error('Failed to save list');
    }
  } catch (error) {
    console.error('Save error:', error);
    showToast('Failed to save changes', 'error');
  }
}

// Edit field inline
function editField(element) {
  const field = element.dataset.field;
  const index = parseInt(element.dataset.index);
  const currentValue = element.textContent.trim();
  const album = app.lists[app.currentList].data[index];
  
  // Create input
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'input-dark w-full';
  input.value = currentValue === '-' ? '' : currentValue;
  
  // Add datalist for predefined values
  if (field === 'country' || field === 'genre_1' || field === 'genre_2') {
    const datalistId = `${field}-datalist`;
    input.setAttribute('list', datalistId);
    
    if (!document.getElementById(datalistId)) {
      const datalist = document.createElement('datalist');
      datalist.id = datalistId;
      
      const options = field === 'country' ? 
        window.countries : window.genres;
      
      datalist.innerHTML = options.map(opt => 
        `<option value="${opt}">`
      ).join('');
      
      document.body.appendChild(datalist);
    }
  }
  
  // Replace span with input
  element.style.display = 'none';
  element.parentNode.insertBefore(input, element.nextSibling);
  input.focus();
  input.select();
  
  // Save on blur or enter
  const save = async () => {
    const newValue = input.value.trim();
    
    if (newValue !== currentValue) {
      album[field] = newValue || null;
      element.textContent = newValue || '-';
      
      await saveCurrentList();
      
      logActivity('album_edited', {
        field,
        oldValue: currentValue,
        newValue,
        albumId: album.album_id
      });
    }
    
    input.remove();
    element.style.display = '';
  };
  
  input.addEventListener('blur', save);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      input.remove();
      element.style.display = '';
    }
  });
}

// Show toast notification
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="flex items-center justify-between">
      <span>${message}</span>
      <button onclick="this.parentElement.parentElement.remove()" class="ml-4">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Log activity
async function logActivity(action, details = {}) {
  try {
    await fetch('/api/activity/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, details })
    });
  } catch (error) {
    console.error('Activity log error:', error);
  }
}

// Initialize modals
function initializeModals() {
  // Modal close handlers
  document.querySelectorAll('[data-modal-close]').forEach(button => {
    button.addEventListener('click', () => {
      const modal = button.closest('.modal');
      if (modal) modal.classList.add('hidden');
    });
  });
  
  // Close on backdrop click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  });
}

// Setup event listeners
function setupEventListeners() {
  // Create list button
  document.getElementById('create-list-btn')?.addEventListener('click', () => {
    document.getElementById('create-list-modal').classList.remove('hidden');
    document.getElementById('new-list-name').focus();
  });
  
  // Add album buttons (desktop and mobile FAB)
  ['add-album-btn', 'add-album-fab'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      document.getElementById('add-album-modal').classList.remove('hidden');
    });
  });
  
  // Import button
  document.getElementById('import-btn')?.addEventListener('click', () => {
    document.getElementById('import-modal').classList.remove('hidden');
  });
  
  // Export button
  document.getElementById('export-btn')?.addEventListener('click', exportCurrentList);
  
  // Settings button
  document.getElementById('settings-btn')?.addEventListener('click', () => {
    window.location.href = '/settings';
  });
  
  // Admin button
  document.getElementById('admin-btn')?.addEventListener('click', () => {
    window.location.href = '/admin';
  });
}

// Check admin status
async function checkAdminStatus() {
  try {
    const response = await fetch('/api/admin/status');
    const data = await response.json();
    
    if (data.isAdmin) {
      document.getElementById('admin-btn')?.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Admin status check error:', error);
  }
}

// Initialize other components...
function initializeTooltips() {
  // Tooltips implementation
}

function initializeSearch() {
  // Search implementation (see albums.js)
}

function initializeContextMenus() {
  // Context menu implementation (see lists.js)
}

function initializeMobileMenu() {
  // Mobile menu implementation
  const hamburger = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('mobile-sidebar');
  const overlay = document.getElementById('mobile-overlay');
  
  hamburger?.addEventListener('click', () => {
    sidebar.classList.toggle('-translate-x-full');
    overlay.classList.toggle('hidden');
  });
  
  overlay?.addEventListener('click', () => {
    sidebar.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
  });
}

function initializeIntersectionObserver() {
  // Lazy loading for images
  app.observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src && !img.src) {
          img.src = img.dataset.src;
          img.onload = () => img.classList.add('loaded');
          app.observer.unobserve(img);
        }
      }
    });
  }, { rootMargin: '50px' });
}

function loadVisibleCovers() {
  document.querySelectorAll('.album-cover[data-src]').forEach(img => {
    app.observer.observe(img);
  });
}

// Additional functions will be in separate files (lists.js, albums.js, etc.)