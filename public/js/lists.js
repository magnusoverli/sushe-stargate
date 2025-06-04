// Create list form handler
document.getElementById('create-list-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const nameInput = document.getElementById('new-list-name');
  const name = nameInput.value.trim();
  
  if (!name) {
    showToast('Please enter a list name', 'error');
    return;
  }
  
  if (app.lists[name]) {
    showToast('A list with that name already exists', 'error');
    return;
  }
  
  try {
    const response = await fetch(`/api/lists/${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [] })
    });
    
    if (!response.ok) {
      throw new Error('Failed to create list');
    }
    
    const list = await response.json();
    app.lists[name] = list;
    
    updateListsUI();
    selectList(name);
    
    // Close modal and reset form
    document.getElementById('create-list-modal').classList.add('hidden');
    nameInput.value = '';
    
    showToast('List created successfully', 'success');
  } catch (error) {
    console.error('Create list error:', error);
    showToast('Failed to create list', 'error');
  }
});

// List context menu
function showListContextMenu(event, listName) {
  event.preventDefault();
  event.stopPropagation();
  
  // Remove any existing context menu
  document.querySelectorAll('.context-menu').forEach(menu => menu.remove());
  
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.innerHTML = `
    <div class="context-menu-item" onclick="closeMenuAndExecute(() => renameList('${listName}'))">
      <i class="fas fa-edit"></i>
      <span>Rename</span>
    </div>
    <div class="context-menu-item" onclick="closeMenuAndExecute(() => exportList('${listName}'))">
      <i class="fas fa-download"></i>
      <span>Export</span>
    </div>
    <div class="context-menu-item text-red-400" onclick="closeMenuAndExecute(() => deleteList('${listName}'))">
      <i class="fas fa-trash"></i>
      <span>Delete</span>
    </div>
  `;
  
  // Position menu
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

// Helper function to close menu and execute action
function closeMenuAndExecute(action) {
  // Remove all context menus
  document.querySelectorAll('.context-menu').forEach(menu => menu.remove());
  // Execute the action
  action();
}

// Rename list
async function renameList(oldName) {
  const newName = prompt('Enter new name:', oldName);
  
  if (!newName || newName === oldName) return;
  
  if (app.lists[newName]) {
    showToast('A list with that name already exists', 'error');
    return;
  }
  
  try {
    const response = await fetch(`/api/lists/${encodeURIComponent(oldName)}/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName })
    });
    
    if (!response.ok) {
      throw new Error('Failed to rename list');
    }
    
    // Update local state
    app.lists[newName] = app.lists[oldName];
    delete app.lists[oldName];
    
    if (app.currentList === oldName) {
      app.currentList = newName;
    }
    
    updateListsUI();
    showToast('List renamed successfully', 'success');
  } catch (error) {
    console.error('Rename error:', error);
    showToast('Failed to rename list', 'error');
  }
}

