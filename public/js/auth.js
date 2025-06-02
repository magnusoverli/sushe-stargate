// Password visibility toggle
document.querySelectorAll('.toggle-password').forEach(button => {
  button.addEventListener('click', () => {
    const input = button.previousElementSibling;
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
      input.type = 'text';
      icon.classList.remove('fa-eye');
      icon.classList.add('fa-eye-slash');
    } else {
      input.type = 'password';
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye');
    }
  });
});

// Form validation
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', (e) => {
    const email = loginForm.email.value;
    const password = loginForm.password.value;
    
    if (!email || !password) {
      e.preventDefault();
      showError('Please fill in all fields');
      return;
    }
    
    // Show loading state
    const button = loginForm.querySelector('button[type="submit"]');
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Logging in...';
  });
}

const registerForm = document.getElementById('register-form');
if (registerForm) {
  registerForm.addEventListener('submit', (e) => {
    const email = registerForm.email.value;
    const username = registerForm.username.value;
    const password = registerForm.password.value;
    const confirmPassword = registerForm.confirmPassword.value;
    
    // Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      e.preventDefault();
      showError('Please enter a valid email address');
      return;
    }
    
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(username)) {
      e.preventDefault();
      showError('Username must be 3-30 characters and contain only letters, numbers, and underscores');
      return;
    }
    
    if (password.length < 8) {
      e.preventDefault();
      showError('Password must be at least 8 characters long');
      return;
    }
    
    if (password !== confirmPassword) {
      e.preventDefault();
      showError('Passwords do not match');
      return;
    }
    
    // Show loading state
    const button = registerForm.querySelector('button[type="submit"]');
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Creating account...';
  });
}

function showError(message) {
  const alert = document.createElement('div');
  alert.className = 'bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-4';
  alert.innerHTML = `
    <div class="flex items-center">
      <i class="fas fa-exclamation-circle mr-2"></i>
      <span>${message}</span>
    </div>
  `;
  
  const form = document.querySelector('form');
  form.parentNode.insertBefore(alert, form);
  
  setTimeout(() => alert.remove(), 5000);
}