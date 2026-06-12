import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

// Load environment variables from .env
dotenv.config();

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Target forum configuration
const TARGET_FORUMS = [
  { id: 1199, name: 'Plugins' },
  { id: 1674, name: 'Sample Packs' }
];

// Read page limit from env. Defaults to 'all' (scrapes everything).
// Set e.g. LIMIT_PAGES=3 in .env for quick runs.
const LIMIT_PAGES = process.env.LIMIT_PAGES && process.env.LIMIT_PAGES !== 'all' 
  ? parseInt(process.env.LIMIT_PAGES, 10) 
  : 'all';

async function fetchForumPage(forumId, start, sessionCookie) {
  const url = `https://rutracker.org/forum/viewforum.php?f=${forumId}&start=${start}`;
  console.log(`[Scraper] Fetching forum ID ${forumId} (start=${start})...`);
  
  const headers = {
    'User-Agent': USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,sv;q=0.8,ru;q=0.7',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };

  const cookies = [];
  if (sessionCookie) {
    cookies.push(`bb_session=${sessionCookie}`);
  }
  if (process.env.BB_GUID) cookies.push(`bb_guid=${process.env.BB_GUID}`);
  if (process.env.CF_CLEARANCE) cookies.push(`cf_clearance=${process.env.CF_CLEARANCE}`);
  if (process.env.BB_SSL) cookies.push(`bb_ssl=${process.env.BB_SSL}`);
  if (process.env.BB_T) cookies.push(`bb_t=${process.env.BB_T}`);

  if (cookies.length > 0) {
    headers['Cookie'] = cookies.join('; ');
  }

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: headers
    });

    const html = iconv.decode(Buffer.from(response.data), 'windows-1251');
    return html;
  } catch (error) {
    console.error(`[Scraper] Error fetching forum page (start=${start}):`, error.message);
    return null;
  }
}

// Detect total pages in the forum list by reading the pagination buttons
function detectTotalPages(html) {
  if (!html) return 1;
  const $ = cheerio.load(html);
  let maxPage = 1;

  $('a.pg').each((i, el) => {
    const val = parseInt($(el).text().trim(), 10);
    if (!isNaN(val) && val > maxPage) {
      maxPage = val;
    }
  });

  return maxPage;
}

