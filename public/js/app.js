// Global app state
const app = {
  currentList: null,
  lists: {},
  touchStartY: 0,
  touchEndY: 0,
  isLoading: false,
  coverQueue: [],
  coverCache: new Map(),
  observer: null,
  sortable: null
};

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  // Apply user theme
  applyUserTheme();
  
  // Initialize components
  initializeModals();
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
  // This is now handled in the layout file, but we can keep this 
  // function for compatibility or additional theme-related setup
  console.log('Theme applied from layout');
}

function isMobileDevice() {
  // Check for touch support
  const hasTouch = ('ontouchstart' in window) || 
                   (navigator.maxTouchPoints > 0) || 
                   (navigator.msMaxTouchPoints > 0);
  
  // Check for Web Share API
  const hasShareAPI = 'share' in navigator;
  
  // Check if can share files (this might fail on Firefox iOS)
  let canShareFiles = false;
  if (hasShareAPI && navigator.canShare) {
    try {
      // Test with a dummy file
      const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      canShareFiles = navigator.canShare({ files: [testFile] });
    } catch (e) {
      console.log('canShare test failed:', e);
    }
  }
  
  // Additional mobile indicators
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  
  console.log('Mobile detection:', {
    hasTouch,
    hasShareAPI,
    canShareFiles,
    isMobileUA,
    isIOS,
    userAgent: navigator.userAgent
  });
  
  // For iOS, we'll consider it mobile if it has touch, regardless of share API
  return hasTouch && (isMobileUA || isIOS);
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
  const container = document.getElementById('lists-container');
  
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
  
  container.innerHTML = listsHTML;
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
  
  // Use requestAnimationFrame to ensure DOM is ready
  requestAnimationFrame(() => {
    initializeSortable();
    setupScrollEdgeDetection(); // Add this
    loadVisibleCovers();
  });
  
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
  
  // Destroy existing sortable instance
  if (app.sortable) {
    app.sortable.destroy();
    app.sortable = null;
  }
  
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
  
  // Use responsive grid that becomes table-like on desktop
  container.innerHTML = `
    <div class="album-responsive-container sortable-container" id="sortable-albums">
      <div class="hidden lg:grid album-header">
        <div class="col-num">#</div>
        <div class="col-cover">Cover</div>
        <div class="col-album">Album</div>
        <div class="col-artist">Artist</div>
        <div class="col-country">Country</div>
        <div class="col-genre1">Genre 1</div>
        <div class="col-genre2">Genre 2</div>
        <div class="col-comment">Comment</div>
      </div>
      ${albums.map((album, index) => createAlbumItem(album, index)).join('')}
    </div>
  `;
  
  // Initialize sortable after DOM is ready
  requestAnimationFrame(() => {
    initializeSortable();
    loadVisibleCovers();
  });

  const reorderHint = document.getElementById('reorder-hint');
  if (reorderHint) {
    if (albums.length > 1) {
      reorderHint.style.display = 'block';
      reorderHint.title = 'Hold & drag to reorder';
    } else {
      reorderHint.style.display = 'none';
    }
  }
}

