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
    <div class="context-menu-item" onclick="renameList('${listName}')">
      <i class="fas fa-edit"></i>
      <span>Rename</span>
    </div>
    <div class="context-menu-item" onclick="exportList('${listName}')">
      <i class="fas fa-download"></i>
      <span>Export</span>
    </div>
    <div class="context-menu-item text-red-400" onclick="deleteList('${listName}')">
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

importDropzone?.addEventListener('click', () => importInput.click());

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

importInput?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    handleImportFile(file);
  }
});

async function handleImportFile(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (!Array.isArray(data)) {
      throw new Error('Invalid file format');
    }
    
    // Show import options
    const importList = document.getElementById('import-list-select');
    const importOptions = document.getElementById('import-options');
    
    importList.innerHTML = `
      <option value="new">Create new list</option>
      ${Object.keys(app.lists).map(name => 
        `<option value="${name}">${escapeHtml(name)}</option>`
      ).join('')}
    `;
    
    importOptions.classList.remove('hidden');
    
    // Store import data temporarily
    window.pendingImportData = data;
    
  } catch (error) {
    console.error('Import error:', error);
    showToast('Failed to read import file', 'error');
  }
}

document.getElementById('import-confirm-btn')?.addEventListener('click', async () => {
  const listSelect = document.getElementById('import-list-select');
  const conflictSelect = document.getElementById('import-conflict-select');
  
  const targetList = listSelect.value;
  const conflictMode = conflictSelect.value;
  
  if (!window.pendingImportData) return;
  
  try {
    let listName;
    
    if (targetList === 'new') {
      // Create new list
      listName = prompt('Enter name for new list:');
      if (!listName) return;
      
      if (app.lists[listName]) {
        showToast('A list with that name already exists', 'error');
        return;
      }
      
      // Create list with imported data
      const response = await fetch(`/api/lists/${encodeURIComponent(listName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: window.pendingImportData })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create list');
      }
      
      const list = await response.json();
      app.lists[listName] = list;
      
    } else {
      // Import into existing list
      listName = targetList;
      let existingData = app.lists[listName].data || [];
      
      if (conflictMode === 'overwrite') {
        app.lists[listName].data = window.pendingImportData;
      } else if (conflictMode === 'merge') {
        // Merge without duplicates
        const existingIds = new Set(existingData.map(a => a.album_id));
        const newAlbums = window.pendingImportData.filter(a => !existingIds.has(a.album_id));
        app.lists[listName].data = [...existingData, ...newAlbums];
      }
      
      // Save updated list
      await saveCurrentList();
    }
    
    // Clean up
    delete window.pendingImportData;
    document.getElementById('import-modal').classList.add('hidden');
    document.getElementById('import-options').classList.add('hidden');
    importInput.value = '';
    
    updateListsUI();
    selectList(listName);
    
    showToast('Import successful', 'success');
    logActivity('list_imported', { 
      listName, 
      mode: conflictMode,
      albumCount: app.lists[listName].data.length 
    });
    
  } catch (error) {
    console.error('Import error:', error);
    showToast('Failed to import data', 'error');
  }
});