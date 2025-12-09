console.log('🚀 Content script loaded');
// Cache for checked videos to avoid redundant API calls
const checkedVideos = new Map();
// Whitelist and blocklist data (loaded from storage)
let whitelist = [];
let blocklist = [];
let timeRules = {
    enabled: false,
    startTime: '09:00',
    endTime: '17:00',
    blockSaturday: false,
    blockSunday: false,
};
// Load whitelist, blocklist, and time rules from storage
chrome.storage.sync.get(['whitelist', 'blocklist', 'timeRules'], (data) => {
    whitelist = data.whitelist || [];
    blocklist = data.blocklist || [];
    timeRules = data.timeRules || timeRules;
    console.log('📋 Loaded whitelist:', whitelist);
    console.log('📋 Loaded blocklist:', blocklist);
    console.log('⏰ Loaded time rules:', timeRules);
});
// Listen for changes to whitelist, blocklist, and time rules
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
        if (changes.whitelist) {
            whitelist = changes.whitelist.newValue || [];
            console.log('📋 Whitelist updated:', whitelist);
        }
        if (changes.blocklist) {
            blocklist = changes.blocklist.newValue || [];
            console.log('📋 Blocklist updated:', blocklist);
        }
        if (changes.timeRules) {
            timeRules = changes.timeRules.newValue || timeRules;
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
function showApiKeyNotice() {
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
function isSponsoredContent(element) {
    try {
        // Check for sponsored content indicators
        const adBadgeElements = element.querySelectorAll('badge-shape-wiz--ad, .badge-shape-wiz--ads-include-dot, .ytwAdBadgeViewModelHost');
        const adTextElements = element.querySelectorAll('[title="Sponsored"]');
        // Check for text content separately since :contains() isn't valid CSS
        const allSpans = element.querySelectorAll('span');
        const allDivs = element.querySelectorAll('div');
        const sponsoredSpans = Array.from(allSpans).filter((span) => span.textContent?.includes('Sponsored'));
        const sponsoredDivs = Array.from(allDivs).filter((div) => div.textContent?.includes('Sponsored') || div.textContent?.includes('Ad'));
        const adRenderingElements = element.querySelectorAll('ytd-in-feed-ad-layout-renderer, div#rendering-content');
        // Check if there's any ad-related metadata
        const hasAdMetadata = element.querySelector('.ytwFeedAdMetadataViewModelHost') !== null;
        return (adBadgeElements.length > 0 ||
            adTextElements.length > 0 ||
            sponsoredSpans.length > 0 ||
            sponsoredDivs.length > 0 ||
            adRenderingElements.length > 0 ||
            hasAdMetadata ||
            (element.textContent?.includes('Sponsored') ?? false) ||
            element.innerHTML.includes('ytd-in-feed-ad'));
    }
    catch (error) {
        console.warn('⚠️ Error checking for sponsored content:', error);
        return false;
    }
}
// Function to extract video information
function getVideoInfo(element) {
    try {
        // Extract video title
        const titleSelectors = [
            '#video-title',
            'a#video-title-link',
            'a.yt-simple-endpoint',
            'h3 a.yt-simple-endpoint',
            '.title-wrapper',
            '.ytd-rich-grid-media',
            'h4.ytd-compact-video-renderer',
        ];
        let titleElement = null;
        for (const selector of titleSelectors) {
            try {
                const foundElement = element.querySelector(selector);
                if (foundElement) {
                    titleElement = foundElement;
                    break;
                }
            }
            catch (selectorError) {
                console.warn(`⚠️ Error with selector ${selector}:`, selectorError);
            }
        }
        if (!titleElement) {
            console.warn('⚠️ Could not find title element, returning default');
            return { title: 'Unknown Video', creator: 'Unknown Creator', description: '' };
        }
        // Get either text content or title attribute
        const title = titleElement.textContent?.trim() ||
            titleElement.getAttribute('title')?.trim() ||
            'Unknown Video';
        // Extract video creator
        let creator = 'Unknown Creator';
        try {
            const creatorElement = element.querySelector('ytd-channel-name #text a, yt-formatted-string a[href^="/@"]');
            if (creatorElement) {
                creator = creatorElement.textContent?.trim() || 'Unknown Creator';
            }
        }
        catch (error) {
            console.warn('⚠️ Error getting video creator:', error);
        }
        // Extract description (if available)
        let description = '';
        try {
            const descriptionElement = element.querySelector('#description, #description-text, .description');
            if (descriptionElement) {
                description = descriptionElement.textContent?.trim() || '';
            }
        }
        catch (error) {
            console.warn('⚠️ Error getting video description:', error);
        }
        console.log('📹 Found video info:', {
            title,
            creator,
            description: description.substring(0, 50) + (description.length > 50 ? '...' : ''),
        });
        return { title, creator, description };
    }
    catch (error) {
        console.warn('⚠️ Error getting video info:', error);
        return { title: 'Unknown Video', creator: 'Unknown Creator', description: '' };
    }
}
// Function to hide non-qualifying videos
function hideVideo(element) {
    console.log('🚫 Hiding video');
    element.style.display = 'none';
}
// Helper function to check if current time is within work hours
function isWithinWorkHours() {
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
function isWhitelisted(creator) {
    if (!creator || creator === 'Unknown Creator') {
        return false;
    }
    return whitelist.some((whitelisted) => creator.toLowerCase().includes(whitelisted.toLowerCase()) ||
        whitelisted.toLowerCase().includes(creator.toLowerCase()));
}
// Helper function to check if creator is blocklisted
function isBlocklisted(creator) {
    if (!creator || creator === 'Unknown Creator') {
        return false;
    }
    return blocklist.some((blocked) => creator.toLowerCase().includes(blocked.toLowerCase()) ||
        blocked.toLowerCase().includes(creator.toLowerCase()));
}
// Function to process a single video element
async function processVideoElement(element) {
    // First, check if this is sponsored content
    if (isSponsoredContent(element)) {
        console.log('🛑 Found sponsored content - hiding automatically');
        hideVideo(element);
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
    // Check if we're in work hours
    const inWorkHours = isWithinWorkHours();
    // If blocklisted and in work hours, hide immediately
    if (isBlocklisted(creator) && inWorkHours) {
        console.log(`🚫 Blocklisted creator during work hours: ${creator} - hiding`);
        hideVideo(element);
        return;
    }
    // If blocklisted but NOT in work hours, show
    if (isBlocklisted(creator) && !inWorkHours) {
        console.log(`👀 Blocklisted creator outside work hours: ${creator} - showing`);
        return;
    }
    // If NOT in work hours, show everything (skip LLM validation)
    if (!inWorkHours) {
        console.log(`🌙 Outside work hours - showing without LLM check: ${videoInfo.title}`);
        return;
    }
    // If we're here: in work hours, not whitelisted, not blocklisted
    // Run LLM validation
    try {
        console.log('🔍 Processing video:', videoInfo.title);
        const isQualifying = await checkVideoContent(videoInfo);
        console.log(`🔍 AI check result for video "${videoInfo.title}": ${isQualifying ? 'Educational' : 'Not educational'}`);
        if (!isQualifying) {
            hideVideo(element);
        }
    }
    catch (error) {
        console.error('❌ Error checking video content:', error);
    }
}
// Function to wait for videos to load dynamically
async function waitForVideos(timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const videos = document.querySelectorAll('ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer');
        if (videos.length > 0) {
            console.log('✅ Videos loaded, found:', videos.length);
            return;
        }
        await new Promise((r) => setTimeout(r, 200));
    }
    console.log('⚠️ Timeout waiting for videos');
}
// Function to check video content with AI via background script
function checkVideoContent(videoInfo) {
    const cacheKey = videoInfo.title;
    // Check cache first
    if (checkedVideos.has(cacheKey)) {
        console.log('💾 Cache hit for:', videoInfo.title);
        return Promise.resolve(checkedVideos.get(cacheKey));
    }
    console.log('🤖 Checking video content for:', videoInfo.title);
    return new Promise((resolve, reject) => {
        try {
            chrome.runtime.sendMessage({
                action: 'checkVideo',
                videoInfo: {
                    title: videoInfo.title.trim(),
                    description: videoInfo.description || '',
                    creator: videoInfo.creator || 'Unknown Creator',
                },
            }, (response) => {
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
                }
                else {
                    console.log('✅ AI check result:', response.isQualifying ? 'Qualified' : 'Not qualified');
                    // Cache the result
                    checkedVideos.set(cacheKey, response.isQualifying);
                    resolve(response.isQualifying);
                }
            });
        }
        catch (error) {
            console.error('❌ Error sending message:', error);
            reject(error);
        }
    });
}
// Main function to process YouTube page
async function processYouTubePage() {
    console.log('🎬 Starting to process YouTube page');
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
    // YouTube might use different selectors for different pages
    const selectors = [
        'ytd-rich-item-renderer', // Home page
        'ytd-video-renderer', // Search results
        'ytd-grid-video-renderer', // Channel page
    ];
    let videoElements = [];
    for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            console.log(`📋 Found ${elements.length} videos with selector ${selector}`);
            videoElements = Array.from(elements);
            break;
        }
    }
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
function monitorForContent() {
    // Create a mutation observer to detect DOM changes
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach((node) => {
                    // Check if the added node is an Element
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node;
                        // Check for sponsored content in this element or its children
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
                        // Check if this is a new video element from infinite scroll
                        if (element.matches &&
                            (element.matches('ytd-rich-item-renderer') ||
                                element.matches('ytd-video-renderer') ||
                                element.matches('ytd-grid-video-renderer'))) {
                            console.log('📹 Found new video from infinite scroll');
                            processVideoElement(element);
                        }
                        // Also check for video elements inside the added node
                        const videoSelectors = [
                            'ytd-rich-item-renderer',
                            'ytd-video-renderer',
                            'ytd-grid-video-renderer',
                        ];
                        videoSelectors.forEach((selector) => {
                            const videoElements = element.querySelectorAll(selector);
                            videoElements.forEach((videoElement) => {
                                console.log('📹 Found new video inside added node');
                                processVideoElement(videoElement);
                            });
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
export {};