function initializeSortable() {
  const sortableContainer = document.getElementById('sortable-albums');
  if (!sortableContainer) return;
  
  const albumItems = sortableContainer.querySelectorAll('.album-item');
  const scrollContainer = document.getElementById('album-container');
  
  // Destroy existing instance
  if (app.sortable) {
    app.sortable.destroy();
    app.sortable = null;
  }
  
  // Detect if we're on desktop
  const isDesktop = window.innerWidth >= 1024; // lg breakpoint
  
  // Configure SortableJS with better iOS support
  app.sortable = Sortable.create(sortableContainer, {
    animation: 150,
    delay: 300,
    delayOnTouchOnly: true,
    touchStartThreshold: 10,
    
    // Critical iOS settings
    forceFallback: true,
    fallbackTolerance: 5,
    
    ghostClass: 'sortable-ghost',
    dragClass: 'sortable-drag',
    chosenClass: 'sortable-chosen',
    fallbackClass: 'sortable-fallback',
    
    fallbackOnBody: false,
    
    // Adjust swap threshold based on device
    swapThreshold: isDesktop ? 0.55 : 0.65,
    invertSwap: true,
    /*emptyInsertThreshold: 0,*/
    
    draggable: '.album-item',
    filter: '.album-menu-btn, .editable-field, input, button, a',
    preventOnFilter: true,
    
    // Simplified scroll settings
    scroll: true, // Let SortableJS handle scrolling
    scrollSensitivity: 100,
    scrollSpeed: 15,
    bubbleScroll: true, // Enable bubble scrolling for iOS
    
    onStart: function(evt) {
      // Temporarily disable zoom during drag
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content', 
          'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      }
      
      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
      
      // Store original scroll position
      app.dragScrollTop = scrollContainer.scrollTop;
      
      // Add dragging class
      scrollContainer.classList.add('is-dragging');
      evt.item.style.opacity = '0.0'; // Visual feedback
      
      // Create scroll zone indicators
      createScrollZones();
      
      logActivity('album_drag_started', {
        albumId: evt.item.dataset.albumId,
        fromIndex: evt.oldIndex
      });
    },
    
    onEnd: async function(evt) {
      // Re-enable zoom after drag
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content', 
          'width=device-width, initial-scale=1.0, viewport-fit=cover');
      }
      
      // Remove dragging class
      scrollContainer.classList.remove('is-dragging');
      evt.item.style.opacity = ''; // Reset opacity
      
      // Remove scroll zones
      removeScrollZones();
      
      if (evt.oldIndex !== evt.newIndex) {
        await reorderAlbums(evt.oldIndex, evt.newIndex);
        updatePlacementNumbers();
        
        if ('vibrate' in navigator) {
          navigator.vibrate(20);
        }
      }
    },
    
    onChange: function(evt) {
      // This fires during the drag when positions change
      // Helps with visual feedback on iOS
      updatePlacementNumbers();
    },
    
    onChoose: function(evt) {
      evt.item.classList.add('touch-active');
    },
    
    onUnchoose: function(evt) {
      evt.item.classList.remove('touch-active');
    },
    
    onMove: function(evt) {
      return !evt.related.classList.contains('album-header');
    }
  });
  
  // Add iOS-specific touch handling
  if ('ontouchstart' in window) {
    sortableContainer.addEventListener('touchmove', function(e) {
      // Prevent iOS bounce scrolling during drag
      if (app.sortable && app.sortable.dragging) {
        e.preventDefault();
      }
    }, { passive: false });
  }
  
  // Show/hide reorder hint based on album count
  const reorderHint = document.getElementById('reorder-hint');
  if (reorderHint) {
    const albums = app.lists[app.currentList]?.data || [];
    if (albums.length > 1) {
      reorderHint.style.display = 'block';
      reorderHint.title = 'Hold & drag to reorder';
    } else {
      reorderHint.style.display = 'none';
    }
  }
}

// Add scroll edge detection for visual feedback
function setupScrollEdgeDetection() {
  const albumContainer = document.getElementById('album-container');
  if (!albumContainer) return;
  
  let rafId = null;
  
  const checkScrollEdges = () => {
    if (!albumContainer.classList.contains('is-dragging')) return;
    
    const scrollTop = albumContainer.scrollTop;
    const scrollHeight = albumContainer.scrollHeight;
    const clientHeight = albumContainer.clientHeight;
    const scrollBottom = scrollHeight - scrollTop - clientHeight;
    
    // Add/remove classes based on scroll position
    albumContainer.classList.toggle('scroll-top', scrollTop < 100);
    albumContainer.classList.toggle('scroll-bottom', scrollBottom < 100);
    
    rafId = requestAnimationFrame(checkScrollEdges);
  };
  
  // Start checking when dragging starts
  albumContainer.addEventListener('dragstart', () => {
    checkScrollEdges();
  });
  
  // Stop checking when dragging ends
  albumContainer.addEventListener('dragend', () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    albumContainer.classList.remove('scroll-top', 'scroll-bottom');
  });
}

