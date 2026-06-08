import React, { useMemo } from 'react';

export default function Sidebar({ 
  activeTab,
  setActiveTab,
  osFilter, 
  setOsFilter, 
  formatFilter,
  setFormatFilter,
  developerSearch,
  setDeveloperSearch,
  plugins,
  stats, 
  onOpenSettings,
  isBackendOnline
}) {
  const formats = activeTab === 'Plugins' 
    ? ['All', 'VST3', 'VST', 'AU', 'AAX', 'CLAP', 'Kontakt', 'Standalone']
    : ['All', 'WAV', 'MIDI', 'AIFF', 'Multiformat', 'REX2', 'SFZ', 'FLP'];

  // Compute top developers for active tab
  const popularDevelopers = useMemo(() => {
    if (!plugins || plugins.length === 0) return [];
    
    const counts = {};
    plugins
      .filter(p => p.category === (activeTab === 'Favorites' || activeTab === 'Downloads' ? 'Plugins' : activeTab))
      .forEach(p => {
        const dev = p.developer || 'Unknown';
        if (dev !== 'Unknown' && dev.trim() !== '') {
          counts[dev] = (counts[dev] || 0) + 1;
        }
      });
      
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(entry => entry[0]);
  }, [plugins, activeTab]);

  return (
    <aside className="app-sidebar">
      {/* Brand Logo */}
      <div className="brand">
        <span className="brand-logo">🍊</span>
        <span className="brand-name">VibeTracker</span>
      </div>

      {/* Navigation section */}
      <div className="sidebar-section">
        <h3 className="section-title">Navigation</h3>
        <ul className="nav-list">
          <li 
            className={`nav-item ${activeTab === 'Plugins' ? 'active' : ''}`}
            onClick={() => setActiveTab('Plugins')}
          >
            <span className="nav-icon">🎛️</span>
            <span className="nav-text">Audio Plugins</span>
            <span className="nav-count">{stats.pluginsTotal}</span>
          </li>
          
          <li 
            className={`nav-item ${activeTab === 'Sample Packs' ? 'active' : ''}`}
            onClick={() => setActiveTab('Sample Packs')}
          >
            <span className="nav-icon">🥁</span>
            <span className="nav-text">Sample Packs</span>
            <span className="nav-count">{stats.samplesTotal}</span>
          </li>
          
          <li 
            className={`nav-item ${activeTab === 'Favorites' ? 'active' : ''}`}
            onClick={() => setActiveTab('Favorites')}
          >
            <span className="nav-icon">★</span>
            <span className="nav-text">Favorites</span>
            <span className="nav-count">{stats.favoritesTotal}</span>
          </li>

          <li 
            className={`nav-item ${activeTab === 'Downloads' ? 'active' : ''}`}
            onClick={() => setActiveTab('Downloads')}
          >
            <span className="nav-icon">📥</span>
            <span className="nav-text">Downloads Queue</span>
            {stats.downloadsTotal > 0 && (
              <span className="nav-count-active">{stats.downloadsTotal}</span>
            )}
          </li>
        </ul>
      </div>

      {/* Local Pluggen Section */}
      <div className="sidebar-section">
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 className="section-title" style={{ margin: 0 }}>Local Pluggen</h3>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isBackendOnline ? 'var(--accent-green)' : 'var(--accent-red)',
            display: 'inline-block',
            boxShadow: isBackendOnline ? '0 0 6px var(--accent-green)' : '0 0 6px var(--accent-red)',
            transition: 'all 0.3s'
          }} title={isBackendOnline ? "Pluggen Server is Online" : "Pluggen Server is Offline"} />
        </div>
        <ul className="nav-list">
          <li 
            className={`nav-item ${activeTab === 'Local Library' ? 'active' : ''}`}
            onClick={() => setActiveTab('Local Library')}
          >
            <span className="nav-icon">🏛️</span>
            <span className="nav-text">Local Library</span>
            {isBackendOnline && stats.localPluginsTotal > 0 && (
              <span className="nav-count">{stats.localPluginsTotal}</span>
            )}
          </li>
          
          <li 
            className={`nav-item ${activeTab === 'AI Assistant' ? 'active' : ''}`}
            onClick={() => setActiveTab('AI Assistant')}
          >
            <span className="nav-icon">✨</span>
            <span className="nav-text">AI Assistant</span>
          </li>
          
          <li 
            className={`nav-item ${activeTab === 'Pluggen Settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('Pluggen Settings')}
          >
            <span className="nav-icon">⚙️</span>
            <span className="nav-text">Pluggen Settings</span>
          </li>
        </ul>
      </div>

      {/* OS Filter Section */}
      <div className="sidebar-section">
        <h3 className="section-title">OS Compatibility</h3>
        <div className="platform-toggle-group">
          <button 
            className={`platform-btn ${osFilter === 'All' ? 'active' : ''}`}
            onClick={() => setOsFilter('All')}
          >
            All
          </button>
          <button 
            className={`platform-btn ${osFilter === 'Windows' ? 'active' : ''}`}
            onClick={() => setOsFilter('Windows')}
          >
            Windows
          </button>
          <button 
            className={`platform-btn ${osFilter === 'macOS' ? 'active' : ''}`}
            onClick={() => setOsFilter('macOS')}
          >
            macOS
          </button>
        </div>
      </div>

      {/* Format Filter Section */}
      <div className="sidebar-section">
        <h3 className="section-title">Format Filter</h3>
        <div className="select-wrapper">
          <select 
            className="custom-select" 
            value={formatFilter} 
            onChange={(e) => setFormatFilter(e.target.value)}
          >
            {formats.map(fmt => (
              <option key={fmt} value={fmt}>{fmt === 'All' ? 'All Formats' : fmt}</option>
            ))}
          </select>
          <span className="select-arrow">▼</span>
        </div>
      </div>

      {/* Company / Developer Search */}
      <div className="sidebar-section">
        <h3 className="section-title">Developer / Company</h3>
        <input 
          type="text"
          className="sidebar-search-input"
          placeholder="Search creator..."
          value={developerSearch}
          onChange={(e) => setDeveloperSearch(e.target.value)}
        />
        
        {popularDevelopers.length > 0 && (
          <div className="popular-tags-grid">
            {popularDevelopers.map(dev => {
              const isActive = developerSearch.toLowerCase() === dev.toLowerCase();
              return (
                <button 
                  key={dev}
                  className={`dev-tag-pill ${isActive ? 'active' : ''}`}
                  onClick={() => setDeveloperSearch(isActive ? '' : dev)}
                >
                  {dev}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Cookie Settings button at bottom */}
      <div className="sidebar-footer">
        <button className="settings-trigger-btn" onClick={onOpenSettings}>
          ⚙ Cookie Settings
        </button>
        <div className="db-stats">
          <span>DB Status: </span>
          <strong className="status-scraped">SCRAPED</strong>
          <span className="stats-divider">|</span>
          <span>{stats.totalScraped} items</span>
        </div>
      </div>
    </aside>
  );
}
