const express = require('express');
const router = express.Router();
const multer = require('multer');
const List = require('../models/List');
const User = require('../models/User');
const { ensureAuthenticated } = require('../middleware/auth');
const { logActivity } = require('../services/activity');
const { searchArtist, searchAlbumsByArtist, searchAlbumsDirect } = require('../services/musicbrainz');
const { fetchCoverArt } = require('../services/coverArt');
const { generateAlbumId } = require('../utils/helpers');

// Get all lists for user
router.get('/lists', ensureAuthenticated, async (req, res) => {
  try {
    const lists = await List.findByUser(req.user._id);
    res.json(lists);
  } catch (error) {
    console.error('Get lists error:', error);
    res.status(500).json({ error: 'Failed to fetch lists' });
  }
});

// Create or update a list
router.post('/lists/:name', ensureAuthenticated, async (req, res) => {
  const { name } = req.params;
  const { data } = req.body;
  
  try {
    const existing = await List.findByUserAndName(req.user._id, name);
    
    if (existing) {
      // Update existing list
      const updated = await List.update(req.user._id, name, data);
      
      await logActivity(req.user._id, 'list_updated', {
        listName: name,
        albumCount: data.length
      }, req);
      
      res.json(updated);
    } else {
      // Create new list
      const newList = await List.create(req.user._id, name);
      
      // If data provided, update it
      if (data && data.length > 0) {
        await List.update(req.user._id, name, data);
      }
      
      await logActivity(req.user._id, 'list_created', {
        listName: name
      }, req);
      
      res.json(newList);
    }
  } catch (error) {
    console.error('Save list error:', error);
    res.status(500).json({ error: 'Failed to save list' });
  }
});

// Delete a list
router.delete('/lists/:name', ensureAuthenticated, async (req, res) => {
  const { name } = req.params;
  
  try {
    await List.delete(req.user._id, name);
    
    await logActivity(req.user._id, 'list_deleted', {
      listName: name
    }, req);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete list error:', error);
    res.status(500).json({ error: 'Failed to delete list' });
  }
});

// Delete all lists
router.delete('/lists', ensureAuthenticated, async (req, res) => {
  try {
    const count = await List.deleteAllByUser(req.user._id);
    
    await logActivity(req.user._id, 'all_lists_deleted', {
      count
    }, req);
    
    res.json({ success: true, count });
  } catch (error) {
    console.error('Delete all lists error:', error);
    res.status(500).json({ error: 'Failed to delete lists' });
  }
});

// Rename a list
router.post('/lists/:oldName/rename', ensureAuthenticated, async (req, res) => {
  const { oldName } = req.params;
  const { newName } = req.body;
  
  try {
    // Check if new name already exists
    const existing = await List.findByUserAndName(req.user._id, newName);
    if (existing) {
      return res.status(400).json({ error: 'A list with that name already exists' });
    }
    
    const updated = await List.rename(req.user._id, oldName, newName);
    
    await logActivity(req.user._id, 'list_renamed', {
      oldName,
      newName
    }, req);
    
    res.json(updated);
  } catch (error) {
    console.error('Rename list error:', error);
    res.status(500).json({ error: 'Failed to rename list' });
  }
});

// Save last selected list
router.post('/user/last-list', ensureAuthenticated, async (req, res) => {
  const { listName } = req.body;
  
  try {
    await User.updateById(req.user._id, { lastSelectedList: listName });
    res.json({ success: true });
  } catch (error) {
    console.error('Save last list error:', error);
    res.status(500).json({ error: 'Failed to save preference' });
  }
});

// Search MusicBrainz
router.get('/search/artist', ensureAuthenticated, async (req, res) => {
  const { query } = req.query;
  
  try {
    await logActivity(req.user._id, 'artist_search', { query }, req);
    
    const artists = await searchArtist(query);
    res.json(artists);
  } catch (error) {
    console.error('Artist search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

router.get('/search/artist/:id/albums', ensureAuthenticated, async (req, res) => {
  const { id } = req.params;
  
  try {
    const albums = await searchAlbumsByArtist(id);
    res.json(albums);
  } catch (error) {
    console.error('Album search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

router.get('/search/album', ensureAuthenticated, async (req, res) => {
  const { query } = req.query;
  
  try {
    await logActivity(req.user._id, 'album_search', { query }, req);
    
    const albums = await searchAlbumsDirect(query);
    res.json(albums);
  } catch (error) {
    console.error('Album search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Fetch cover art
router.post('/cover-art', ensureAuthenticated, async (req, res) => {
  const { artist, album, mbid } = req.body;
  
  try {
    const coverUrl = await fetchCoverArt(artist, album, mbid);
    
    if (coverUrl) {
      res.json({ url: coverUrl });
    } else {
      res.status(404).json({ error: 'Cover art not found' });
    }
  } catch (error) {
    console.error('Cover art fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch cover art' });
  }
});

// Deezer proxy endpoint
router.get('/proxy/deezer', ensureAuthenticated, async (req, res) => {
  const { q } = req.query;
  
  try {
    const https = require('https');
    const options = {
      hostname: 'api.deezer.com',
      path: `/search/album?q=${encodeURIComponent(q)}&limit=1`,
      method: 'GET'
    };
    
    const deezerReq = https.request(options, (deezerRes) => {
      let data = '';
      
      deezerRes.on('data', (chunk) => {
        data += chunk;
      });
      
      deezerRes.on('end', () => {
        res.json(JSON.parse(data));
      });
    });
    
    deezerReq.on('error', (error) => {
      console.error('Deezer proxy error:', error);
      res.status(500).json({ error: 'Proxy request failed' });
    });
    
    deezerReq.end();
  } catch (error) {
    console.error('Deezer proxy error:', error);
    res.status(500).json({ error: 'Proxy request failed' });
  }
});

// Activity logging endpoint for client-side events
router.post('/activity/log', ensureAuthenticated, async (req, res) => {
  const { action, details } = req.body;
  
  try {
    await logActivity(req.user._id, action, details, req);
    res.json({ success: true });
  } catch (error) {
    console.error('Activity log error:', error);
    res.status(500).json({ error: 'Failed to log activity' });
  }
});

module.exports = router;