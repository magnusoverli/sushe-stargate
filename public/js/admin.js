// Admin panel functionality
let activityStream = null;

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('admin-panel')) {
    initializeAdminPanel();
  }
});

function initializeAdminPanel() {
  // Start activity stream
  startActivityStream();
  
  // Refresh stats periodically
  setInterval(refreshStats, 30000);
  
  // Initialize user search
  initializeUserSearch();
}

// Make user admin
async function makeAdmin(userId) {
  if (!confirm('Grant admin privileges to this user?')) return;
  
  try {
    const response = await fetch('/admin/make-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    
    if (response.ok) {
      location.reload();
    } else {
      throw new Error('Failed to grant admin');
    }
  } catch (error) {
    console.error('Make admin error:', error);
    alert('Failed to grant admin privileges');
  }
}

// Revoke admin
async function revokeAdmin(userId) {
  if (!confirm('Revoke admin privileges from this user?')) return;
  
  try {
    const response = await fetch('/admin/revoke-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    
    if (response.ok) {
      location.reload();
    } else {
      throw new Error('Failed to revoke admin');
    }
  } catch (error) {
    console.error('Revoke admin error:', error);
    alert('Failed to revoke admin privileges');
  }
}

// Delete user
async function deleteUser(userId) {
  const confirmation = prompt('Type "DELETE" to confirm user deletion:');
  if (confirmation !== 'DELETE') return;
  
  try {
    const response = await fetch('/admin/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    
    if (response.ok) {
      location.reload();
    } else {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete user');
    }
  } catch (error) {
    console.error('Delete user error:', error);
    alert(error.message);
  }
}

// View user lists
async function viewUserLists(userId) {
  try {
    const response = await fetch(`/admin/user-lists/${userId}`);
    const lists = await response.json();
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal fixed inset-0 z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
      <div class="modal-content relative z-10 w-full max-w-2xl max-h-[80vh] overflow-auto">
        <div class="bg-gray-900 rounded-lg p-6">
          <h3 class="text-xl font-semibold mb-4">User Lists</h3>
          ${lists.length === 0 ? 
            '<p class="text-gray-500">No lists found</p>' :
            lists.map(list => `
              <div class="mb-4 p-4 bg-gray-800 rounded">
                <h4 class="font-medium mb-2">${escapeHtml(list.name)}</h4>
                <p class="text-sm text-gray-400">${list.data.length} albums</p>
                <div class="mt-2 text-xs text-gray-500">
                  Created: ${new Date(list.createdAt).toLocaleString()}
                </div>
              </div>
            `).join('')
          }
          <button onclick="this.closest('.modal').remove()" class="btn-secondary mt-4">Close</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  } catch (error) {
    console.error('View lists error:', error);
    alert('Failed to load user lists');
  }
}

// Export users
function exportUsers() {
  window.location.href = '/admin/export-users';
}

// Database backup
function downloadBackup() {
  window.location.href = '/admin/backup';
}

// Clear sessions
async function clearAllSessions() {
  if (!confirm('Clear all user sessions? This will log out all users.')) return;
  
  try {
    const response = await fetch('/admin/clear-sessions', {
      method: 'POST'
    });
    
    if (response.ok) {
      const data = await response.json();
      alert(`Cleared ${data.count} sessions`);
    } else {
      throw new Error('Failed to clear sessions');
    }
  } catch (error) {
    console.error('Clear sessions error:', error);
    alert('Failed to clear sessions');
  }
}

// Clean old activity logs
async function cleanLogs() {
  if (!confirm('Remove old activity logs?')) return;

  try {
    const response = await fetch('/admin/clean-logs', { method: 'POST' });

    if (response.ok) {
      const data = await response.json();
      alert(`Removed ${data.removed} log entries`);
    } else {
      throw new Error('Failed to clean logs');
    }
  } catch (error) {
    console.error('Clean logs error:', error);
    alert('Failed to clean logs');
  }
}

// Activity stream
function startActivityStream() {
  const activityContainer = document.getElementById('activity-stream');
  if (!activityContainer) return;
  
  activityStream = new EventSource('/admin/api/admin/activity-stream');
  
  activityStream.onmessage = (event) => {
    const activities = JSON.parse(event.data);
    
    const html = activities.map(activity => `
      <div class="p-3 bg-gray-800 rounded mb-2">
        <div class="flex justify-between items-start">
          <div>
            <span class="font-medium">${activity.action}</span>
            <div class="text-sm text-gray-400 mt-1">
              ${JSON.stringify(activity.details)}
            </div>
          </div>
          <div class="text-xs text-gray-500">
            ${new Date(activity.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>
    `).join('');
    
    activityContainer.innerHTML = html;
  };
  
  activityStream.onerror = () => {
    console.error('Activity stream error');
    setTimeout(startActivityStream, 5000);
  };
}

// Refresh stats
async function refreshStats() {
  try {
    const response = await fetch('/admin/api/stats');
    const stats = await response.json();

    // Update stat cards
    document.getElementById('total-users').textContent = stats.totalUsers;
    if (document.getElementById('new-users')) {
      document.getElementById('new-users').textContent = stats.newUsers7d;
    }
    document.getElementById('total-lists').textContent = stats.totalLists;
    if (document.getElementById('new-lists')) {
      document.getElementById('new-lists').textContent = stats.newLists7d;
    }
    document.getElementById('total-albums').textContent = stats.totalAlbums;
    if (document.getElementById('db-size')) {
      document.getElementById('db-size').textContent = `${stats.dbSizeMB} MB`;
    }
    document.getElementById('active-users').textContent = stats.activeUsers;
    if (document.getElementById('memory-usage')) {
      document.getElementById('memory-usage').textContent = `${stats.memoryUsageMB} MB`;
    }
    if (document.getElementById('system-uptime')) {
      document.getElementById('system-uptime').textContent = stats.systemUptimeHrs;
    }
    if (document.getElementById('cpu-load')) {
      document.getElementById('cpu-load').textContent = stats.loadAvg1;
    }
    if (document.getElementById('node-version')) {
      document.getElementById('node-version').textContent = stats.nodeVersion;
    }
  } catch (error) {
    console.error('Stats refresh error:', error);
  }
}

// User search
function initializeUserSearch() {
  const searchInput = document.getElementById('user-search');
  if (!searchInput) return;
  
  let debounceTimer;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const query = e.target.value.toLowerCase();
      const rows = document.querySelectorAll('#users-table tbody tr');
      
      rows.forEach(row => {
        const searchText = row.textContent.toLowerCase();
        row.style.display = searchText.includes(query) ? '' : 'none';
      });
    }, 300);
  });
}