function parseForumHtml(html, forumId, forumName) {
  if (!html) return [];

  const $ = cheerio.load(html);
  const torrents = [];

  // Table rows containing topics
  const tableRows = $('table.vf-table tr.hl-tr');
  
  if (tableRows.length === 0) {
    const pageTitle = $('title').text().trim();
    console.warn(`[Scraper] Warning: Could not find table rows with 'table.vf-table tr.hl-tr'.`);
    console.warn(`[Scraper] Page title returned: "${pageTitle}"`);
    return [];
  }

  tableRows.each((index, element) => {
    const row = $(element);
    const cells = row.find('td');

    // viewforum.php columns:
    // 0: Topic icon (class vf-col-icon)
    // 1: Topic Title, Author, Pages (class vf-col-t-title tt)
    // 2: Torrent stats: Seeders, Leechers, Size (class vf-col-tor)
    // 3: Replies (class vf-col-replies)
    // 4: Last post date, Author (class vf-col-last-post)
    
    const titleCell = cells.eq(1);
    const titleLink = titleCell.find('a.torTopic');
    
    if (titleLink.length === 0) return; // Skip if no topic link found

    const rawTitle = titleLink.text().trim();
    const topicUrl = titleLink.attr('href'); // e.g. "viewtopic.php?t=654321"
    const topicId = topicUrl ? topicUrl.split('t=')[1] : null;

    const author = titleCell.find('a.topicAuthor').text().trim() || 'Unknown';

    const torCell = cells.eq(2);
    const sizeLink = torCell.find('a.f-dl');
    
    // Skip general discussion/rule rows that don't have download links
    if (sizeLink.length === 0) return;

    const sizeText = sizeLink.text().trim();
    const downloadLink = sizeLink.attr('href'); // e.g. "dl.php?t=XXXXXX"
    const torrentId = downloadLink ? downloadLink.split('t=')[1] : topicId;

    const seedersText = torCell.find('.seedmed').text().trim();
    const seeders = parseInt(seedersText, 10) || 0;

    const leechersText = torCell.find('.leechmed').text().trim();
    const leechers = parseInt(leechersText, 10) || 0;

    const dateCell = cells.eq(4);
    const dateText = dateCell.find('p').eq(0).text().trim() || dateCell.text().split('\n')[0].trim();

    // Clean up and parse the title for better presentation
    const cleanInfo = cleanTorrentTitle(rawTitle, forumName);

    torrents.push({
      id: torrentId || topicId,
      topicId: topicId,
      category: forumName,
      categoryId: forumId,
      rawTitle: rawTitle,
      title: cleanInfo.title,
      developer: cleanInfo.developer,
      version: cleanInfo.version,
      os: cleanInfo.os,
      formats: cleanInfo.formats,
      author: author,
      size: sizeText,
      seeders: seeders,
      leechers: leechers,
      date: dateText,
      topicUrl: `https://rutracker.org/forum/${topicUrl}`,
      downloadUrl: downloadLink ? `https://rutracker.org/forum/${downloadLink}` : null
    });
  });

  return torrents;
}

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
  
  // For sample packs, OS doesn't matter (they are WAV/MIDI files usually compatible with both), 
  // so we default to both if none specified. For plugins, fallback to Windows.
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
  const sessionCookie = process.env.BB_SESSION;
  
  if (!sessionCookie) {
    console.log('[Scraper] Info: BB_SESSION not set. Attempting guest scrape...');
  } else {
    console.log('[Scraper] BB_SESSION cookie loaded.');
  }
  
  let allTorrents = [];

  for (const forum of TARGET_FORUMS) {
    console.log(`\n[Scraper] Starting scrape for Forum ID ${forum.id} (${forum.name})...`);
    
    // Fetch page 1 to detect total pagination pages
    const firstPageHtml = await fetchForumPage(forum.id, 0, sessionCookie);
    if (!firstPageHtml) {
      console.error(`[Scraper] Failed to fetch first page for forum ${forum.id}. Skipping.`);
      continue;
    }

    const detectedPages = detectTotalPages(firstPageHtml);
    console.log(`[Scraper] Auto-detected total pages: ${detectedPages}`);

    const pagesToScrape = LIMIT_PAGES === 'all' 
      ? detectedPages 
      : Math.min(LIMIT_PAGES, detectedPages);

    console.log(`[Scraper] Scraping ${pagesToScrape} pages...`);

    // Parse first page results
    const firstPageTorrents = parseForumHtml(firstPageHtml, forum.id, forum.name);
    allTorrents = allTorrents.concat(firstPageTorrents);

    // Scrape subsequent pages
    for (let page = 1; page < pagesToScrape; page++) {
      const start = page * 50;
      const html = await fetchForumPage(forum.id, start, sessionCookie);
      
      if (html) {
        const torrents = parseForumHtml(html, forum.id, forum.name);
        if (torrents.length === 0) {
          console.log(`[Scraper] No torrents parsed from page ${page + 1}. Stopping pagination.`);
          break;
        }
        allTorrents = allTorrents.concat(torrents);
      } else {
        console.log(`[Scraper] Failed to fetch page ${page + 1}. Stopping pagination.`);
        break;
      }
      
      // Sleep 1.5s to prevent rate limiting
      if (page < pagesToScrape - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    // Sleep 2s between forums
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  if (allTorrents.length > 0) {
    const dataDir = path.join('src', 'data');
    if (!fs.existsSync(dataDir)){
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const outputPath = path.join(dataDir, 'rutracker_plugins.json');
    
    // Explicitly mark RuTracker items
    allTorrents.forEach(item => {
      item.source = 'RuTracker';
    });

    let mergedDatabase = [...allTorrents];

    if (fs.existsSync(outputPath)) {
      try {
        const raw = fs.readFileSync(outputPath, 'utf-8');
        const existingData = JSON.parse(raw);
        // Keep VSTorrent items
        const vstorrentItems = existingData.filter(item => item.source === 'VSTorrent');
        mergedDatabase = [...mergedDatabase, ...vstorrentItems];
        console.log(`[Scraper] Preserved ${vstorrentItems.length} VSTorrent items from existing database.`);
      } catch (err) {
        console.warn('[Scraper] Could not read existing database to preserve VSTorrent items:', err.message);
      }
    }

    // Sort database by date descending
    mergedDatabase.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    fs.writeFileSync(outputPath, JSON.stringify(mergedDatabase, null, 2), 'utf-8');
    console.log(`\n[Scraper] SUCCESS! Scraped a total of ${allTorrents.length} RuTracker items.`);
    console.log(`Saved merged database with ${mergedDatabase.length} total items to: ${outputPath}`);
  } else {
    console.error('\n[Scraper] FAILED: Could not scrape any data.');
  }

  // Trigger VSTorrent sync as well
  try {
    console.log('\n[Scraper] Launching VSTorrent scraper...');
    execSync('node vstorrent_scraper.js', { stdio: 'inherit' });
  } catch (err) {
    console.error('[Scraper] VSTorrent scraper execution failed:', err.message);
  }
}

// Run the script
run().catch(console.error);
