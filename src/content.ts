import type { VideoInfo, CheckVideoResponse, TimeRules, StorageData } from './types';

console.log('🚀 Content script loaded');

// Cache for checked videos to avoid redundant API calls
const checkedVideos = new Map<string, boolean>();

// Global extension enabled state
let extensionEnabled = true;

// Whitelist and blocklist data (loaded from storage)
let whitelist: string[] = [];
let blocklist: string[] = [];
let timeRules: TimeRules = {
  enabled: false,
  startTime: '09:00',
  endTime: '17:00',
  blockSaturday: false,
  blockSunday: false,
};

// Load extension state, whitelist, blocklist, and time rules from storage
chrome.storage.sync.get(
  ['extensionEnabled', 'whitelist', 'blocklist', 'timeRules'],
  (data: StorageData) => {
    // Default to enabled if not set
    extensionEnabled = data.extensionEnabled !== false;
    whitelist = data.whitelist || [];
    blocklist = data.blocklist || [];
    timeRules = data.timeRules || timeRules;
    console.log('🔌 Extension enabled:', extensionEnabled);
    console.log('📋 Loaded whitelist:', whitelist);
    console.log('📋 Loaded blocklist:', blocklist);
    console.log('⏰ Loaded time rules:', timeRules);
  }
);

// Listen for changes to extension state, whitelist, blocklist, and time rules
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.extensionEnabled) {
      extensionEnabled = (changes.extensionEnabled.newValue as boolean) !== false;
      console.log('🔌 Extension enabled changed:', extensionEnabled);
    }
    if (changes.whitelist) {
      whitelist = (changes.whitelist.newValue as string[]) || [];
      console.log('📋 Whitelist updated:', whitelist);
    }
    if (changes.blocklist) {
      blocklist = (changes.blocklist.newValue as string[]) || [];
      console.log('📋 Blocklist updated:', blocklist);
    }
    if (changes.timeRules) {
      timeRules = (changes.timeRules.newValue as TimeRules) || timeRules;
      console.log('⏰ Time rules updated:', timeRules);
    }
  }
});

// Ad selectors to identify sponsored content
const AD_SELECTORS = [
  'ytd-in-feed-ad-layout-renderer',
  'ytd-display-ad-renderer',
  'ytd-promoted-video-renderer',
  'ytd-promoted-sparkles-web-renderer',
  'ytd-ad-slot-renderer',
  'div#rendering-content',
];

