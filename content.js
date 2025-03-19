// content.js

console.log("🚀 Content script loaded");

// Function to detect sponsored content
function isSponsoredContent(element) {
  try {
    // Check for sponsored content indicators
    const adBadgeElements = element.querySelectorAll('badge-shape-wiz--ad, .badge-shape-wiz--ads-include-dot, .ytwAdBadgeViewModelHost');
    const adTextElements = element.querySelectorAll('[title="Sponsored"], span:contains("Sponsored"), div:contains("Sponsored"), div:contains("Ad")');
    const adRenderingElements = element.querySelectorAll('ytd-in-feed-ad-layout-renderer, div#rendering-content');
    
    // Check if there's any ad-related metadata
    const hasAdMetadata = element.querySelector('.ytwFeedAdMetadataViewModelHost') !== null;
    
    return (
      adBadgeElements.length > 0 ||
      adTextElements.length > 0 || 
      adRenderingElements.length > 0 ||
      hasAdMetadata ||
      element.textContent.includes('Sponsored') ||
      element.innerHTML.includes('ytd-in-feed-ad')
    );
  } catch (error) {
    console.warn("⚠️ Error checking for sponsored content:", error);
    return false;
  }
}

// Function to extract video information
function getVideoInfo(element) {
  try {
    // Extract video title
    const titleSelectors = [
      "#video-title",                   // Standard title selector
      "a#video-title-link",             // Alternative title link 
      "a.yt-simple-endpoint",           // Another possible title element
      "h3 a.yt-simple-endpoint",        // Title in h3 element
      ".title-wrapper",                 // Home page title wrapper
      ".ytd-rich-grid-media",           // Grid media title
      "h4.ytd-compact-video-renderer"   // Compact video renderer title
    ];
    
    let titleElement = null;
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
      console.warn("⚠️ Could not find title element, returning default");
      return { title: "Unknown Video" };
    }
    
    // Get either text content or title attribute
    const title = (titleElement.textContent || "").trim() || 
                  (titleElement.getAttribute("title") || "").trim() ||
                  "Unknown Video";
    
    // Extract video creator
    let creator = "Unknown Creator";
    try {
      const creatorElement = element.querySelector('ytd-channel-name #text a, yt-formatted-string a[href^="/@"]');
      if (creatorElement) {
        creator = creatorElement.textContent.trim();
      }
    } catch (error) {
      console.warn("⚠️ Error getting video creator:", error);
    }
    
    // Extract description (if available)
    let description = "";
    try {
      const descriptionElement = element.querySelector('#description, #description-text, .description');
      if (descriptionElement) {
        description = descriptionElement.textContent.trim();
      }
    } catch (error) {
      console.warn("⚠️ Error getting video description:", error);
    }
    
    // Note: We're not extracting tags as they're typically not available on the home screen
    let tags = [];
    
    console.log("📹 Found video info:", { title, creator, description: description.substring(0, 50) + (description.length > 50 ? '...' : '') });
    return { title, creator, description, tags };
  } catch (error) {
    console.warn("⚠️ Error getting video info:", error);
    return { title: "Unknown Video" };
  }
}

// Function to hide non-qualifying videos
function hideVideo(element) {
  console.log("🚫 Hiding video");
  element.style.display = "none";
}

// Function to check video content with AI via background script
function checkVideoContent(videoInfo) {
  console.log("🤖 Checking video content for:", videoInfo.title);
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(
        { 
          action: "checkVideo", 
          videoInfo: {
            title: videoInfo.title.trim(),
            description: videoInfo.description || "",
            tags: videoInfo.tags || [],
            creator: videoInfo.creator || "Unknown Creator"
          }
        }, 
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("❌ Runtime error:", chrome.runtime.lastError);
            reject(chrome.runtime.lastError.message);
            return;
          }
          
          if (!response) {
            console.error("❌ No response received from background script");
            reject("No response received");
            return;
          }
          
          if (response.error) {
            console.error("❌ Error from AI check:", response.error);
            reject(response.error);
          } else {
            console.log("✅ AI check result:", response.isQualifying ? "Qualified" : "Not qualified");
            resolve(response.isQualifying);
          }
        }
      );
    } catch (error) {
      console.error("❌ Error sending message:", error);
      reject(error);
    }
  });
}