function createAlbumItem(album, index) {
  return `
    <div class="album-item" data-index="${index}" data-album-id="${album.album_id}">
      <div class="album-num hidden lg:block">${index + 1}</div>
      
      <div class="album-cover-container">
        ${album.cover_image ? 
          `<img class="album-cover" data-src="${album.cover_image}" alt="Cover">` :
          `<div class="album-cover-placeholder">
            <i class="fas fa-compact-disc"></i>
          </div>`
        }
      </div>
      
      <div class="album-info">
        <div class="flex items-start gap-2 lg:block">
          <span class="album-placement-mobile lg:hidden text-accent font-bold text-lg">#${index + 1}</span>
          <div class="flex-1">
            <div class="album-title">${escapeHtml(album.album)}</div>
            <div class="album-artist">${escapeHtml(album.artist)}</div>
            <div class="album-meta lg:hidden">
              ${album.country ? `<span><i class="fas fa-globe"></i>${escapeHtml(album.country)}</span>` : ''}
              ${album.genre_1 ? `<span><i class="fas fa-music"></i>${escapeHtml(album.genre_1)}</span>` : ''}
            </div>
          </div>
        </div>
      </div>
      
      <div class="album-fields hidden lg:contents">
        <div class="editable-field" data-field="country" data-index="${index}" onclick="editField(this)">
          ${escapeHtml(album.country || '-')}
        </div>
        <div class="editable-field" data-field="genre_1" data-index="${index}" onclick="editField(this)">
          ${escapeHtml(album.genre_1 || '-')}
        </div>
        <div class="editable-field" data-field="genre_2" data-index="${index}" onclick="editField(this)">
          ${escapeHtml(album.genre_2 || '-')}
        </div>
        <div class="editable-field" data-field="comments" data-index="${index}" onclick="editField(this)">
          ${escapeHtml(album.comments || '-')}
        </div>
      </div>
      
      <button class="album-menu-btn lg:hidden" onclick="showAlbumMenu(event, ${index})">
        <i class="fas fa-ellipsis-v"></i>
      </button>
      
      ${album.comments && album.comments.trim() ? `
        <div class="album-comment-mobile lg:hidden">
          <i class="fas fa-comment"></i>
          ${escapeHtml(album.comments)}
        </div>
      ` : ''}
    </div>
  `;
}

// Recalculate placement numbers after sorting
function updatePlacementNumbers() {
  // Update desktop view numbers
  document.querySelectorAll('.album-num').forEach((elem, index) => {
    elem.textContent = index + 1;
  });
  
  // Update mobile view numbers
  document.querySelectorAll('.album-placement-mobile').forEach((elem, index) => {
    elem.textContent = `#${index + 1}`;
  });
  
  // Update data-index attributes for proper field editing
  document.querySelectorAll('.album-item').forEach((item, index) => {
    item.dataset.index = index;
    
    // Update all editable fields' data-index
    item.querySelectorAll('.editable-field').forEach(field => {
      field.dataset.index = index;
    });
    
    // Update menu button onclick
    const menuBtn = item.querySelector('.album-menu-btn');
    if (menuBtn) {
      menuBtn.setAttribute('onclick', `showAlbumMenu(event, ${index})`);
    }
  });
}

// Create visual scroll zones
function createScrollZones() {
  const albumContainer = document.getElementById('album-container');
  if (!albumContainer) return;
  
  // Top scroll zone
  const topZone = document.createElement('div');
  topZone.id = 'scroll-zone-top';
  topZone.className = 'fixed top-0 left-0 right-0 h-20 pointer-events-none z-50 flex items-center justify-center';
  topZone.innerHTML = '<i class="fas fa-chevron-up text-white text-2xl opacity-0 transition-opacity"></i>';
  
  // Bottom scroll zone
  const bottomZone = document.createElement('div');
  bottomZone.id = 'scroll-zone-bottom';
  bottomZone.className = 'fixed bottom-0 left-0 right-0 h-20 pointer-events-none z-50 flex items-center justify-center';
  bottomZone.innerHTML = '<i class="fas fa-chevron-down text-white text-2xl opacity-0 transition-opacity"></i>';
  
  document.body.appendChild(topZone);
  document.body.appendChild(bottomZone);
  
  // Show indicators when near edges
  const updateZoneVisibility = () => {
    const rect = albumContainer.getBoundingClientRect();
    const scrollTop = albumContainer.scrollTop;
    const scrollHeight = albumContainer.scrollHeight;
    const clientHeight = albumContainer.clientHeight;
    
    topZone.firstChild.classList.toggle('opacity-50', scrollTop > 50);
    bottomZone.firstChild.classList.toggle('opacity-50', scrollHeight - scrollTop - clientHeight > 50);
  };
  
  albumContainer.addEventListener('scroll', updateZoneVisibility);
  updateZoneVisibility();
}

// Remove scroll zones
function removeScrollZones() {
  const topZone = document.getElementById('scroll-zone-top');
  const bottomZone = document.getElementById('scroll-zone-bottom');
  
  if (topZone) topZone.remove();
  if (bottomZone) bottomZone.remove();
}

