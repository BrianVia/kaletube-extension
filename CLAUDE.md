# KaleTube Chrome Extension Guidelines

## Commands
- **Install:** `npm install`
- **Load Extension:** Open Chrome, go to `chrome://extensions/`, enable Developer mode, and "Load unpacked"
- **Lint:** `npx eslint .`
- **Format:** `npx prettier --write "**/*.js"`
- **Test:** `npx jest`
- **Test Single File:** `npx jest path/to/test.js`

## Code Style
- **Language:** Modern JavaScript (ES6+) with Chrome Extension APIs
- **Naming:** camelCase for variables/functions, descriptive names
- **Formatting:** 2-space indentation, single quotes, semicolons
- **Error Handling:** Use try/catch blocks with detailed logging
- **Logging:** Use emoji prefixes for visual identification
- **DOM Manipulation:** Cache element references, handle null cases
- **API Calls:** Async/await pattern with proper error handling
- **Comments:** Document complex logic and YouTube DOM selectors
- **Security:** Never expose API keys in unencrypted storage

This extension filters YouTube content to show educational videos and hide sponsored content.