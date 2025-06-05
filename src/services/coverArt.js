const https = require('https');
const http = require('http');
const LRU = require('lru-cache');

// Keep connections alive
const httpsAgent = new https.Agent({ keepAlive: true });
const httpAgent = new http.Agent({ keepAlive: true });

const coverCache = new LRU({ max: 200, ttl: 1000 * 60 * 60 * 24 }); // 24h

// iTunes Search API
const searchiTunes = (artist, album) => {
  return new Promise((resolve, reject) => {
    const query = encodeURIComponent(`${artist} ${album}`);
    const options = {
      hostname: 'itunes.apple.com',
      path: `/search?term=${query}&entity=album&limit=10`,
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      agent: httpsAgent
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const results = JSON.parse(data);
          if (results.results && results.results.length > 0) {
            // Get the highest resolution artwork
            const artwork = results.results[0].artworkUrl100
              .replace('100x100', '600x600');
            resolve(artwork);
          } else {
            resolve(null);
          }
        } catch (error) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.end();
  });
};

// Deezer API (via proxy)
const searchDeezer = (artist, album) => {
  return new Promise((resolve, reject) => {
    const query = encodeURIComponent(`artist:"${artist}" album:"${album}"`);
    const options = {
      hostname: 'api.deezer.com',
      path: `/search/album?q=${query}&limit=1`,
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      agent: httpsAgent
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const results = JSON.parse(data);
          if (results.data && results.data.length > 0) {
            resolve(results.data[0].cover_xl || results.data[0].cover_big);
          } else {
            resolve(null);
          }
        } catch (error) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.end();
  });
};

// Cover Art Archive
const searchCoverArtArchive = (mbid) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'coverartarchive.org',
      path: `/release-group/${mbid}`,
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      agent: httpAgent
    };

    const req = http.request(options, (res) => {
      if (res.statusCode === 307 || res.statusCode === 302) {
        // Follow redirect
        resolve(res.headers.location);
        return;
      }

      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const results = JSON.parse(data);
          if (results.images && results.images.length > 0) {
            const front = results.images.find(img => img.front) || results.images[0];
            resolve(front.image || front.thumbnails.large);
          } else {
            resolve(null);
          }
        } catch (error) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.end();
  });
};

// Main function with fallback
const fetchCoverArt = async (artist, album, mbid = null) => {
  const cacheKey = mbid || `${artist}|${album}`;
  if (coverCache.has(cacheKey)) {
    return coverCache.get(cacheKey);
  }

  // Query iTunes and Deezer in parallel
  const [itunes, deezer] = await Promise.all([
    searchiTunes(artist, album),
    searchDeezer(artist, album)
  ]);

  let coverUrl = itunes || deezer || null;

  if (!coverUrl && mbid) {
    coverUrl = await searchCoverArtArchive(mbid);
  }

  if (coverUrl) {
    coverCache.set(cacheKey, coverUrl);
  }

  return coverUrl;
};

module.exports = {
  fetchCoverArt
};