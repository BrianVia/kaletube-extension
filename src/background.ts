import type {
  CheckVideoMessage,
  CheckVideoResponse,
  StorageData,
  VideoCategory,
  VideoInfo,
} from './types';

// Default API key will be replaced with user-configured key
let TYPESAFE_API_KEY = '';

// Load API key from storage
chrome.storage.sync.get('typesafeApiKey', (data: StorageData) => {
  if (data.typesafeApiKey) {
    console.log('🔑 API key loaded from storage');
    TYPESAFE_API_KEY = data.typesafeApiKey;
  } else {
    console.warn('⚠️ No API key found in storage');
  }
});

// Listen for API key changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.typesafeApiKey) {
    console.log('🔄 API key updated');
    TYPESAFE_API_KEY = (changes.typesafeApiKey.newValue as string) || '';
  }
});

interface SystemOneResponse {
  answers: {
    category: {
      choice: VideoCategory;
      confidence: number;
    };
  };
}

async function classifyVideo(
  video: VideoInfo,
  retryCount = 0
): Promise<{ category: VideoCategory; confidence: number } | null> {
  const MAX_RETRIES = 3;

  try {
    console.log('🤖 Calling Jev API for:', video.title);

    const stateVideo: { title: string; creator: string; description?: string } = {
      title: video.title,
      creator: video.creator,
    };
    if (video.description) {
      stateVideo.description = video.description;
    }

    const requestBody = {
      state: { video: stateVideo },
      model: 'jev-latest',
      questions: {
        category: {
          type: 'choice',
          instructions:
            'This is a YouTube homepage video card seen during work hours. Classify the kind of content so distracting videos can be hidden.',
          criteria: {
            educational:
              'Teaches, informs, or explains: business, productivity, leadership, finance, investing, economics, career, communication, fitness, health, self-improvement, mindset, programming, science, history, engineering',
            ambient_music:
              'Music or sound suitable as background while working or exercising: EDM mixes, lo-fi, ambient, study/focus playlists, film soundtracks, workout mixes',
            distraction:
              'Entertainment with no learning or work value: video games and esports, memes, TikTok trends, reactions, movie/TV/anime reviews or clips, celebrity gossip, cooking and eating shows, vlogs, pranks, sports highlights',
          },
        },
      },
    };

    const response = await fetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TYPESAFE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      // Handle rate limiting with exponential backoff
      if (response.status === 429 && retryCount < MAX_RETRIES) {
        const retryAfter = response.headers.get('retry-after');
        const delay = retryAfter === null ? Math.pow(2, retryCount) * 1000 : Number(retryAfter) * 1000;
        console.log(
          `⏳ Rate limited. Retrying in ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`
        );
        await new Promise((r) => setTimeout(r, delay));
        return classifyVideo(video, retryCount + 1);
      }
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data: SystemOneResponse = await response.json();
    const { choice: category, confidence } = data.answers.category;
    console.log('🤖 Jev response:', { category, confidence });
    return { category, confidence };
  } catch (error) {
    console.error('❌ Error calling Jev API:', error);
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
      if (!TYPESAFE_API_KEY) {
        console.error('❌ No API key configured');
        sendResponse({ error: 'API key not configured', needsApiKey: true });
        return true;
      }

      // Call the Jev API and send the response back to the content script
      classifyVideo(request.videoInfo)
        .then((result) => {
          console.log(`🤖 API result for "${title}":`, result);
          if (!result) {
            sendResponse({ error: 'Failed to analyze video content' });
            return;
          }
          const { category, confidence } = result;
          const isQualifying = category !== 'distraction';
          sendResponse({ isQualifying, category, confidence });
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
