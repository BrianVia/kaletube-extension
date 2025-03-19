// options.js

// Get DOM elements
const apiKeyInput = document.getElementById('apiKey');
const saveButton = document.getElementById('saveButton');
const statusElement = document.getElementById('status');

// Load saved API key on page load
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get('geminiApiKey', (data) => {
    if (data.geminiApiKey) {
      // Show masked API key for security
      const lastFour = data.geminiApiKey.slice(-4);
      apiKeyInput.placeholder = `**** **** **** ${lastFour}`;
      
      // Display success message
      showStatus('API key is configured', 'success');
      
      // Focus on input when clicking the placeholder
      apiKeyInput.addEventListener('focus', () => {
        if (apiKeyInput.value === '') {
          apiKeyInput.placeholder = 'Enter your Gemini API key';
        }
      });
      
      // Restore placeholder when blurring empty input
      apiKeyInput.addEventListener('blur', () => {
        if (apiKeyInput.value === '') {
          apiKeyInput.placeholder = `**** **** **** ${lastFour}`;
        }
      });
    }
  });
});

// Save API key on button click
saveButton.addEventListener('click', () => {
  const apiKey = apiKeyInput.value.trim();
  
  if (!apiKey) {
    showStatus('Please enter an API key', 'error');
    return;
  }
  
  // Basic validation for API key format
  if (!validateApiKey(apiKey)) {
    showStatus('Invalid API key format. Please check your key.', 'error');
    return;
  }
  
  // Save API key to Chrome storage
  chrome.storage.sync.set({ geminiApiKey: apiKey }, () => {
    showStatus('API key saved successfully!', 'success');
    
    // Mask input field after saving
    apiKeyInput.value = '';
    const lastFour = apiKey.slice(-4);
    apiKeyInput.placeholder = `**** **** **** ${lastFour}`;
  });
});

// Simple validation for Gemini API key format
function validateApiKey(key) {
  // Gemini API keys are typically prefixed with "AIza" and are 39 characters long
  // This is a basic check that can be updated if the format changes
  return key.startsWith('AIza') && key.length >= 39;
}

// Show status message
function showStatus(message, type) {
  statusElement.textContent = message;
  statusElement.className = 'status';
  
  if (type === 'success') {
    statusElement.classList.add('success');
  } else if (type === 'error') {
    statusElement.classList.add('error');
  }
  
  // Hide status after 3 seconds
  setTimeout(() => {
    statusElement.style.display = 'none';
  }, 3000);
}