const https = require('https');

// Keep connections alive
const httpsAgent = new https.Agent({ keepAlive: true });


const searchiTunesArtist = (artist) => {
  return new Promise((resolve) => {
    const query = encodeURIComponent(artist);
    const options = {
      hostname: 'itunes.apple.com',
      path: `/search?term=${query}&entity=musicArtist&limit=1`,
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
            const result = results.results[0];
            const image = result.artworkUrl100
              ? result.artworkUrl100.replace('100x100', '600x600')
              : null;
            resolve(image);
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

const searchDeezerArtist = (artist) => {
  return new Promise((resolve) => {
    const query = encodeURIComponent(artist);
    const options = {
      hostname: 'api.deezer.com',
      path: `/search/artist?q=${query}&limit=1`,
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
            resolve(results.data[0].picture_big || results.data[0].picture_medium);
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

const fetchArtistImage = async (artist) => {
  // Try iTunes first
  let image = await searchiTunesArtist(artist);

  // Fallback to Deezer search if no image found
  if (!image) {
    image = await searchDeezerArtist(artist);
  }

  return image;
};

module.exports = { fetchArtistImage };
