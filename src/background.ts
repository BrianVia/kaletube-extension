import type { CheckVideoMessage, CheckVideoResponse, StorageData } from './types';

// Default API key will be replaced with user-configured key
let GEMINI_API_KEY = '';

// Load API key from storage
chrome.storage.sync.get('geminiApiKey', (data: StorageData) => {
  if (data.geminiApiKey) {
    console.log('🔑 API key loaded from storage');
    GEMINI_API_KEY = data.geminiApiKey;
  } else {
    console.warn('⚠️ No API key found in storage');
  }
});

// Listen for API key changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.geminiApiKey) {
    console.log('🔄 API key updated');
    GEMINI_API_KEY = (changes.geminiApiKey.newValue as string) || '';
  }
});

// Function to call Google Gemini API
async function callGeminiAPI(
  videoTitle: string,
  videoDescription: string,
  videoCreator: string,
  retryCount = 0
): Promise<string | null> {
  const MAX_RETRIES = 3;

  try {
    console.log('🤖 Calling Gemini API for:', videoTitle);

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `You are tasked with evaluating whether a given video is educational or relevant to self-development. Your goal is to determine if the content is informative, instructional, or aimed at personal growth and improvement.

Here is the video information you need to evaluate:
Title: "${videoTitle}"
Creator: "${videoCreator}"
${videoDescription ? `Description: "${videoDescription}"` : 'No description available'}

Please follow these steps to evaluate the video:

1. Determine if the video content suggests educational content, music for working out, music for working to, or content related to self-development.
2. Conclude with either "YES" if the content is educational or relevant to self-development, or "NO" if it is not.

Examples of topics that would be considered educational or related to self-development:
- Building a Successful Business
- Improving in some area
- Innovation, Leadership, Productivity
- Motivation, Mindset
- Entrepreneurship, Sales, Marketing
- Time Management
- Health and Fitness, Lifting Weights, etc.
- Personal Finance
- Career Development
- Communication Skills
- Emotional Intelligence
- Self-Improvement
- Economics, Finance, Investing
- Music/Mixtapes/EDM
- Ambient Sound mixes, study music, etc.
- Film Soundtracks (especially if they are from something like the Social Network)

Examples of topics that would be considered non-educational or not related to self-development:
- Video Games (Counter-Strike, FACEIT, else, Fortnite, etc.)
- Memes, TikTok trends, etc.
- Movie Reviews, TV Shows, Anime, etc.
- Cooking, Eating, Recipes, etc.


Guidelines for evaluation:
- Educational content typically aims to teach, inform, or explain a topic.
- Self-development content focuses on personal growth, skill improvement, or life enhancement.
- Consider keywords that suggest learning, improvement, or personal growth.

Only reply with YES or NO.`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 100,
        responseMimeType: 'text/plain',
      },
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      // Handle rate limiting with exponential backoff
      if (response.status === 429 && retryCount < MAX_RETRIES) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        console.log(
          `⏳ Rate limited. Retrying in ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`
        );
        await new Promise((r) => setTimeout(r, delay));
        return callGeminiAPI(videoTitle, videoDescription, videoCreator, retryCount + 1);
      }
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Extract the text response from Gemini
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const responseText = data.candidates[0].content.parts[0].text.trim();
      console.log('🤖 Gemini response:', responseText);

      // Check if response contains YES
      if (responseText.includes('YES') || responseText.toUpperCase() === 'YES') {
        return 'YES';
      } else {
        return 'NO';
      }
    } else {
      console.error('❌ Unexpected API response format:', data);
      return null;
    }
  } catch (error) {
    console.error('❌ Error calling Gemini API:', error);
    return null;
  }
}

// Listen for messages from the content script
chrome.runtime.onMessage.addListener(
  (
    request: CheckVideoMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: CheckVideoResponse) => void
  ) => {
    console.log('🔔 Background script received message:', request);

    if (request.action === 'checkVideo' && request.videoInfo && request.videoInfo.title) {
      const { title, description, creator } = request.videoInfo;
      console.log('📝 Processing video:', {
        title,
        creator,
        description: description
          ? description.substring(0, 50) + (description.length > 50 ? '...' : '')
          : '',
      });

      // Check if API key is configured
      if (!GEMINI_API_KEY) {
        console.error('❌ No API key configured');
        sendResponse({ error: 'API key not configured', needsApiKey: true });
        return true;
      }

      // Call the Gemini API and send the response back to the content script
      callGeminiAPI(title, description, creator)
        .then((result) => {
          console.log(`🤖 API result for "${title}":`, result);
          const isQualifying = result === 'YES';
          sendResponse({ isQualifying });
        })
        .catch((error) => {
          console.error('❌ Error in Gemini API call:', error);
          sendResponse({ error: 'Failed to analyze video content' });
        });

      // Return true to indicate that the response will be sent asynchronously
      return true;
    } else {
      console.error('❌ Invalid message format received:', request);
      sendResponse({ error: 'Invalid message format' });
      return false;
    }
  }
);
