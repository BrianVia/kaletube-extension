# KaleTube Code Review Tasks

## High Priority

### 1. Remove unused Anthropic dependency
**Location:** `package.json:11-13`

The `@anthropic-ai/sdk` package is installed but the extension uses Gemini API. Remove this unused dependency.

```json
// Remove this:
"dependencies": {
  "@anthropic-ai/sdk": "^0.36.3"
}
```

---

### 2. Improve performance with parallel API calls
**Location:** `content.js:262-286`

Each video is processed sequentially with `await`, causing significant delay with 20+ videos. Implement parallel processing with rate limiting:

```javascript
// Process in batches of 5
const batchSize = 5;
for (let i = 0; i < videoElements.length; i += batchSize) {
  const batch = videoElements.slice(i, i + batchSize);
  await Promise.all(batch.map(async (element) => {
    if (isSponsoredContent(element)) {
      hideVideo(element);
      return;
    }

    const videoInfo = getVideoInfo(element);
    if (!videoInfo.title || videoInfo.title === "Unknown Video") {
      return;
    }

    try {
      const isQualifying = await checkVideoContent(videoInfo);
      if (!isQualifying) {
        hideVideo(element);
      }
    } catch (error) {
      console.error("Error checking video content:", error);
    }
  }));
}
```

---

### 3. Add caching for checked videos
**Location:** `content.js`

If a user scrolls up and down, the same videos get re-checked via API. Add a cache to avoid redundant API calls:

```javascript
const checkedVideos = new Map(); // title -> isQualifying

async function checkVideoContent(videoInfo) {
  const cacheKey = videoInfo.title;

  if (checkedVideos.has(cacheKey)) {
    console.log("Cache hit for:", videoInfo.title);
    return checkedVideos.get(cacheKey);
  }

  // ... existing API call logic

  checkedVideos.set(cacheKey, result);
  return result;
}
```

---

### 4. Replace hard 3-second wait with dynamic waiting
**Location:** `content.js:214`

The hard-coded 3-second wait is inefficient. Wait for actual content to load instead:

```javascript
async function waitForVideos(timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const videos = document.querySelectorAll(
      'ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer'
    );
    if (videos.length > 0) return;
    await new Promise(r => setTimeout(r, 200));
  }
}

// Replace: await new Promise((resolve) => setTimeout(resolve, 3000));
// With: await waitForVideos();
```

---

## Medium Priority

### 5. Fix potential XSS vulnerability in notice creation
**Location:** `content.js:27-32`

Using `innerHTML` is a security risk. Use DOM methods instead:

```javascript
function showApiKeyNotice() {
  if (document.getElementById('kaletube-api-notice')) {
    return;
  }

  const notice = document.createElement('div');
  notice.id = 'kaletube-api-notice';
  notice.style.cssText = `...`;

  const title = document.createElement('h3');
  title.style.cssText = 'margin: 0 0 10px 0; font-size: 16px;';
  title.textContent = 'KaleTube API Key Required';

  const message = document.createElement('p');
  message.style.cssText = 'margin: 0 0 10px 0; font-size: 14px;';
  message.textContent = 'Please configure your Gemini API key in the extension settings.';

  const configButton = document.createElement('button');
  configButton.id = 'kaletube-open-options';
  configButton.style.cssText = 'background: white; color: #4CAF50; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-weight: bold;';
  configButton.textContent = 'Configure Now';
  configButton.addEventListener('click', () => chrome.runtime.openOptionsPage());

  const closeButton = document.createElement('button');
  closeButton.id = 'kaletube-close-notice';
  closeButton.style.cssText = 'background: transparent; color: white; border: none; padding: 5px 10px; cursor: pointer; position: absolute; top: 5px; right: 5px;';
  closeButton.textContent = '✕';
  closeButton.addEventListener('click', () => notice.remove());

  notice.appendChild(title);
  notice.appendChild(message);
  notice.appendChild(configButton);
  notice.appendChild(closeButton);
  document.body.appendChild(notice);
}
```

---

### 6. Extract duplicate ad selectors to constant (DRY)
**Location:** `content.js:217-224` and `content.js:306-313`

The same selectors appear in two places. Extract to a constant at the top of the file:

```javascript
const AD_SELECTORS = [
  "ytd-in-feed-ad-layout-renderer",
  "ytd-display-ad-renderer",
  "ytd-promoted-video-renderer",
  "ytd-promoted-sparkles-web-renderer",
  "ytd-ad-slot-renderer",
  "div#rendering-content"
];

// Then use AD_SELECTORS in both processYouTubePage() and monitorForAds()
```

