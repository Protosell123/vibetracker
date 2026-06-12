import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const LIMIT_PAGES = process.env.LIMIT_PAGES && process.env.LIMIT_PAGES !== 'all' 
  ? parseInt(process.env.LIMIT_PAGES, 10) 
  : 'all';

// Category mapping:
// 2071 (Audio Plugins), 47 (Daw & Audio Editor) -> Plugins
// 121 (Audio Samples), 766 (Audio Templates & Presets) -> Sample Packs
const CATEGORIES = [
  { id: 2071, name: 'Plugins' },
  { id: 47, name: 'Plugins' },
  { id: 121, name: 'Sample Packs' },
  { id: 766, name: 'Sample Packs' }
];

const OUTPUT_PATH = path.join('src', 'data', 'rutracker_plugins.json');
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Clean raw title
function cleanTorrentTitle(rawTitle, categoryName) {
  let developer = 'Unknown';
  let title = rawTitle;
  let version = '';
  let os = [];
  let formats = [];

  let cleaned = rawTitle.replace(/\s+/g, ' ');

  // 1. Detect OS
  const hasWin = /win(dows)?/i.test(cleaned);
  const hasMac = /mac(intosh)?|osx|os\s*x/i.test(cleaned);
  if (hasWin) os.push('Windows');
  if (hasMac) os.push('macOS');
  
  if (os.length === 0) {
    if (categoryName === 'Sample Packs') {
      os = ['Windows', 'macOS'];
    } else {
      os = ['Windows'];
    }
  }

  // 2. Detect formats
  const formatPatterns = ['VST', 'VST3', 'AU', 'AAX', 'STANDALONE', 'KONTAKT', 'SAL', 'CLAP', 'WAV', 'MIDI', 'AIFF', 'MULTIFORMAT', 'REX2', 'SFZ', 'FLP'];
  formatPatterns.forEach(f => {
    const regex = new RegExp(`\\b${f}\\b`, 'i');
    if (regex.test(cleaned)) {
      formats.push(f);
    }
  });

  // 3. Try to split "Developer - Title v1.2.3"
  const parts = cleaned.split(' - ');
  if (parts.length > 1) {
    developer = parts[0].trim();
    let titlePart = parts.slice(1).join(' - ');
    
    const versionMatch = titlePart.match(/v\d+(\.\d+)*/i) || titlePart.match(/version\s*\d+(\.\d+)*/i);
    if (versionMatch) {
      version = versionMatch[0].trim();
      titlePart = titlePart.replace(versionMatch[0], '');
    }

    title = titlePart.replace(/\[[^\]]+\]/g, '')
                     .replace(/\([^)]+\)/g, '')
                     .replace(/v\d+(\.\d+)*/gi, '')
                     .trim();
  } else {
    const versionMatch = cleaned.match(/v\d+(\.\d+)*/i);
    if (versionMatch) {
      version = versionMatch[0].trim();
    }
    title = cleaned.replace(/\[[^\]]+\]/g, '').replace(/\([^)]+\)/g, '').trim();
  }

  if (formats.length === 0) {
    if (categoryName === 'Sample Packs') {
      formats.push('WAV');
    } else {
      formats.push('VST3');
    }
  }

  return {
    developer,
    title,
    version,
    os,
    formats
  };
}

