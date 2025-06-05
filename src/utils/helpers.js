const fs = require('fs');
const path = require('path');

// Load reference data
const loadReferenceData = (filename) => {
  try {
    const filePath = path.join(__dirname, '../../', filename);
    const data = fs.readFileSync(filePath, 'utf8');
    return data.split('\n').filter(line => line.trim());
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
    return [];
  }
};

const countries = loadReferenceData('countries.txt');
const genres = loadReferenceData('genres.txt');


// Rate limiting helper
const rateLimiters = new Map();

const checkRateLimit = (key, maxAttempts, windowMs) => {
  const now = Date.now();
  const limiter = rateLimiters.get(key) || { attempts: [], windowStart: now };
  
  // Remove old attempts
  limiter.attempts = limiter.attempts.filter(time => now - time < windowMs);
  
  if (limiter.attempts.length >= maxAttempts) {
    return false;
  }
  
  limiter.attempts.push(now);
  rateLimiters.set(key, limiter);
  return true;
};

module.exports = {
  countries,
  genres,
  checkRateLimit
};