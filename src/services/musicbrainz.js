const https = require('https');

const USER_AGENT = 'SuShe-Stargate/1.0.0 (https://github.com/yourusername/sushe-stargate)';

const searchMusicBrainz = (query, type = 'release-group') => {
  return new Promise((resolve, reject) => {
    const encodedQuery = encodeURIComponent(query);
    const options = {
      hostname: 'musicbrainz.org',
      path: `/ws/2/${type}/?query=${encodedQuery}&fmt=json&limit=100`,
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const results = JSON.parse(data);
          resolve(results);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
};

const searchArtist = async (artistName) => {
  try {
    const results = await searchMusicBrainz(artistName, 'artist');
    return results.artists || [];
  } catch (error) {
    console.error('MusicBrainz artist search error:', error);
    return [];
  }
};

const searchAlbumsByArtist = async (artistId) => {
  try {
    const query = `arid:${artistId} AND primarytype:album`;
    const results = await searchMusicBrainz(query, 'release-group');
    
    // Filter and sort results
    const albums = (results['release-groups'] || [])
      .filter(rg => {
        const primaryType = rg['primary-type'];
        const secondaryTypes = rg['secondary-types'] || [];
        return (primaryType === 'Album' || primaryType === 'EP') && 
               secondaryTypes.length === 0;
      })
      .sort((a, b) => {
        // Sort by first release date
        const dateA = a['first-release-date'] || '9999';
        const dateB = b['first-release-date'] || '9999';
        return dateA.localeCompare(dateB);
      });
    
    return albums;
  } catch (error) {
    console.error('MusicBrainz album search error:', error);
    return [];
  }
};

const searchAlbumsDirect = async (albumName) => {
  try {
    const results = await searchMusicBrainz(albumName, 'release-group');
    
    // Filter for albums and EPs only
    const albums = (results['release-groups'] || [])
      .filter(rg => {
        const primaryType = rg['primary-type'];
        return primaryType === 'Album' || primaryType === 'EP';
      });
    
    return albums;
  } catch (error) {
    console.error('MusicBrainz direct album search error:', error);
    return [];
  }
};

module.exports = {
  searchArtist,
  searchAlbumsByArtist,
  searchAlbumsDirect
};