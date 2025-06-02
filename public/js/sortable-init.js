// SortableJS initialization for mobile
document.addEventListener('DOMContentLoaded', () => {
  if (window.innerWidth < 1024) {
    initializeMobileSortable();
  }
});

function initializeMobileSortable() {
  const container = document.getElementById('album-container');
  if (!container || !window.Sortable) return;
  
  // Mobile-specific sortable configuration
  new Sortable(container, {
    animation: 150,
    handle: '.drag-handle',
    delay: 100,
    delayOnTouchOnly: true,
    touchStartThreshold: 0,
    forceFallback: true,
    fallbackClass: 'sortable-drag',
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    dragClass: 'sortable-drag',
    
    onStart: function(evt) {
      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
    },
    
    onEnd: async function(evt) {
      if (evt.oldIndex !== evt.newIndex) {
        // Update data order
        const albums = [...app.lists[app.currentList].data];
        const [movedAlbum] = albums.splice(evt.oldIndex, 1);
        albums.splice(evt.newIndex, 0, movedAlbum);
        
        app.lists[app.currentList].data = albums;
        
        // Save to server
        await saveCurrentList();
        
        // Haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate(20);
        }
      }
    }
  });
}