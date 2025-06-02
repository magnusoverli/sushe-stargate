const crypto = require('crypto');

let currentCode = null;
let codeGeneratedAt = null;
const CODE_LIFETIME = 5 * 60 * 1000; // 5 minutes

const generateAdminCode = () => {
  const now = Date.now();
  
  // Check if we need a new code
  if (!currentCode || !codeGeneratedAt || (now - codeGeneratedAt) >= CODE_LIFETIME) {
    currentCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    codeGeneratedAt = now;
    
    // Display the code in console
    console.log('\n' + '='.repeat(50));
    console.log('ADMIN ACCESS CODE (Valid for 5 minutes):');
    console.log(`\n    ${currentCode}\n`);
    console.log('='.repeat(50) + '\n');
  }
  
  return currentCode;
};

const validateAdminCode = (submittedCode) => {
  const now = Date.now();
  
  // Check if code exists and is not expired
  if (!currentCode || !codeGeneratedAt || (now - codeGeneratedAt) >= CODE_LIFETIME) {
    return false;
  }
  
  // Check if code matches (case insensitive)
  const isValid = submittedCode.toUpperCase() === currentCode;
  
  // Regenerate code after successful use
  if (isValid) {
    currentCode = null;
    codeGeneratedAt = null;
  }
  
  return isValid;
};

// Generate initial code on startup
setTimeout(generateAdminCode, 3000);

// Regenerate code every 5 minutes
setInterval(generateAdminCode, CODE_LIFETIME);

module.exports = {
  generateAdminCode,
  validateAdminCode
};