// Delete list
async function deleteList(listName) {
  if (!confirm(`Are you sure you want to delete "${listName}"?`)) return;
  
  try {
    const response = await fetch(`/api/lists/${encodeURIComponent(listName)}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete list');
    }
    
    delete app.lists[listName];
    
    if (app.currentList === listName) {
      const remainingLists = Object.keys(app.lists);
      if (remainingLists.length > 0) {
        selectList(remainingLists[0]);
      } else {
        app.currentList = null;
        document.getElementById('album-container').innerHTML = '';
      }
    }
    
    updateListsUI();
    showToast('List deleted successfully', 'success');
  } catch (error) {
    console.error('Delete error:', error);
    showToast('Failed to delete list', 'error');
  }
}

// Export list
function exportList(listName) {
  const list = app.lists[listName];
  if (!list || !list.data) return;
  
  const data = list.data.map((album, index) => ({
    ...album,
    rank: index + 1,
    points: list.data.length - index
  }));
  
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${listName.replace(/[^a-z0-9]/gi, '_')}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
  
  showToast('List exported successfully', 'success');
  logActivity('list_exported', { listName, albumCount: data.length });
}

// Export current list
function exportCurrentList() {
  if (!app.currentList) {
    showToast('No list selected', 'error');
    return;
  }
  
  exportList(app.currentList);
}

// Clear all lists
document.getElementById('clear-all-btn')?.addEventListener('click', async () => {
  if (!confirm('Are you sure you want to delete ALL lists? This cannot be undone!')) return;
  
  if (!confirm('This will permanently delete all your lists. Are you absolutely sure?')) return;
  
  try {
    const response = await fetch('/api/lists', {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error('Failed to clear lists');
    }
    
    app.lists = {};
    app.currentList = null;
    
    updateListsUI();
    document.getElementById('album-container').innerHTML = '';
    
    showToast('All lists cleared', 'success');
  } catch (error) {
    console.error('Clear lists error:', error);
    showToast('Failed to clear lists', 'error');
  }
});

// Import functionality
const importInput = document.getElementById('import-file');
const importDropzone = document.getElementById('import-dropzone');

// Click on dropzone should open file dialog
importDropzone?.addEventListener('click', () => {
  importInput.click();
});

// Drag and drop handlers
importDropzone?.addEventListener('dragover', (e) => {
  e.preventDefault();
  importDropzone.classList.add('border-accent');
});

importDropzone?.addEventListener('dragleave', () => {
  importDropzone.classList.remove('border-accent');
});

importDropzone?.addEventListener('drop', (e) => {
  e.preventDefault();
  importDropzone.classList.remove('border-accent');
  
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/json') {
    handleImportFile(file);
  }
});

// File input change handler
importInput?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    handleImportFile(file);
  }
});

async function handleImportFile(file) {
  try {
    // Extract filename without extension for list name
    const listName = file.name.replace(/\.json$/i, '');
    
    // Read and parse file
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (!Array.isArray(data)) {
      throw new Error('Invalid file format');
    }
    
    // Check if list already exists
    if (app.lists[listName]) {
      // Show conflict dialog
      showImportConflictDialog(listName, data);
    } else {
      // No conflict, create list directly
      await createImportedList(listName, data);
      
      // Close modal and clean up
      closeImportModal();
      
      showToast(`List "${listName}" imported successfully`, 'success');
    }
    
  } catch (error) {
    console.error('Import error:', error);
    showToast('Failed to read import file', 'error');
    // Also close modal on error
    closeImportModal();
  }
}

function closeImportModal() {
  document.getElementById('import-modal').classList.add('hidden');
  document.getElementById('import-file').value = '';
}

async function createImportedList(listName, data) {
  // Transform cover images to ensure they have data URI prefix
  const transformedData = data.map(album => {
    if (album.cover_image && !album.cover_image.startsWith('data:')) {
      // Determine the image format, defaulting to JPEG if not specified
      const format = (album.cover_image_format || 'JPEG').toLowerCase();
      // Add the data URI prefix
      album.cover_image = `data:image/${format};base64,${album.cover_image}`;
    }
    return album;
  });
  
  // Create list with transformed data
  const response = await fetch(`/api/lists/${encodeURIComponent(listName)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: transformedData })
  });
  
  if (!response.ok) {
    throw new Error('Failed to create list');
  }
  
  const list = await response.json();
  app.lists[listName] = {
    ...list,
    data: transformedData // Use the transformed data with fixed cover images
  };
  
  // Update UI and select the new list
  updateListsUI();
  await selectList(listName);
  
  logActivity('list_imported', { 
    listName, 
    albumCount: transformedData.length,
    mode: 'new'
  });
}

function showImportConflictDialog(listName, data) {
  // Create conflict dialog with a unique ID
  const dialog = document.createElement('div');
  dialog.id = 'import-conflict-modal'; // Add unique ID
  dialog.className = 'modal fixed inset-0 z-50 flex items-center justify-center p-4';
  dialog.innerHTML = `
    <div class="modal-backdrop" onclick="handleImportCancel()"></div>
    <div class="modal-content relative z-10 max-w-md">
      <div class="bg-gray-900 rounded-lg p-6">
        <h3 class="text-xl font-semibold mb-4">List Already Exists</h3>
        <p class="text-gray-400 mb-6">
          A list named "<span class="font-medium text-white">${escapeHtml(listName)}</span>" already exists. 
          What would you like to do?
        </p>
        
        <div class="space-y-3">
          <button onclick="handleImportConflict('${escapeHtml(listName)}', 'overwrite')" 
                  class="w-full text-left p-3 bg-gray-800 hover:bg-gray-700 rounded">
            <div class="font-medium">Replace existing list</div>
            <div class="text-sm text-gray-400 mt-1">Delete current albums and import new ones</div>
          </button>
          
          <button onclick="handleImportConflict('${escapeHtml(listName)}', 'merge')" 
                  class="w-full text-left p-3 bg-gray-800 hover:bg-gray-700 rounded">
            <div class="font-medium">Merge with existing list</div>
            <div class="text-sm text-gray-400 mt-1">Keep existing albums and add new ones</div>
          </button>
          
          <button onclick="handleImportConflict('${escapeHtml(listName)}', 'rename')" 
                  class="w-full text-left p-3 bg-gray-800 hover:bg-gray-700 rounded">
            <div class="font-medium">Create with new name</div>
            <div class="text-sm text-gray-400 mt-1">Import as a new list with a different name</div>
          </button>
        </div>
        
        <button onclick="handleImportCancel()" 
                class="btn-secondary w-full mt-6">
          Cancel
        </button>
      </div>
    </div>
  `;
  
  // Store data temporarily
  window.pendingImportData = data;
  window.pendingImportListName = listName;
  
  // Close import modal when showing conflict dialog
  closeImportModal();
  
  document.body.appendChild(dialog);
}