// Main function to process YouTube page
async function processYouTubePage() {
  console.log("🎬 Starting to process YouTube page");

  // Wait for videos to load
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // First, specifically look for and hide sponsored content
  const adSelectors = [
    "ytd-in-feed-ad-layout-renderer",
    "ytd-display-ad-renderer",
    "ytd-promoted-video-renderer",
    "ytd-promoted-sparkles-web-renderer",
    "ytd-ad-slot-renderer",
    "div#rendering-content"
  ];
  
  // Process each ad selector to find and hide sponsored content
  for (const selector of adSelectors) {
    const adElements = document.querySelectorAll(selector);
    if (adElements.length > 0) {
      console.log(`🛑 Found ${adElements.length} sponsored elements with selector ${selector}`);
      adElements.forEach(element => {
        console.log("🛑 Hiding sponsored content");
        hideVideo(element);
      });
    }
  }

  // YouTube might use different selectors for different pages
  const selectors = [
    "ytd-rich-item-renderer", // Home page
    "ytd-video-renderer",     // Search results
    "ytd-grid-video-renderer" // Channel page
  ];
  
  let videoElements = [];
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`📋 Found ${elements.length} videos with selector ${selector}`);
      videoElements = [...elements];
      break;
    }
  }

  console.log(`📋 Total: ${videoElements.length} videos to process`);

  if (videoElements.length === 0) {
    console.log("⚠️ No video elements found. DOM might not be ready.");
    return;
  }

  for (const element of videoElements) {
    // First, check if this is a sponsored content
    if (isSponsoredContent(element)) {
      console.log("🛑 Found sponsored content - hiding automatically");
      hideVideo(element);
      continue;
    }
    
    const videoInfo = getVideoInfo(element);
    if (!videoInfo.title || videoInfo.title === "Unknown Video") {
      console.log("⚠️ Skipping element due to missing title");
      continue;
    }

    try {
      console.log("🔍 Processing video:", videoInfo.title);
      const isQualifying = await checkVideoContent(videoInfo);
      console.log(`🔍 AI check result for video "${videoInfo.title}": ${isQualifying ? "Educational" : "Not educational"}`);
      if (!isQualifying) {
        hideVideo(element);
      }
    } catch (error) {
      console.error("❌ Error checking video content:", error);
    }
  }
  console.log("✨ Finished processing YouTube page");
}

// Function to continuously monitor for newly added sponsored content
function monitorForAds() {
  // Create a mutation observer to detect DOM changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => {
          // Check if the added node is an Element and if it might be an ad
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check for sponsored content in this element or its children
            if (isSponsoredContent(node)) {
              console.log("🛑 Found dynamically added sponsored content - hiding");
              hideVideo(node);
            }
            
            // Also check for potential ad elements inside the added node
            const adSelectors = [
              "ytd-in-feed-ad-layout-renderer",
              "ytd-display-ad-renderer",
              "ytd-promoted-video-renderer",
              "ytd-promoted-sparkles-web-renderer",
              "ytd-ad-slot-renderer",
              "div#rendering-content"
            ];
            
            adSelectors.forEach(selector => {
              const adElements = node.querySelectorAll(selector);
              adElements.forEach(adElement => {
                console.log(`🛑 Found dynamically added ad (${selector}) - hiding`);
                hideVideo(adElement);
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
    subtree: true
  });
  
  console.log("👀 Ad monitoring started");
}

// Run the main function when the page loads
window.addEventListener("load", () => {
  console.log("📄 Page loaded - starting process");
  processYouTubePage();
  monitorForAds(); // Start continuous monitoring
});

// Also run it when navigating between YouTube pages
window.addEventListener("yt-navigate-finish", () => {
  console.log("🔄 Navigation detected - starting process");
  processYouTubePage();
});