async function run() {
  console.log('\n[VSTorrent Scraper] Starting VSTorrent sync...');

  // 1. Load existing database
  let database = []; // Will hold existing + new VSTorrent items
  let existingIds = new Set();
  let rutrackerItems = []; // Will hold RuTracker items to be preserved

  if (fs.existsSync(OUTPUT_PATH)) {
    try {
      const raw = fs.readFileSync(OUTPUT_PATH, 'utf-8');
      const existingData = JSON.parse(raw);
      
      // Separate RuTracker and VSTorrent items
      rutrackerItems = existingData.filter(item => item.source !== 'VSTorrent');
      const vstorrentItems = existingData.filter(item => item.source === 'VSTorrent');
      
      // Load all IDs to prevent duplicates
      existingData.forEach(item => {
        if (item.id) existingIds.add(item.id);
      });
      
      // Populate database array with existing VSTorrent items
      database = [...vstorrentItems];
      
      console.log(`[VSTorrent Scraper] Loaded existing database with ${rutrackerItems.length} RuTracker items and ${database.length} VSTorrent items.`);
    } catch (err) {
      console.warn('[VSTorrent Scraper] Warning: Could not parse existing database, starting fresh.', err.message);
    }
  }

  let newItemsCount = 0;

  // 2. Crawl categories
  for (const cat of CATEGORIES) {
    console.log(`\n[VSTorrent Scraper] Crawling category ID ${cat.id} (${cat.name})...`);
    
    let page = 1;
    let keepCrawling = true;

    while (keepCrawling) {
      const url = `https://vstorrent.org/wp-json/wp/v2/posts?categories=${cat.id}&per_page=100&page=${page}`;
      console.log(`[VSTorrent Scraper] Fetching page ${page}...`);

      try {
        const response = await axios.get(url, {
          headers: { 'User-Agent': USER_AGENT }
        });

        const posts = response.data;
        if (!posts || posts.length === 0) {
          console.log('[VSTorrent Scraper] No more posts found.');
          break;
        }

        console.log(`[VSTorrent Scraper] Received ${posts.length} posts.`);
        let pageNewItems = 0;

        for (const post of posts) {
          const stringId = `vst-${post.id}`;
          
          // Incremental sync guard: if post ID already exists, we skip it
          if (existingIds.has(stringId)) {
            if (LIMIT_PAGES === 'all') {
              // During a full sync, just skip the item and keep crawling other pages to get history
              continue;
            } else {
              // During a limited/incremental run, stop crawling as soon as we hit an existing item
              console.log(`[VSTorrent Scraper] Reached already-scraped item "${post.title.rendered}" (${stringId}). Stopping category.`);
              keepCrawling = false;
              break;
            }
          }

          // Parse magnet link from content using fast regex instead of heavy Cheerio load
          const html = post.content?.rendered || '';
          const magnetMatch = html.match(/href=["'](magnet:\?[^"']+)["']/i);
          const magnet = magnetMatch ? magnetMatch[1] : null;

          if (!magnet) {
            // Skip post if it doesn't contain a download link
            continue;
          }

          // Decode HTML entities in the raw title
          const rawTitle = cheerio.load(post.title.rendered).text().trim();
          
          // Parse metadata using standard cleanTitle function
          const cleanInfo = cleanTorrentTitle(rawTitle, cat.name);

          // Convert ISO date (e.g. "2026-06-11T08:53:16") to space format ("2026-06-11 08:53:16")
          const dateStr = post.date ? post.date.replace('T', ' ') : '';

          const item = {
            id: stringId,
            topicId: stringId,
            category: cat.name,
            categoryId: cat.id,
            rawTitle: rawTitle,
            title: cleanInfo.title,
            developer: cleanInfo.developer,
            version: cleanInfo.version,
            os: cleanInfo.os,
            formats: cleanInfo.formats,
            author: 'Admin',
            size: 'Unknown',
            seeders: 5, // Default placeholder
            leechers: 0,
            date: dateStr,
            topicUrl: post.link,
            downloadUrl: magnet,
            source: 'VSTorrent'
          };

          database.push(item);
          existingIds.add(stringId);
          pageNewItems++;
          newItemsCount++;
        }

        console.log(`[VSTorrent Scraper] Processed ${pageNewItems} new items from page ${page}.`);

        if (!keepCrawling) break;

        // Get total pages from header
        const totalPagesHeader = response.headers['x-wp-totalpages'];
        const totalPages = totalPagesHeader ? parseInt(totalPagesHeader, 10) : 1;
        
        const maxPagesToScrape = LIMIT_PAGES === 'all' 
          ? totalPages 
          : Math.min(LIMIT_PAGES, totalPages);

        if (page >= maxPagesToScrape) {
          console.log(`[VSTorrent Scraper] Reached page limit (${maxPagesToScrape}).`);
          break;
        }

        page++;
        // Throttle requests slightly to avoid rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.error(`[VSTorrent Scraper] Error crawling page ${page}:`, err.message);
        break; // Stop pagination on error
      }
    }
  }

  // 3. Save database back if new items were found
  if (newItemsCount > 0) {
    console.log(`\n[VSTorrent Scraper] SUCCESS! Added ${newItemsCount} new VSTorrent items.`);
    
    // Merge database (VSTorrent items) and RuTracker items
    const finalDatabase = [...database, ...rutrackerItems];

    // Sort final database by date descending
    finalDatabase.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const dataDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(finalDatabase, null, 2), 'utf-8');
    console.log(`[VSTorrent Scraper] Saved updated database to: ${OUTPUT_PATH}`);
  } else {
    console.log('\n[VSTorrent Scraper] Database is already up to date. No new items added.');
  }
}

run().catch(console.error);