async function handleImportConflict(listName, mode) {
  const data = window.pendingImportData;
  if (!data) return;
  
  // Close the conflict modal immediately to prevent any issues
  const conflictModal = document.getElementById('import-conflict-modal');
  if (conflictModal) {
    conflictModal.remove();
  }
  
  // Transform cover images to ensure they have data URI prefix
  const transformData = (albums) => {
    return albums.map(album => {
      if (album.cover_image && !album.cover_image.startsWith('data:')) {
        const format = (album.cover_image_format || 'JPEG').toLowerCase();
        album.cover_image = `data:image/${format};base64,${album.cover_image}`;
      }
      return album;
    });
  };
  
  try {
    if (mode === 'overwrite') {
      // Replace existing list with transformed data
      const transformedData = transformData(data);
      app.lists[listName].data = transformedData;
      
      await fetch(`/api/lists/${encodeURIComponent(listName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: transformedData })
      });
      
      logActivity('list_imported', { 
        listName, 
        albumCount: transformedData.length,
        mode: 'overwrite'
      });
      
    } else if (mode === 'merge') {
      // Merge with existing, transforming new albums
      const existingData = app.lists[listName].data || [];
      const existingIds = new Set(existingData.map(a => a.album_id));
      const transformedNewData = transformData(data);
      const newAlbums = transformedNewData.filter(a => !existingIds.has(a.album_id));
      app.lists[listName].data = [...existingData, ...newAlbums];
      
      await fetch(`/api/lists/${encodeURIComponent(listName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: app.lists[listName].data })
      });
      
      logActivity('list_imported', { 
        listName, 
        albumCount: app.lists[listName].data.length,
        newAlbums: newAlbums.length,
        mode: 'merge'
      });
      
    } else if (mode === 'rename') {
      // Get new name
      const newName = prompt('Enter a new name for the list:', `${listName} (imported)`);
      if (!newName || newName.trim() === '') {
        // User cancelled, clean up
        delete window.pendingImportData;
        delete window.pendingImportListName;
        return;
      }
      
      // Check if new name also exists
      if (app.lists[newName]) {
        showToast('A list with that name already exists', 'error');
        // Re-show the conflict dialog
        showImportConflictDialog(listName, data);
        return;
      }
      
      // Use the existing createImportedList which already has the transformation
      await createImportedList(newName, data);
      
      // Clean up
      delete window.pendingImportData;
      delete window.pendingImportListName;
      
      showToast(`List "${newName}" imported successfully`, 'success');
      return;
    }
    
    // Update UI
    updateListsUI();
    await selectList(listName);
    
    // Clean up temporary data
    delete window.pendingImportData;
    delete window.pendingImportListName;
    
    showToast('Import successful', 'success');
    
  } catch (error) {
    console.error('Import conflict handling error:', error);
    showToast('Failed to import data', 'error');
  }
}

function handleImportCancel() {
  // Remove conflict dialog by ID
  const conflictModal = document.getElementById('import-conflict-modal');
  if (conflictModal) {
    conflictModal.remove();
  }
  
  // Clean up temporary data
  delete window.pendingImportData;
  delete window.pendingImportListName;
  
  // Make sure import modal is closed
  closeImportModal();
}

// Make functions globally available
window.handleImportConflict = handleImportConflict;
window.handleImportCancel = handleImportCancel;
window.closeMenuAndExecute = closeMenuAndExecute;