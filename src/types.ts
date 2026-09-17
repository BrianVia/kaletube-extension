// Storage types
export interface StorageData {
  typesafeApiKey?: string;
  extensionEnabled?: boolean;
  whitelist?: string[];
  blocklist?: string[];
  timeRules?: TimeRules;
}

export interface TimeRules {
  enabled: boolean;
  startTime: string;
  endTime: string;
  blockSaturday: boolean;
  blockSunday: boolean;
}

// Video information
export interface VideoInfo {
  title: string;
  creator: string;
  description: string;
}

export type VideoCategory = 'educational' | 'ambient_music' | 'distraction';

// Message types between content and background scripts
export interface CheckVideoMessage {
  action: 'checkVideo';
  videoInfo: VideoInfo;
}

export interface CheckVideoResponse {
  isQualifying?: boolean;
  category?: VideoCategory;
  confidence?: number;
  error?: string;
  needsApiKey?: boolean;
}

export type ExtensionMessage = CheckVideoMessage;

export type ExtensionResponse = CheckVideoResponse;
