// Determine the correct API base URLs depending on environment
// Browsers permit HTTPS sites to query http://localhost as a trustworthy origin, supporting local scanners.

// Local Pluggen Scanner API (resolves locally to port 3001)
export const LOCAL_API_BASE = window.location.hostname === 'localhost' ? '' : 'http://localhost:3001';

// RuTracker Scraper API (resolves to proxy in dev, or Railway URL in production)
export const SCRAPER_API_BASE = import.meta.env.VITE_API_URL || '';
