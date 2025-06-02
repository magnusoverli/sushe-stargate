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

// Format date for display
const formatDate = (dateString) => {
  if (!dateString) return '';
  
  // Handle different date formats
  if (dateString.length === 4) {
    return dateString; // Year only
  } else if (dateString.length === 7) {
    return dateString; // YYYY-MM
  } else {
    const date = new Date(dateString);
    if (isNaN(date)) return dateString;
    return date.toLocaleDateString();
  }
};

// Generate a unique album ID for manual entries
const generateAlbumId = () => {
  return `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Sanitize filename for downloads
const sanitizeFilename = (filename) => {
  return filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
};

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
  formatDate,
  generateAlbumId,
  sanitizeFilename,
  checkRateLimit
};