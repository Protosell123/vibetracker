import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LOCAL_API_BASE } from '../utils/api.js';

export default function LocalLibrary({ isBackendOnline }) {
  const [plugins, setPlugins] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('display_name:asc');
  const [scanStatus, setScanStatus] = useState(null);
  const [selectedPlugin, setSelectedPlugin] = useState(null);
  
  // Edit Form state
  const [editName, setEditName] = useState('');
  const [editVendor, setEditVendor] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const pollRef = useRef(null);

  // Load plugins from backend
  const loadPlugins = useCallback(async () => {
    if (!isBackendOnline) return;
    const [sortCol, sortDir] = sortOption.split(':');
    const params = new URLSearchParams({ search: searchQuery, sort: sortCol, order: sortDir });
    try {
      const res = await fetch(`${LOCAL_API_BASE}/api/plugins?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPlugins(data);
      }
    } catch (err) {
      console.error('Error fetching local plugins:', err);
    }
  }, [searchQuery, sortOption, isBackendOnline]);

  useEffect(() => {
    loadPlugins();
  }, [loadPlugins]);

  // Load details when a plugin is selected for editing
  useEffect(() => {
    if (selectedPlugin) {
      setEditName(selectedPlugin.display_name || selectedPlugin.filename || '');
      setEditVendor(selectedPlugin.vendor || '');
      setEditNotes(selectedPlugin.notes || '');
    }
  }, [selectedPlugin]);

  // Start polling scan status
  const startPolling = () => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${LOCAL_API_BASE}/api/scan/status`);
        if (res.ok) {
          const status = await res.json();
          setScanStatus(status);
          if (!status.running) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            if (status.done) loadPlugins();
          }
        }
      } catch (err) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 600);
  };

  const handleScan = async () => {
    try {
      const res = await fetch(`${LOCAL_API_BASE}/api/scan/plugins`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setScanStatus({ running: true, found: 0, current: '' });
          startPolling();
        }
      }
    } catch (err) {
      console.error('Error starting plugin scan:', err);
    }
  };

  const handleSaveDetails = async (e) => {
    e.preventDefault();
    if (!selectedPlugin) return;
    setIsSaving(true);
    try {
      const res = await fetch(`${LOCAL_API_BASE}/api/plugins/${selectedPlugin.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: editName,
          vendor: editVendor,
          notes: editNotes
        })
      });
      if (res.ok) {
        // Reload details and list
        const detailRes = await fetch(`${LOCAL_API_BASE}/api/plugins/${selectedPlugin.id}`);
        if (detailRes.ok) {
          const updated = await detailRes.json();
          setSelectedPlugin(updated);
        }
        loadPlugins();
      }
    } catch (err) {
      console.error('Error saving plugin details:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Export local library to CSV file
  const handleExportCSV = () => {
    if (plugins.length === 0) return;
    
    // Define headers
    const headers = ['Name', 'Vendor', 'Format', 'Size (MB)', 'Date Modified', 'File Path', 'Filename'];
    
    // Map rows
    const rows = plugins.map(p => {
      const sizeMB = p.file_size ? (p.file_size / (1024 * 1024)).toFixed(2) : '0';
      const dateStr = p.date_modified ? new Date(p.date_modified).toLocaleDateString() : '';
      return [
        `"${(p.display_name || p.filename).replace(/"/g, '""')}"`,
        `"${(p.vendor || '').replace(/"/g, '""')}"`,
        (p.format || '').toUpperCase(),
        sizeMB,
        dateStr,
        `"${p.path.replace(/"/g, '""')}"`,
        `"${p.filename.replace(/"/g, '""')}"`
      ];
    });

    // Combine
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    // Download trigger
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `pluggen-local-library-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fmtSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="local-library-container flex-col" style={{ height: '100%', overflow: 'hidden' }}>
      {/* Top Header Row */}
      <div className="flex-row justify-between align-center" style={{ marginBottom: '16px', shrink: 0 }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>Local Plugins Library</h2>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Scanned VST3, VST2, CLAP, and AU plugins on this computer
          </span>
        </div>

        <div className="flex-row" style={{ gap: '8px' }}>
          {plugins.length > 0 && (
            <button className="settings-trigger-btn" onClick={handleExportCSV} style={{ width: 'auto', padding: '8px 16px', margin: 0 }}>
              📥 Export CSV
            </button>
          )}

          <button 
            className="sync-btn" 
            onClick={handleScan}
            disabled={scanStatus?.running}
            style={{ borderRadius: '8px', padding: '8px 16px' }}
          >
            {scanStatus?.running ? 'Scanning...' : '🔍 Scan Local Plugins'}
          </button>
        </div>
      </div>

      {/* Scan Banner notification */}
      {scanStatus && (
        <div className={`scan-progress-banner ${scanStatus.running ? 'scanning' : scanStatus.done ? 'done' : 'error'}`} style={{
          padding: '10px 16px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'rgba(255,255,255,0.02)',
          fontSize: '12px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div className="flex-row align-center" style={{ gap: '8px' }}>
            {scanStatus.running && <span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px', margin: 0 }}></span>}
            <span>
              {scanStatus.running 
                ? `Scanning directories... Found ${scanStatus.found} plugins. Currently scanning: ${scanStatus.current}` 
                : scanStatus.done 
                  ? `Scan complete! Found ${scanStatus.found} local plugins.` 
                  : `Scan error: ${scanStatus.error}`
              }
            </span>
          </div>
          {!scanStatus.running && (
            <button onClick={() => setScanStatus(null)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>✕</button>
          )}
        </div>
      )}

      {/* Filter panel */}
      <div className="flex-row" style={{ gap: '10px', marginBottom: '16px', shrink: 0 }}>
        <input 
          type="text" 
          className="ableton-search-input" 
          placeholder="Filter local plugins..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flexGrow: 1 }}
        />
        
        <select 
          className="ableton-dropdown"
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value)}
          style={{ width: '160px' }}
        >
          <option value="display_name:asc">Name (A-Z)</option>
          <option value="display_name:desc">Name (Z-A)</option>
          <option value="vendor:asc">Vendor (A-Z)</option>
          <option value="vendor:desc">Vendor (Z-A)</option>
          <option value="format:asc">Format</option>
          <option value="file_size:desc">Largest Size</option>
        </select>
      </div>

      {/* Main split display: table list on left, edit metadata on right */}
      <div className="flex-row flex-grow" style={{ gap: '20px', overflow: 'hidden' }}>
        {/* Table list */}
        <div className="modern-table-wrapper flex-grow" style={{ overflow: 'auto', height: '100%' }}>
          <table className="modern-table">
            <thead>
              <tr>
                <th>Format</th>
                <th>Name</th>
                <th>Vendor</th>
                <th>File Size</th>
                <th>Path</th>
              </tr>
            </thead>
            <tbody>
              {plugins.length > 0 ? (
                plugins.map((p) => {
                  const isSel = selectedPlugin && selectedPlugin.id === p.id;
                  return (
                    <tr 
                      key={p.id} 
                      className={`modern-tr-row ${isSel ? 'active' : ''}`}
                      onClick={() => setSelectedPlugin(p)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <span className={`format-badge ${p.format}`} style={{
                          fontSize: '9px',
                          fontWeight: 'bold',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: p.format === 'vst3' ? 'rgba(0,204,204,0.1)' : 'rgba(212,175,55,0.1)',
                          color: p.format === 'vst3' ? 'var(--accent-cyan)' : 'var(--accent-gold)'
                        }}>
                          {(p.format || 'VST').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontWeight: '500' }}>{p.display_name || p.filename}</td>
                      <td>{p.vendor || 'Unknown'}</td>
                      <td>{fmtSize(p.file_size)}</td>
                      <td style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.path}>
                        {p.path}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    No local plugins found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Selected plugin editor sidebar */}
        {selectedPlugin && (
          <div className="editor-pane" style={{
            width: '320px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '20px',
            overflowY: 'auto',
            height: '100%',
            shrink: 0
          }}>
            <div className="flex-row justify-between align-center" style={{ marginBottom: '16px' }}>
              <h3 style={{ color: 'var(--accent-gold)', fontWeight: 'bold' }}>Plugin Metadata</h3>
              <button onClick={() => setSelectedPlugin(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px' }}>✕ Close</button>
            </div>

            <form onSubmit={handleSaveDetails} className="flex-col" style={{ gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Vendor / Creator</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={editVendor}
                  onChange={(e) => setEditVendor(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Personal Notes / Tags</label>
                <textarea 
                  className="form-input" 
                  rows="4"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add details like licensing, serial key, or usage tags..."
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              <div className="info-field-static" style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                <div><strong>Format:</strong> {selectedPlugin.format?.toUpperCase()}</div>
                <div><strong>Filename:</strong> {selectedPlugin.filename}</div>
                <div style={{ wordBreak: 'break-all' }}><strong>Path:</strong> {selectedPlugin.path}</div>
                <div><strong>Last Scanned:</strong> {new Date(selectedPlugin.updated_at || selectedPlugin.created_at).toLocaleString()}</div>
              </div>

              <button 
                type="submit" 
                className="sync-btn-large" 
                disabled={isSaving}
                style={{ width: '100%', margin: '10px 0 0 0', padding: '10px 0', borderRadius: '8px' }}
              >
                {isSaving ? 'Saving...' : '💾 Save Changes'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
