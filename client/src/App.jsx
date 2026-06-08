import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Sidebar from './components/Sidebar.jsx';
import PluginCard from './components/PluginCard.jsx';
import Settings from './components/Settings.jsx';
import LocalLibrary from './components/LocalLibrary.jsx';
import LocalAssistant from './components/LocalAssistant.jsx';
import LocalSettings from './components/LocalSettings.jsx';
import { getPluginFunction, getSampleType } from './utils/classifier.js';
import { LOCAL_API_BASE } from './utils/api.js';

// Import datasets
import mockData from './data/mock_plugins.json';

export default function App() {
  const [plugins, setPlugins] = useState([]);
  const [filteredPlugins, setFilteredPlugins] = useState([]);
  const [activeTab, setActiveTab] = useState('Plugins'); // 'Plugins', 'Sample Packs', 'Favorites', 'Downloads'
  const [searchQuery, setSearchQuery] = useState('');
  const [osFilter, setOsFilter] = useState('All'); // 'All', 'Windows', 'macOS'
  const [formatFilter, setFormatFilter] = useState('All');
  const [developerSearch, setDeveloperSearch] = useState('');
  const [pluginFunctionFilter, setPluginFunctionFilter] = useState('All');
  const [sampleTypeFilter, setSampleTypeFilter] = useState('All');
  const [sortOption, setSortOption] = useState('date-desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [dbState, setDbState] = useState('Mock'); // 'Mock' or 'Scraped'
  
  // Pluggen backend states
  const [isBackendOnline, setIsBackendOnline] = useState(false);
  const [localPluginCount, setLocalPluginCount] = useState(0);
  
  // Custom tracking states
  const [favorites, setFavorites] = useState([]);
  const [downloadsQueue, setDownloadsQueue] = useState([]);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'

  const itemsPerPage = viewMode === 'grid' ? 12 : 25;

  // Load data on mount
  const loadData = () => {
    import('./data/rutracker_plugins.json')
      .then((module) => {
        if (module.default && module.default.length > 0) {
          setPlugins(module.default);
          setDbState('Scraped');
          console.log(`Loaded ${module.default.length} scraped items.`);
        } else {
          setPlugins(mockData);
          setDbState('Mock');
          console.log('Scraped database is empty. Loaded mock data.');
        }
      })
      .catch((err) => {
        setPlugins(mockData);
        setDbState('Mock');
        console.log('Scraped database not found. Loaded mock data.');
      });
  };

  useEffect(() => {
    loadData();
    // Load favorites from local storage
    const storedFavs = localStorage.getItem('vibetracker_favorites');
    if (storedFavs) {
      setFavorites(JSON.parse(storedFavs));
    }
    // Load downloads queue
    const storedDownloads = localStorage.getItem('vibetracker_downloads');
    if (storedDownloads) {
      setDownloadsQueue(JSON.parse(storedDownloads));
    }
  }, []);

  // Pluggen backend health check & local plugin count
  const checkBackendHealth = useCallback(async () => {
    try {
      const res = await fetch(`${LOCAL_API_BASE}/api/health`);
      if (res.ok) {
        setIsBackendOnline(true);
        // Fetch local plugin count
        const countRes = await fetch(`${LOCAL_API_BASE}/api/plugins/count`);
        if (countRes.ok) {
          const countData = await countRes.json();
          setLocalPluginCount(countData.count);
        }
      } else {
        setIsBackendOnline(false);
        setLocalPluginCount(0);
      }
    } catch (err) {
      setIsBackendOnline(false);
      setLocalPluginCount(0);
    }
  }, []);


  useEffect(() => {
    checkBackendHealth();
    const interval = setInterval(checkBackendHealth, 5000);
    return () => clearInterval(interval);
  }, [checkBackendHealth]);

  // Toggle Favorite
  const toggleFavorite = (id) => {
    setFavorites((prev) => {
      const newFavs = prev.includes(id)
        ? prev.filter((favId) => favId !== id)
        : [...prev, id];
      localStorage.setItem('vibetracker_favorites', JSON.stringify(newFavs));
      return newFavs;
    });
  };

  // Add to downloads queue
  const addToDownloads = (id) => {
    setDownloadsQueue((prev) => {
      if (prev.includes(id)) return prev;
      const newDownloads = [...prev, id];
      localStorage.setItem('vibetracker_downloads', JSON.stringify(newDownloads));
      return newDownloads;
    });
  };

  // Reset other filters when switching tabs
  useEffect(() => {
    setFormatFilter('All');
    setDeveloperSearch('');
    setPluginFunctionFilter('All');
    setSampleTypeFilter('All');
    setCurrentPage(1);
  }, [activeTab]);

  // Filter and sort plugins
  useEffect(() => {
    let result = [...plugins];

    // 1. Tab Navigation Filter
    if (activeTab === 'Favorites') {
      result = result.filter((p) => favorites.includes(p.id));
    } else if (activeTab === 'Downloads') {
      result = result.filter((p) => downloadsQueue.includes(p.id));
    } else {
      result = result.filter((p) => p.category === activeTab);
    }

    // 2. Search Query Filter
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          (p.title && p.title.toLowerCase().includes(q)) ||
          (p.developer && p.developer.toLowerCase().includes(q)) ||
          (p.rawTitle && p.rawTitle.toLowerCase().includes(q))
      );
    }

    // 3. Developer / Company Filter
    if (developerSearch.trim() !== '') {
      const devQ = developerSearch.toLowerCase();
      result = result.filter(
        (p) => p.developer && p.developer.toLowerCase().includes(devQ)
      );
    }

    // 4. Plugin Function Filter (only when tab is Plugins, Favorites, or Downloads)
    if (pluginFunctionFilter !== 'All') {
      result = result.filter((p) => {
        const func = getPluginFunction(p.title, p.rawTitle);
        return func.id === pluginFunctionFilter;
      });
    }

    // 5. Sample Type Filter (only when tab is Sample Packs, Favorites, or Downloads)
    if (sampleTypeFilter !== 'All') {
      result = result.filter((p) => {
        const sType = getSampleType(p.title, p.rawTitle);
        return sType.id === sampleTypeFilter;
      });
    }

    // 6. OS Filter
    if (osFilter !== 'All') {
      result = result.filter((p) => p.os && p.os.includes(osFilter));
    }

    // 7. Format Filter
    if (formatFilter !== 'All') {
      result = result.filter(
        (p) => p.formats && p.formats.some((f) => f.toLowerCase() === formatFilter.toLowerCase())
      );
    }

    // 8. Sorting
    result.sort((a, b) => {
      if (sortOption === 'seeds-desc') return b.seeders - a.seeders;
      if (sortOption === 'seeds-asc') return a.seeders - b.seeders;
      
      if (sortOption === 'leeches-desc') return b.leechers - a.leechers;
      if (sortOption === 'leeches-asc') return a.leechers - b.leechers;
      
      if (sortOption === 'size-desc') return parseSize(b.size) - parseSize(a.size);
      if (sortOption === 'size-asc') return parseSize(a.size) - parseSize(b.size);
      
      if (sortOption === 'name-asc') return (a.title || a.rawTitle).localeCompare(b.title || b.rawTitle);
      if (sortOption === 'name-desc') return (b.title || b.rawTitle).localeCompare(a.title || a.rawTitle);
      
      if (sortOption === 'dev-asc') return (a.developer || '').localeCompare(b.developer || '');
      if (sortOption === 'dev-desc') return (b.developer || '').localeCompare(a.developer || '');
      
      if (sortOption === 'format-asc') {
        const fmtA = a.formats ? a.formats.join(', ') : '';
        const fmtB = b.formats ? b.formats.join(', ') : '';
        return fmtA.localeCompare(fmtB);
      }
      if (sortOption === 'format-desc') {
        const fmtA = a.formats ? a.formats.join(', ') : '';
        const fmtB = b.formats ? b.formats.join(', ') : '';
        return fmtB.localeCompare(fmtA);
      }
      
      if (sortOption === 'date-desc') return (b.date || '').localeCompare(a.date || '');
      if (sortOption === 'date-asc') return (a.date || '').localeCompare(b.date || '');

      return 0; // keeps the original order (newest first)
    });

    setFilteredPlugins(result);
    setCurrentPage(1); // Reset page on filter change
  }, [plugins, activeTab, searchQuery, osFilter, formatFilter, sortOption, developerSearch, pluginFunctionFilter, sampleTypeFilter, favorites, downloadsQueue]);

  // Helper to parse size strings
  const parseSize = (sizeStr) => {
    if (!sizeStr) return 0;
    const clean = sizeStr.replace(/\s+/g, '').replace(',', '.').toUpperCase();
    const val = parseFloat(clean);
    if (clean.includes('GB')) return val * 1024 * 1024 * 1024;
    if (clean.includes('MB')) return val * 1024 * 1024;
    if (clean.includes('KB')) return val * 1024;
    return val;
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredPlugins.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredPlugins.slice(indexOfFirstItem, indexOfLastItem);

  // Statistics calculations
  const stats = {
    totalScraped: dbState === 'Scraped' ? plugins.length : 0,
    pluginsTotal: plugins.filter((p) => p.category === 'Plugins').length,
    samplesTotal: plugins.filter((p) => p.category === 'Sample Packs').length,
    favoritesTotal: favorites.length,
    downloadsTotal: downloadsQueue.length,
    localPluginsTotal: localPluginCount
  };

  const pluginFunctions = [
    { id: 'synth', label: 'Synths', icon: '🎹' },
    { id: 'reverb', label: 'Reverbs', icon: '🌌' },
    { id: 'delay', label: 'Delays', icon: '⏳' },
    { id: 'eq', label: 'EQs & Filters', icon: '🎚️' },
    { id: 'compressor', label: 'Dynamics', icon: '🗜️' },
    { id: 'distortion', label: 'Distortion', icon: '⚡' },
    { id: 'vocal', label: 'Vocal FX', icon: '🗣️' },
    { id: 'modulation', label: 'Modulation', icon: '🌀' }
  ];

  const sampleTypes = [
    { id: 'drums', label: 'Drums', icon: '🥁' },
    { id: 'kicks', label: 'Kicks', icon: '🦶' },
    { id: 'loops', label: 'Loops', icon: '🔄' },
    { id: 'one-shots', label: 'One-Shots', icon: '🎯' },
    { id: 'vocals', label: 'Vocals', icon: '🎤' },
    { id: 'presets', label: 'Synth Presets', icon: '🎛️' },
    { id: 'melodies', label: 'MIDI / Melodies', icon: '🎼' },
    { id: 'fx', label: 'FX / Cinematic', icon: '💥' }
  ];

  return (
    <div className="app-layout">
      <Sidebar 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        osFilter={osFilter}
        setOsFilter={setOsFilter}
        formatFilter={formatFilter}
        setFormatFilter={setFormatFilter}
        developerSearch={developerSearch}
        setDeveloperSearch={setDeveloperSearch}
        plugins={plugins}
        stats={stats}
        onOpenSettings={() => setShowSettings(true)}
        isBackendOnline={isBackendOnline}
      />

      {/* Main Content Area */}
      <main className="main-content">

        {['Local Library', 'AI Assistant', 'Pluggen Settings'].includes(activeTab) ? (
          <div style={{ padding: '24px 32px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!isBackendOnline && activeTab !== 'Pluggen Settings' ? (
              /* Beautiful offline fallback screen */
              <div className="flex-col align-center justify-center text-center" style={{ height: '80%', padding: '40px' }}>
                <div style={{ fontSize: '48px', marginBottom: '20px', filter: 'drop-shadow(0 0 10px rgba(223,177,91,0.2))' }}>🔌</div>
                <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold', marginBottom: '10px' }}>Pluggen Backend is Offline</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '440px', margin: '0 auto 24px auto', lineHeight: '1.6' }}>
                  The local plugin scanner server is not running on port 3001. Start the backend server to access your local plugin library and AI Assistant.
                </p>
                <div style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '16px 20px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: 'var(--text-secondary)',
                  textAlign: 'left',
                  maxWidth: '440px',
                  margin: '0 auto 24px auto',
                  lineHeight: '1.5'
                }}>
                  <div style={{ color: 'var(--accent-gold)', fontWeight: 'bold', marginBottom: '8px' }}>How to start the server:</div>
                  1. Open terminal in <span style={{ color: '#fff' }}>C:\pluggen</span><br />
                  2. Run: <span style={{ color: '#fff' }}>dev.bat</span><br />
                  <span style={{ color: 'var(--text-muted)' }}>— OR —</span><br />
                  1. Open terminal in <span style={{ color: '#fff' }}>C:\pluggen\server</span><br />
                  2. Run: <span style={{ color: '#fff' }}>node server.js</span>
                </div>
                <div className="flex-row" style={{ gap: '10px', justifyContent: 'center' }}>
                  <button className="sync-btn" onClick={checkBackendHealth} style={{ borderRadius: '8px', padding: '10px 24px' }}>
                    ⚡ Retry Connection
                  </button>
                  <button className="settings-trigger-btn" onClick={() => setActiveTab('Pluggen Settings')} style={{ width: 'auto', padding: '10px 24px', margin: 0 }}>
                    ⚙ Go to Settings
                  </button>
                </div>
              </div>
            ) : activeTab === 'Local Library' ? (
              <LocalLibrary isBackendOnline={isBackendOnline} />
            ) : activeTab === 'AI Assistant' ? (
              <LocalAssistant isBackendOnline={isBackendOnline} onGoToSettings={() => setActiveTab('Pluggen Settings')} />
            ) : (
              <LocalSettings isBackendOnline={isBackendOnline} />
            )}
          </div>
        ) : (
          <>
            {/* Header Bar */}
            <header className="main-header">
              <div className="search-bar-container">
                <span className="search-bar-icon">🔍</span>
                <input 
                  type="text" 
                  className="search-bar-input" 
                  placeholder={`Search in ${activeTab.toLowerCase()}...`} 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="header-actions">
                {/* Sort Dropdown */}
                <div className="dropdown-wrapper">
                  <span className="dropdown-label">Sort:</span>
                  <select 
                    className="header-dropdown"
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value)}
                  >
                    <option value="date-desc">Date Added (Newest)</option>
                    <option value="date-asc">Date Added (Oldest)</option>
                    <option value="name-asc">Name (A-Z)</option>
                    <option value="name-desc">Name (Z-A)</option>
                    <option value="dev-asc">Developer (A-Z)</option>
                    <option value="dev-desc">Developer (Z-A)</option>
                    <option value="seeds-desc">Seeds (High to Low)</option>
                    <option value="seeds-asc">Seeds (Low to High)</option>
                    <option value="leeches-desc">Leeches (High to Low)</option>
                    <option value="leeches-asc">Leeches (Low to High)</option>
                    <option value="size-desc">Size (Large to Small)</option>
                    <option value="size-asc">Size (Small to Large)</option>
                  </select>
                </div>

                {/* View Mode Toggle */}
                <div className="view-mode-toggle">
                  <button 
                    className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                    onClick={() => setViewMode('grid')}
                    title="Grid Racks View"
                  >
                    ☷ Grid
                  </button>
                  <button 
                    className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                    onClick={() => setViewMode('list')}
                    title="Table List View"
                  >
                    ☰ List
                  </button>
                </div>

                {/* Sync Database Button */}
                <button className="sync-btn" onClick={() => setShowSettings(true)}>
                  ⚡ Sync
                </button>
              </div>
            </header>

            {/* Dynamic Category Pill Filters (Spotify/Splice style) */}
            {(activeTab === 'Plugins' || activeTab === 'Sample Packs' || activeTab === 'Favorites' || activeTab === 'Downloads') && (
              <div className="category-tag-row">
                <button 
                  className={`tag-pill ${pluginFunctionFilter === 'All' && sampleTypeFilter === 'All' ? 'active' : ''}`}
                  onClick={() => {
                    setPluginFunctionFilter('All');
                    setSampleTypeFilter('All');
                  }}
                >
                  All Genres/Types
                </button>
                
                {/* Render Plugin categories */}
                {(activeTab === 'Plugins' || activeTab === 'Favorites' || activeTab === 'Downloads') && 
                  pluginFunctions.map(item => {
                    const isSelected = pluginFunctionFilter === item.id;
                    return (
                      <button 
                        key={item.id}
                        className={`tag-pill ${isSelected ? 'active' : ''}`}
                        onClick={() => setPluginFunctionFilter(isSelected ? 'All' : item.id)}
                      >
                        {item.icon} {item.label}
                      </button>
                    );
                  })
                }

                {/* Render Sample Pack categories */}
                {(activeTab === 'Sample Packs') && 
                  sampleTypes.map(item => {
                    const isSelected = sampleTypeFilter === item.id;
                    return (
                      <button 
                        key={item.id}
                        className={`tag-pill ${isSelected ? 'active' : ''}`}
                        onClick={() => setSampleTypeFilter(isSelected ? 'All' : item.id)}
                      >
                        {item.icon} {item.label}
                      </button>
                    );
                  })
                }
              </div>
            )}

            {/* Content Explorer Grid or List */}
            <div className="content-explorer">
              {currentItems.length > 0 ? (
                viewMode === 'grid' ? (
                  /* Redesigned grid card view */
                  <div className="modern-grid">
                    {currentItems.map((item) => (
                      <PluginCard 
                        key={item.id} 
                        plugin={item} 
                        isFavorite={favorites.includes(item.id)}
                        onToggleFavorite={() => toggleFavorite(item.id)}
                        onDownload={() => addToDownloads(item.id)}
                      />
                    ))}
                  </div>
                ) : (
                  /* Elegant, table list view */
                  <div className="modern-table-wrapper">
                    <table className="modern-table">
                      <thead>
                        <tr>
                          <th onClick={() => setSortOption(sortOption === 'name-asc' ? 'name-desc' : 'name-asc')}>Name</th>
                          <th onClick={() => setSortOption(sortOption === 'dev-asc' ? 'dev-desc' : 'dev-asc')}>Developer</th>
                          <th onClick={() => setSortOption(sortOption === 'format-asc' ? 'format-desc' : 'format-asc')}>Format</th>
                          <th onClick={() => setSortOption(sortOption === 'size-desc' ? 'size-asc' : 'size-desc')}>Size</th>
                          <th onClick={() => setSortOption(sortOption === 'seeds-desc' ? 'seeds-asc' : 'seeds-desc')}>Seeds</th>
                          <th onClick={() => setSortOption(sortOption === 'leeches-desc' ? 'leeches-asc' : 'leeches-desc')}>Leeches</th>
                          <th onClick={() => setSortOption(sortOption === 'date-desc' ? 'date-asc' : 'date-desc')}>Date Added</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentItems.map((item) => {
                          const isFav = favorites.includes(item.id);
                          const classification = item.category === 'Plugins'
                            ? getPluginFunction(item.title, item.rawTitle)
                            : getSampleType(item.title, item.rawTitle);
                          return (
                            <tr 
                              key={item.id}
                              className="modern-tr-row"
                              onDoubleClick={() => {
                                if (item.downloadUrl) {
                                  window.open(item.downloadUrl, '_blank');
                                  addToDownloads(item.id);
                                }
                              }}
                            >
                              <td className="cell-name-title">
                                <button 
                                  className={`row-star-btn ${isFav ? 'active' : ''}`}
                                  onClick={() => toggleFavorite(item.id)}
                                >
                                  ★
                                </button>
                                <span className="row-title-text" title={item.rawTitle}>
                                  {item.title || item.rawTitle}
                                </span>
                                <span className="row-badge-pill">
                                  {classification.icon} {classification.label}
                                </span>
                              </td>
                              <td className="cell-creator">{item.developer}</td>
                              <td className="cell-formats-text">
                                {item.formats ? item.formats.slice(0, 3).join(', ') : 'WAV'}
                              </td>
                              <td className="cell-size-text">{item.size}</td>
                              <td className="cell-seeds-text text-green">{item.seeders}</td>
                              <td className="cell-leechers-text text-red">{item.leechers}</td>
                              <td className="cell-date-text">{item.date ? item.date.split(' ')[0] : '-'}</td>
                              <td className="cell-actions-btns">
                                {item.downloadUrl && (
                                  <a 
                                    href={item.downloadUrl} 
                                    className="row-action-btn download"
                                    onClick={() => addToDownloads(item.id)}
                                    title="Download .torrent"
                                  >
                                    ↓ Download
                                  </a>
                                )}
                                <a 
                                  href={item.topicUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="row-action-btn thread"
                                  title="Open Thread"
                                >
                                  💬 Thread
                                </a>
                                <a 
                                  href={`https://duckduckgo.com/?q=!ducky+${encodeURIComponent(item.developer + ' ' + (item.title || item.rawTitle))}`}
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="row-action-btn product-site"
                                  title="Visit Manufacturer Site"
                                >
                                  🌐 Site
                                </a>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                /* Modern Empty State */
                <div className="modern-empty-state">
                  <span className="empty-state-symbol">🔍</span>
                  <h3>No items match your active filters</h3>
                  <p>Try resetting your tags, query search, or sync the database with RuTracker.</p>
                  <button className="sync-btn-large" onClick={() => setShowSettings(true)}>
                    Sync Database
                  </button>
                </div>
              )}
            </div>

            {/* Dashboard Pagination */}
            {totalPages > 1 && (
              <div className="modern-pagination">
                <button 
                  className="pagination-arrow-btn"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  ◀ Previous
                </button>
                <span className="pagination-text-info">
                  Page <strong>{currentPage}</strong> of {totalPages}
                </span>
                <button 
                  className="pagination-arrow-btn"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Next ▶
                </button>
              </div>
            )}
          </>
        )}
      </main>



      {/* Settings Modal */}
      {showSettings && (
        <Settings 
          onClose={() => setShowSettings(false)} 
          onScrapeSuccess={() => {
            loadData();
          }}
        />
      )}
    </div>
  );
}