---

### 7. Fix status element visibility bug
**Location:** `options.js:69-83`

The status element is hidden after 3 seconds but never shown again on subsequent calls. Fix the `showStatus` function:

```javascript
function showStatus(message, type) {
  statusElement.style.display = 'block'; // Add this line
  statusElement.textContent = message;
  statusElement.className = 'status';

  if (type === 'success') {
    statusElement.classList.add('success');
  } else if (type === 'error') {
    statusElement.classList.add('error');
  }

  setTimeout(() => {
    statusElement.style.display = 'none';
  }, 3000);
}
```

---

### 8. Remove unused `tags` parameter or implement it
**Location:** `background.js:148`, `content.js:142`

The `tags` array is extracted and passed through the entire flow but is always empty. Either:

**Option A:** Remove tags from the flow
```javascript
// In content.js getVideoInfo():
return { title, creator, description };

// In background.js callGeminiAPI():
async function callGeminiAPI(videoTitle, videoDescription, videoCreator) {
  // Remove videoTags parameter
}
```

**Option B:** Implement tag extraction (tags are typically only available on video watch pages, not listings)

---

### 9. Add rate limit handling for API calls
**Location:** `background.js:101-103`

Add specific handling for 429 (rate limit) errors with exponential backoff:

```javascript
async function callGeminiAPI(videoTitle, videoDescription, videoTags, videoCreator, retryCount = 0) {
  const MAX_RETRIES = 3;

  try {
    // ... existing code ...

    if (!response.ok) {
      if (response.status === 429 && retryCount < MAX_RETRIES) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        console.log(`Rate limited. Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        return callGeminiAPI(videoTitle, videoDescription, videoTags, videoCreator, retryCount + 1);
      }
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    // ... rest of function ...
  } catch (error) {
    // ... existing error handling ...
  }
}
```

---

## Low Priority

### 10. Remove unused `scripting` permission
**Location:** `manifest.json:11`

The `scripting` permission is declared but `chrome.scripting` API is never used. Remove it:

```json
"permissions": ["activeTab", "storage"]
```

---

### 11. Process new videos from infinite scroll
**Location:** `content.js:291-335`

The `monitorForAds()` function catches new ads but doesn't process new videos loaded via infinite scroll. Extend the observer:

```javascript
function monitorForContent() {
  const observer = new MutationObserver((mutations) => {
    let newVideosFound = false;

    mutations.forEach((mutation) => {
      if (mutation.addedNodes && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Handle ads (existing logic)
            if (isSponsoredContent(node)) {
              hideVideo(node);
            }

            // Check if this is a new video element
            if (node.matches && (
              node.matches('ytd-rich-item-renderer') ||
              node.matches('ytd-video-renderer') ||
              node.matches('ytd-grid-video-renderer')
            )) {
              newVideosFound = true;
              processVideoElement(node); // New function to process single video
            }
          }
        });
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
```

---

### 12. Add error handling for storage operations
**Location:** `options.js:52-59`

Check for errors after storage operations:

```javascript
chrome.storage.sync.set({ geminiApiKey: apiKey }, () => {
  if (chrome.runtime.lastError) {
    showStatus('Failed to save API key: ' + chrome.runtime.lastError.message, 'error');
    return;
  }

  showStatus('API key saved successfully!', 'success');
  apiKeyInput.value = '';
  const lastFour = apiKey.slice(-4);
  apiKeyInput.placeholder = `**** **** **** ${lastFour}`;
});
```

---

### 13. Add `run_at` to content script configuration
**Location:** `manifest.json:16-20`

Add `run_at: "document_idle"` for more predictable loading behavior:

```json
"content_scripts": [
  {
    "matches": ["https://www.youtube.com/*"],
    "js": ["content.js"],
    "run_at": "document_idle"
  }
]
```

---

## Summary

| Priority | Count | Description |
|----------|-------|-------------|
| High | 4 | Performance, caching, unused deps |
| Medium | 5 | Security, DRY, bug fixes |
| Low | 4 | Cleanup, enhancements |

### Recommended Order of Implementation

1. Remove unused Anthropic dependency (quick win)
2. Add video caching (biggest UX improvement)
3. Implement parallel processing (performance)
4. Replace hard wait with dynamic waiting (performance)
5. Fix status element visibility bug (bug fix)
6. Extract ad selectors constant (code quality)
7. Add rate limit handling (reliability)
8. Fix XSS vulnerability (security)
9. Remaining low-priority items
