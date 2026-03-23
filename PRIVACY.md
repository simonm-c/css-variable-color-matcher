# Privacy Policy

CSS Variable Color Matcher does not collect, transmit, or share any user data.

## Data Storage

All data is stored locally on your device using `chrome.storage.local`:

- **CSS variable names and values** scanned from the current page
- **Picked colors** selected via the eyedropper
- **Saved lists** of variable snapshots you create

This data never leaves your browser.

## Network Requests

The only network activity is fetching the current page's own `<link>` stylesheets to parse CSS variable declarations. No data is sent to external servers or third-party endpoints.

## Permissions

- **activeTab** — Access the current tab when you click the extension icon
- **scripting** — Inject the scanner and eyedropper scripts into the active page
- **storage** — Persist your scanned variables, picked colors, and saved lists locally
- **host_permissions (`<all_urls>`)** — Scan CSS variables on any website the user visits and fetch that page's stylesheets for parsing

## Third-Party Services

This extension does not use analytics, tracking, advertising, or any third-party services.

## Contact

If you have questions about this privacy policy, please open an issue on the project's GitHub repository.
