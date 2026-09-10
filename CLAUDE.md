# KaleTube Chrome Extension Guidelines

## Commands
- **Install:** `npm install`
- **Build:** `npm run build` (or `npm run dev` to watch)
- **Load Extension:** Open Chrome, go to `chrome://extensions/`, enable Developer mode, and "Load unpacked"
- **Lint:** `npm run lint` (oxlint)
- **Lint fix:** `npm run lint:fix`

## Code Style
- **Language:** TypeScript in `src/`, built with Vite to `dist/`; load `dist/` unpacked
- **Naming:** camelCase for variables/functions, descriptive names
- **Formatting:** 2-space indentation, single quotes, semicolons
- **Error Handling:** Use try/catch blocks with detailed logging
- **Logging:** Use emoji prefixes for visual identification
- **DOM Manipulation:** Cache element references, handle null cases
- **API Calls:** Async/await pattern with proper error handling
- **Comments:** Document complex logic and YouTube DOM selectors
- **Security:** Never expose API keys in unencrypted storage

This extension filters YouTube content to show educational videos and hide sponsored content.