# KaleTube Extension

A browser extension that filters YouTube content to show educational and self-development videos.

## Features

- **AI-Powered Content Filtering**: Uses Google Gemini API to identify educational content
- **Whitelist/Blocklist System**: Manage which creators to always show or hide
- **Time-Based Blocking**: Configure work hours when strict filtering applies
- **Performance Optimized**: Caching, parallel processing, and batch API calls
- **Weekend Rules**: Optional blocking on weekends

## Tech Stack

- **TypeScript**: Fully typed codebase for better development experience
- **Vite**: Fast build tool with hot module replacement
- **Chrome Extension APIs**: Manifest V3 compatible
- **Google Gemini API**: AI-powered content analysis

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Development mode (watch for changes)
npm run dev
```

### Project Structure

```
kaletube-extension/
├── src/
│   ├── background.ts    # Service worker
│   ├── content.ts       # Content script for YouTube pages
│   ├── options.ts       # Options page logic
│   └── types.ts         # TypeScript type definitions
├── public/
│   ├── manifest.json    # Extension manifest
│   ├── options.html     # Options page UI
│   └── kale.png         # Extension icon
├── dist/                # Built extension (generated)
├── vite.config.ts       # Vite configuration
└── tsconfig.json        # TypeScript configuration
```

### Build Commands

- `npm run build` - Build the extension for production
- `npm run dev` - Watch mode for development

## Installation

### Chrome/Edge (Chrome only; Firefox support was dropped)

1. Run `npm run build`
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist/` directory

## Configuration

1. Click the extension icon or go to options
2. Add your Gemini API key (get one at https://ai.google.dev/)
3. Configure whitelisted/blocklisted creators
4. Set up work hours and time-based rules

## Security

### API Key Storage

Your Gemini API key is stored **locally** using Chrome's `storage.sync` API:
- ✅ **Never committed to git** - Keys are stored in your browser only
- ✅ **Encrypted by Chrome** - Chrome handles encryption at rest
- ✅ **Sync across devices** - If you're signed into Chrome (optional)
- ✅ **No server transmission** - Keys go directly from your browser to Google's API

### What's NOT in the Repository

The following are **never** committed to this repo:
- API keys
- User data (whitelists, blocklists, time rules)
- node_modules
- Build artifacts
- Any credentials or secrets

### Safe to Commit

Only source code and configuration files are in git:
- TypeScript source files
- Build configuration
- Static assets (manifest, HTML, icons)
- Documentation

## How It Works

### Outside Work Hours
- All content shown (except ads)
- No AI validation needed
- Optimal performance

### During Work Hours
- Whitelisted creators: Always shown
- Blocklisted creators: Always hidden
- Other creators: AI validation applied
- Educational content shown, non-educational hidden

## License

ISC
