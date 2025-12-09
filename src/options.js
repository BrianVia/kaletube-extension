// Get DOM elements - API Key
const apiKeyInput = document.getElementById('apiKey');
const saveButton = document.getElementById('saveButton');
const statusElement = document.getElementById('status');
// Get DOM elements - Whitelist/Blocklist
const whitelistInput = document.getElementById('whitelistInput');
const addWhitelistBtn = document.getElementById('addWhitelistBtn');
const whitelistContainer = document.getElementById('whitelistContainer');
const blocklistInput = document.getElementById('blocklistInput');
const addBlocklistBtn = document.getElementById('addBlocklistBtn');
const blocklistContainer = document.getElementById('blocklistContainer');
// Get DOM elements - Time Rules
const enableWorkHours = document.getElementById('enableWorkHours');
const workStartTime = document.getElementById('workStartTime');
const workEndTime = document.getElementById('workEndTime');
const blockSaturday = document.getElementById('blockSaturday');
const blockSunday = document.getElementById('blockSunday');
const saveTimeRules = document.getElementById('saveTimeRules');
const timeStatus = document.getElementById('timeStatus');
// State
let whitelist = [];
let blocklist = [];
// Load saved data on page load
document.addEventListener('DOMContentLoaded', () => {
    // Load API key
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
    // Load whitelist and blocklist
    loadLists();
    // Load time rules
    loadTimeRules();
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
    // Save API key to storage
    chrome.storage.sync.set({ geminiApiKey: apiKey }, () => {
        if (chrome.runtime.lastError) {
            showStatus('Failed to save API key: ' + chrome.runtime.lastError.message, 'error');
            return;
        }
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
    statusElement.style.display = 'block';
    statusElement.textContent = message;
    statusElement.className = 'status';
    if (type === 'success') {
        statusElement.classList.add('success');
    }
    else if (type === 'error') {
        statusElement.classList.add('error');
    }
    // Hide status after 3 seconds
    setTimeout(() => {
        statusElement.style.display = 'none';
    }, 3000);
}
// Show time status message
function showTimeStatus(message, type) {
    timeStatus.style.display = 'block';
    timeStatus.textContent = message;
    timeStatus.className = 'status';
    if (type === 'success') {
        timeStatus.classList.add('success');
    }
    else if (type === 'error') {
        timeStatus.classList.add('error');
    }
    setTimeout(() => {
        timeStatus.style.display = 'none';
    }, 3000);
}
// Load whitelist and blocklist from storage
function loadLists() {
    chrome.storage.sync.get(['whitelist', 'blocklist'], (data) => {
        whitelist = data.whitelist || [];
        blocklist = data.blocklist || [];
        renderWhitelist();
        renderBlocklist();
    });
}
// Render whitelist
function renderWhitelist() {
    whitelistContainer.innerHTML = '';
    if (whitelist.length === 0) {
        whitelistContainer.innerHTML = '<div class="empty-list">No whitelisted creators yet</div>';
        return;
    }
    whitelist.forEach((creator, index) => {
        const item = document.createElement('div');
        item.className = 'list-item';
        const creatorName = document.createElement('span');
        creatorName.textContent = creator;
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', () => removeFromWhitelist(index));
        item.appendChild(creatorName);
        item.appendChild(removeBtn);
        whitelistContainer.appendChild(item);
    });
}
// Render blocklist
function renderBlocklist() {
    blocklistContainer.innerHTML = '';
    if (blocklist.length === 0) {
        blocklistContainer.innerHTML = '<div class="empty-list">No blocklisted creators yet</div>';
        return;
    }
    blocklist.forEach((creator, index) => {
        const item = document.createElement('div');
        item.className = 'list-item';
        const creatorName = document.createElement('span');
        creatorName.textContent = creator;
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', () => removeFromBlocklist(index));
        item.appendChild(creatorName);
        item.appendChild(removeBtn);
        blocklistContainer.appendChild(item);
    });
}
// Add to whitelist
addWhitelistBtn.addEventListener('click', () => {
    const creator = whitelistInput.value.trim();
    if (!creator) {
        return;
    }
    if (whitelist.includes(creator)) {
        alert('This creator is already in the whitelist');
        return;
    }
    whitelist.push(creator);
    saveWhitelist();
    whitelistInput.value = '';
});
// Add to blocklist
addBlocklistBtn.addEventListener('click', () => {
    const creator = blocklistInput.value.trim();
    if (!creator) {
        return;
    }
    if (blocklist.includes(creator)) {
        alert('This creator is already in the blocklist');
        return;
    }
    blocklist.push(creator);
    saveBlocklist();
    blocklistInput.value = '';
});
// Remove from whitelist
function removeFromWhitelist(index) {
    whitelist.splice(index, 1);
    saveWhitelist();
}
// Remove from blocklist
function removeFromBlocklist(index) {
    blocklist.splice(index, 1);
    saveBlocklist();
}
// Save whitelist to storage
function saveWhitelist() {
    chrome.storage.sync.set({ whitelist }, () => {
        if (chrome.runtime.lastError) {
            alert('Failed to save whitelist: ' + chrome.runtime.lastError.message);
            return;
        }
        renderWhitelist();
    });
}
// Save blocklist to storage
function saveBlocklist() {
    chrome.storage.sync.set({ blocklist }, () => {
        if (chrome.runtime.lastError) {
            alert('Failed to save blocklist: ' + chrome.runtime.lastError.message);
            return;
        }
        renderBlocklist();
    });
}
// Load time rules from storage
function loadTimeRules() {
    chrome.storage.sync.get(['timeRules'], (data) => {
        const rules = data.timeRules || {
            enabled: false,
            startTime: '09:00',
            endTime: '17:00',
            blockSaturday: false,
            blockSunday: false,
        };
        enableWorkHours.checked = rules.enabled;
        workStartTime.value = rules.startTime;
        workEndTime.value = rules.endTime;
        blockSaturday.checked = rules.blockSaturday;
        blockSunday.checked = rules.blockSunday;
    });
}
// Save time rules
saveTimeRules.addEventListener('click', () => {
    const rules = {
        enabled: enableWorkHours.checked,
        startTime: workStartTime.value,
        endTime: workEndTime.value,
        blockSaturday: blockSaturday.checked,
        blockSunday: blockSunday.checked,
    };
    chrome.storage.sync.set({ timeRules: rules }, () => {
        if (chrome.runtime.lastError) {
            showTimeStatus('Failed to save time rules: ' + chrome.runtime.lastError.message, 'error');
            return;
        }
        showTimeStatus('Time rules saved successfully!', 'success');
    });
});
// Allow Enter key to add items
whitelistInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addWhitelistBtn.click();
    }
});
blocklistInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addBlocklistBtn.click();
    }
});
export {};