// Function to handle album reordering (for future implementation)
async function reorderAlbums(fromIndex, toIndex) {
  if (!app.currentList || !app.lists[app.currentList]) return;
  
  const albums = app.lists[app.currentList].data;
  
  // Reorder the array
  const [movedAlbum] = albums.splice(fromIndex, 1);
  albums.splice(toIndex, 0, movedAlbum);
  
  // Save the reordered list
  await saveCurrentList();
  
  // Log the activity
  await logActivity('albums_reordered', {
    listName: app.currentList,
    fromIndex,
    toIndex,
    albumId: movedAlbum.album_id
  });
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
  
  // Add album button (FAB only now)
  document.getElementById('add-album-fab')?.addEventListener('click', () => {
    document.getElementById('add-album-modal').classList.remove('hidden');
  });
  
  // Import button
  document.getElementById('import-btn')?.addEventListener('click', () => {
    document.getElementById('import-modal').classList.remove('hidden');
  });
  
  // Export button
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    // Remove any existing listeners to avoid duplicates
    exportBtn.replaceWith(exportBtn.cloneNode(true));
    const newExportBtn = document.getElementById('export-btn');
    
    // Add click listener
    newExportBtn.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent any default behavior
      exportCurrentList();
    });
    
    // Update text/icon for mobile devices
    if (isMobileDevice()) {
      newExportBtn.innerHTML = '<i class="fas fa-share mr-2"></i>Share List';
    }
  }
  
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

function initializeMobileMenu() {
  const hamburger = document.getElementById('mobile-menu-btn');
  const sidebarToggle = document.getElementById('desktop-menu-btn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobile-overlay');
  
  const toggleSidebar = (show) => {
    if (show) {
      sidebar.classList.remove('-translate-x-full');
      overlay.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
    } else {
      sidebar.classList.add('-translate-x-full');
      overlay.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }
  };
  
  hamburger?.addEventListener('click', () => toggleSidebar(true));
  overlay?.addEventListener('click', () => toggleSidebar(false));

  sidebarToggle?.addEventListener('click', () => {
    if (window.innerWidth >= 1024) {
      sidebar.classList.toggle('hidden');
    } else {
      toggleSidebar(true);
    }
  });
  
  // Close sidebar on list selection on mobile
  if (window.innerWidth < 1024) {
    document.addEventListener('click', (e) => {
      if (e.target.closest('.list-item')) {
        setTimeout(() => toggleSidebar(false), 100);
      }
    });
  }
}

function initializeIntersectionObserver() {
  // Lazy loading for images with a larger root margin for better preloading
  app.observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src && !img.src) {
          img.src = img.dataset.src;
          img.onload = () => {
            img.classList.add('loaded');
            app.observer.unobserve(img);
          };
          img.onerror = () => {
            console.error('Failed to load cover image:', img.dataset.src);
            app.observer.unobserve(img);
          };
        }
      }
    });
  }, { 
    rootMargin: '200px 0px', // Increased margin to preload images before they become visible
    threshold: 0.01 // Trigger as soon as even 1% is visible
  });
}

function loadVisibleCovers() {
  // Ensure observer is initialized
  if (!app.observer) {
    initializeIntersectionObserver();
  }
  
  document.querySelectorAll('.album-cover[data-src]').forEach(img => {
    if (img.src) return; // Skip if already loaded
    
    // Check if image is already in viewport with a more generous boundary
    const rect = img.getBoundingClientRect();
    const viewHeight = window.innerHeight || document.documentElement.clientHeight;
    const viewWidth = window.innerWidth || document.documentElement.clientWidth;
    
    // Add a buffer zone to preload images that are just outside the viewport
    const buffer = 100;
    const isNearViewport = rect.bottom >= -buffer && 
                          rect.top <= viewHeight + buffer &&
                          rect.right >= -buffer && 
                          rect.left <= viewWidth + buffer;
    
    if (isNearViewport) {
      // Load immediately if near or in viewport
      img.src = img.dataset.src;
      img.onload = () => img.classList.add('loaded');
      img.onerror = () => {
        console.error('Failed to load cover image:', img.dataset.src);
        // Optionally set a fallback or remove the image
      };
    } else {
      // Otherwise observe for lazy loading
      app.observer.observe(img);
    }
  });
}