// Function to show API key notice
function showApiKeyNotice(): void {
  if (document.getElementById('kaletube-api-notice')) {
    return; // Notice already shown
  }

  const notice = document.createElement('div');
  notice.id = 'kaletube-api-notice';
  notice.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: #4CAF50;
    color: white;
    padding: 15px;
    border-radius: 5px;
    z-index: 10000;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    font-family: Arial, sans-serif;
    max-width: 300px;
  `;

  const title = document.createElement('h3');
  title.style.cssText = 'margin: 0 0 10px 0; font-size: 16px;';
  title.textContent = 'KaleTube API Key Required';

  const message = document.createElement('p');
  message.style.cssText = 'margin: 0 0 10px 0; font-size: 14px;';
  message.textContent = 'Please configure your Gemini API key in the extension settings.';

  const configButton = document.createElement('button');
  configButton.id = 'kaletube-open-options';
  configButton.style.cssText =
    'background: white; color: #4CAF50; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-weight: bold;';
  configButton.textContent = 'Configure Now';
  configButton.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  const closeButton = document.createElement('button');
  closeButton.id = 'kaletube-close-notice';
  closeButton.style.cssText =
    'background: transparent; color: white; border: none; padding: 5px 10px; cursor: pointer; position: absolute; top: 5px; right: 5px;';
  closeButton.textContent = '✕';
  closeButton.addEventListener('click', () => {
    notice.remove();
  });

  notice.appendChild(title);
  notice.appendChild(message);
  notice.appendChild(configButton);
  notice.appendChild(closeButton);
  document.body.appendChild(notice);
}

// Function to detect sponsored content
function isSponsoredContent(element: Element): boolean {
  try {
    // Check for sponsored content indicators
    const adBadgeElements = element.querySelectorAll(
      'badge-shape-wiz--ad, .badge-shape-wiz--ads-include-dot, .ytwAdBadgeViewModelHost'
    );
    const adTextElements = element.querySelectorAll('[title="Sponsored"]');

    // Check for text content separately since :contains() isn't valid CSS
    const allSpans = element.querySelectorAll('span');
    const allDivs = element.querySelectorAll('div');
    const sponsoredSpans = Array.from(allSpans).filter((span) =>
      span.textContent?.includes('Sponsored')
    );
    const sponsoredDivs = Array.from(allDivs).filter(
      (div) => div.textContent?.includes('Sponsored') || div.textContent?.includes('Ad')
    );

    const adRenderingElements = element.querySelectorAll(
      'ytd-in-feed-ad-layout-renderer, div#rendering-content'
    );

    // Check if there's any ad-related metadata
    const hasAdMetadata = element.querySelector('.ytwFeedAdMetadataViewModelHost') !== null;

    return (
      adBadgeElements.length > 0 ||
      adTextElements.length > 0 ||
      sponsoredSpans.length > 0 ||
      sponsoredDivs.length > 0 ||
      adRenderingElements.length > 0 ||
      hasAdMetadata ||
      (element.textContent?.includes('Sponsored') ?? false) ||
      element.innerHTML.includes('ytd-in-feed-ad')
    );
  } catch (error) {
    console.warn('⚠️ Error checking for sponsored content:', error);
    return false;
  }
}

// Function to extract video information
function getVideoInfo(element: Element): VideoInfo {
  try {
    // Extract video title - try new YouTube layout first, then legacy
    const titleSelectors = [
      // New yt-lockup-view-model layout (2024+)
      'h3.yt-lockup-metadata-view-model__heading-reset',
      '.yt-lockup-metadata-view-model__title',
      'span.yt-core-attributed-string[role="text"]',
      // Legacy ytd layout
      '#video-title',
      'a#video-title-link',
      'a.yt-simple-endpoint',
      'h3 a.yt-simple-endpoint',
      '.title-wrapper',
      '.ytd-rich-grid-media',
      'h4.ytd-compact-video-renderer',
    ];

    let titleElement: Element | null = null;
    for (const selector of titleSelectors) {
      try {
        const foundElement = element.querySelector(selector);
        if (foundElement) {
          titleElement = foundElement;
          break;
        }
      } catch (selectorError) {
        console.warn(`⚠️ Error with selector ${selector}:`, selectorError);
      }
    }

    if (!titleElement) {
      console.warn('⚠️ Could not find title element, returning default');
      return { title: 'Unknown Video', creator: 'Unknown Creator', description: '' };
    }

    // Get either title attribute (preferred for new layout) or text content
    const title =
      titleElement.getAttribute('title')?.trim() ||
      titleElement.textContent?.trim() ||
      'Unknown Video';

    // Extract video creator - try new layout first, then legacy
    let creator = 'Unknown Creator';
    try {
      const creatorSelectors = [
        // New yt-lockup-view-model layout - channel links
        'a.yt-core-attributed-string__link[href^="/channel/"]',
        'a.yt-core-attributed-string__link[href^="/@"]',
        // Legacy ytd layout
        'ytd-channel-name #text a',
        'yt-formatted-string a[href^="/@"]',
        'yt-formatted-string a[href^="/channel/"]',
      ];

      for (const selector of creatorSelectors) {
        const creatorElement = element.querySelector(selector);
        if (creatorElement) {
          // For new layout, get just the first text node (creator name without badge)
          const firstChild = creatorElement.firstChild;
          if (firstChild && firstChild.nodeType === Node.TEXT_NODE) {
            creator = firstChild.textContent?.trim() || 'Unknown Creator';
          } else {
            creator = creatorElement.textContent?.trim() || 'Unknown Creator';
          }
          break;
        }
      }
    } catch (error) {
      console.warn('⚠️ Error getting video creator:', error);
    }

    // Extract description (if available)
    let description = '';
    try {
      const descriptionElement = element.querySelector('#description, #description-text, .description');
      if (descriptionElement) {
        description = descriptionElement.textContent?.trim() || '';
      }
    } catch (error) {
      console.warn('⚠️ Error getting video description:', error);
    }

    console.log('📹 Found video info:', {
      title,
      creator,
      description: description.substring(0, 50) + (description.length > 50 ? '...' : ''),
    });
    return { title, creator, description };
  } catch (error) {
    console.warn('⚠️ Error getting video info:', error);
    return { title: 'Unknown Video', creator: 'Unknown Creator', description: '' };
  }
}

// Function to hide non-qualifying videos by removing them from DOM
// This forces YouTube's grid to reflow and fill gaps
function hideVideo(element: Element): void {
  // Find the outermost video container (the actual grid cell)
  // to ensure proper grid reflow - yt-lockup-view-model is inside ytd-rich-item-renderer
  const gridCell = element.closest(
    'ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer'
  );
  if (gridCell) {
    console.log('🚫 Removing video container from grid');
    gridCell.remove();
  } else {
    // Fallback: remove the element itself
    console.log('🚫 Removing video element directly');
    element.remove();
  }
}

// Helper function to check if current time is within work hours
function isWithinWorkHours(): boolean {
  if (!timeRules.enabled) {
    return false;
  }

  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
  const currentTime = now.getHours() * 60 + now.getMinutes(); // minutes since midnight

  // Check weekend blocking
  if (currentDay === 6 && timeRules.blockSaturday) {
    return true; // All day Saturday is work hours if enabled
  }
  if (currentDay === 0 && timeRules.blockSunday) {
    return true; // All day Sunday is work hours if enabled
  }

  // Parse start and end times
  const [startHour, startMin] = timeRules.startTime.split(':').map(Number);
  const [endHour, endMin] = timeRules.endTime.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  // Check if current time is within work hours
  return currentTime >= startMinutes && currentTime < endMinutes;
}

// Helper function to check if creator is whitelisted
function isWhitelisted(creator: string): boolean {
  if (!creator || creator === 'Unknown Creator') {
    return false;
  }
  return whitelist.some(
    (whitelisted) =>
      creator.toLowerCase().includes(whitelisted.toLowerCase()) ||
      whitelisted.toLowerCase().includes(creator.toLowerCase())
  );
}

// Helper function to check if creator is blocklisted
function isBlocklisted(creator: string): boolean {
  if (!creator || creator === 'Unknown Creator') {
    return false;
  }
  return blocklist.some(
    (blocked) =>
      creator.toLowerCase().includes(blocked.toLowerCase()) ||
      blocked.toLowerCase().includes(creator.toLowerCase())
  );
}

// Function to process a single video element
async function processVideoElement(element: Element): Promise<void> {
  // First, check if this is sponsored content (always hide ads, even if extension is disabled)
  if (isSponsoredContent(element)) {
    console.log('🛑 Found sponsored content - hiding automatically');
    hideVideo(element);
    return;
  }

  // If extension is disabled, show all content (except ads which were handled above)
  if (!extensionEnabled) {
    console.log('🔌 Extension disabled - showing all content');
    return;
  }

  const videoInfo = getVideoInfo(element);
  if (!videoInfo.title || videoInfo.title === 'Unknown Video') {
    console.log('⚠️ Skipping element due to missing title');
    return;
  }

  const creator = videoInfo.creator;

  // Check whitelist first - always show whitelisted creators
  if (isWhitelisted(creator)) {
    console.log(`✅ Whitelisted creator: ${creator} - always showing`);
    return;
  }

  // Determine if we should apply filtering
  // If time rules are enabled, only filter during work hours
  // If time rules are disabled, always filter (extension is globally on)
  const inWorkHours = isWithinWorkHours();
  const shouldFilter = timeRules.enabled ? inWorkHours : true;

  // If blocklisted and filtering is active, hide immediately
  if (isBlocklisted(creator) && shouldFilter) {
    console.log(`🚫 Blocklisted creator: ${creator} - hiding`);
    hideVideo(element);
    return;
  }

  // If blocklisted but filtering is NOT active, show
  if (isBlocklisted(creator) && !shouldFilter) {
    console.log(`👀 Blocklisted creator outside work hours: ${creator} - showing`);
    return;
  }

  // If filtering is NOT active, show everything (skip LLM validation)
  if (!shouldFilter) {
    console.log(`🌙 Outside work hours - showing without LLM check: ${videoInfo.title}`);
    return;
  }

  // If we're here: filtering is active, not whitelisted, not blocklisted
  // Run LLM validation
  try {
    console.log('🔍 Processing video:', videoInfo.title);
    const isQualifying = await checkVideoContent(videoInfo);
    console.log(
      `🔍 AI check result for video "${videoInfo.title}": ${isQualifying ? 'Educational' : 'Not educational'}`
    );
    if (!isQualifying) {
      hideVideo(element);
    }
  } catch (error) {
    console.error('❌ Error checking video content:', error);
  }
}

// Function to wait for videos to load dynamically
// Video container selectors - both new (yt-lockup) and legacy (ytd) layouts
const VIDEO_SELECTORS =
  'yt-lockup-view-model, ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer';

async function waitForVideos(timeout = 10000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const videos = document.querySelectorAll(VIDEO_SELECTORS);
    if (videos.length > 0) {
      console.log('✅ Videos loaded, found:', videos.length);
      return;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log('⚠️ Timeout waiting for videos');
}

// Function to check video content with AI via background script
function checkVideoContent(videoInfo: VideoInfo): Promise<boolean> {
  const cacheKey = videoInfo.title;

  // Check cache first
  if (checkedVideos.has(cacheKey)) {
    console.log('💾 Cache hit for:', videoInfo.title);
    return Promise.resolve(checkedVideos.get(cacheKey)!);
  }

  console.log('🤖 Checking video content for:', videoInfo.title);
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(
        {
          action: 'checkVideo',
          videoInfo: {
            title: videoInfo.title.trim(),
            description: videoInfo.description || '',
            creator: videoInfo.creator || 'Unknown Creator',
          },
        },
        (response: CheckVideoResponse) => {
          if (chrome.runtime.lastError) {
            console.error('❌ Runtime error:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError.message);
            return;
          }

          if (!response) {
            console.error('❌ No response received from background script');
            reject('No response received');
            return;
          }

          if (response.error) {
            console.error('❌ Error from AI check:', response.error);

            // Check if API key is missing
            if (response.needsApiKey) {
              // Show notice to the user about missing API key
              showApiKeyNotice();
            }

            reject(response.error);
          } else {
            console.log(
              '✅ AI check result:',
              response.isQualifying ? 'Qualified' : 'Not qualified'
            );
            // Cache the result
            checkedVideos.set(cacheKey, response.isQualifying!);
            resolve(response.isQualifying!);
          }
        }
      );
    } catch (error) {
      console.error('❌ Error sending message:', error);
      reject(error);
    }
  });
}

// Function to check if we're on a search results page
function isSearchPage(): boolean {
  return window.location.pathname === '/results' ||
         window.location.href.includes('search_query=');
}

// Main function to process YouTube page
async function processYouTubePage(): Promise<void> {
  console.log('🎬 Starting to process YouTube page');

  // Skip filtering on search results pages - user is actively searching
  if (isSearchPage()) {
    console.log('🔍 On search page - skipping content filtering');
    return;
  }

  // Wait for videos to load dynamically
  await waitForVideos();

  // First, specifically look for and hide sponsored content
  for (const selector of AD_SELECTORS) {
    const adElements = document.querySelectorAll(selector);
    if (adElements.length > 0) {
      console.log(`🛑 Found ${adElements.length} sponsored elements with selector ${selector}`);
      adElements.forEach((element) => {
        console.log('🛑 Hiding sponsored content');
        hideVideo(element);
      });
    }
  }

  // Get all video elements using consolidated selectors (new + legacy layouts)
  const videoElements = Array.from(document.querySelectorAll(VIDEO_SELECTORS));

  console.log(`📋 Total: ${videoElements.length} videos to process`);

  if (videoElements.length === 0) {
    console.log('⚠️ No video elements found. DOM might not be ready.');
    return;
  }

  // Process videos in batches of 5 for better performance
  const batchSize = 5;
  for (let i = 0; i < videoElements.length; i += batchSize) {
    const batch = videoElements.slice(i, i + batchSize);
    await Promise.all(batch.map((element) => processVideoElement(element)));
  }
  console.log('✨ Finished processing YouTube page');
}

// Function to continuously monitor for newly added content (ads and videos)
function monitorForContent(): void {
  // Create a mutation observer to detect DOM changes
  const observer = new MutationObserver((mutations) => {
    // Skip video filtering on search pages (but still block ads)
    const onSearchPage = isSearchPage();

    mutations.forEach((mutation) => {
      if (mutation.addedNodes && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => {
          // Check if the added node is an Element
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;

            // Always check for sponsored content (even on search pages)
            if (isSponsoredContent(element)) {
              console.log('🛑 Found dynamically added sponsored content - hiding');
              hideVideo(element);
            }

            // Also check for potential ad elements inside the added node
            AD_SELECTORS.forEach((selector) => {
              const adElements = element.querySelectorAll(selector);
              adElements.forEach((adElement) => {
                console.log(`🛑 Found dynamically added ad (${selector}) - hiding`);
                hideVideo(adElement);
              });
            });

            // Skip video content filtering on search pages
            if (onSearchPage) {
              return;
            }

            // Check if this is a new video element from infinite scroll
            // Add delay to allow YouTube to populate the video data
            // Check both new (yt-lockup) and legacy (ytd) layouts
            const videoSelectorList = VIDEO_SELECTORS.split(', ');
            const isVideoElement =
              element.matches && videoSelectorList.some((sel) => element.matches(sel));

            if (isVideoElement) {
              setTimeout(() => {
                console.log('📹 Found new video from infinite scroll');
                processVideoElement(element);
              }, 500);
            }

            // Also check for video elements inside the added node
            const videoElements = element.querySelectorAll(VIDEO_SELECTORS);
            videoElements.forEach((videoElement) => {
              setTimeout(() => {
                console.log('📹 Found new video inside added node');
                processVideoElement(videoElement);
              }, 500);
            });
          }
        });
      }
    });
  });

  // Start observing the document body for changes
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log('👀 Content monitoring started (ads and videos)');
}

// Run the main function when the page loads
window.addEventListener('load', () => {
  console.log('📄 Page loaded - starting process');
  processYouTubePage();
  monitorForContent(); // Start continuous monitoring for ads and new videos
});

// Also run it when navigating between YouTube pages
window.addEventListener('yt-navigate-finish', () => {
  console.log('🔄 Navigation detected - starting process');
  processYouTubePage();
});
