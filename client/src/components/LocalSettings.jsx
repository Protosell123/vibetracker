import React, { useState, useEffect, useCallback } from 'react';

export default function LocalSettings({ isBackendOnline }) {
  const [scanPaths, setScanPaths] = useState([]);
  const [newScanPath, setNewScanPath] = useState('');
  const [excludedFolders, setExcludedFolders] = useState([]);
  const [newExcludedFolder, setNewExcludedFolder] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isApiKeyConfigured, setIsApiKeyConfigured] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Fetch all settings
  const fetchSettings = useCallback(async () => {
    if (!isBackendOnline) return;

    try {
      // 1. Fetch scan paths
      const pathsRes = await fetch('/api/scan-paths?type=plugin');
      if (pathsRes.ok) {
        const data = await pathsRes.json();
        setScanPaths(data);
      }

      // 2. Fetch excluded folders
      const exclRes = await fetch('/api/excluded-folders');
      if (exclRes.ok) {
        const data = await exclRes.json();
        setExcludedFolders(data);
      }

      // 3. Fetch key status
      const keyStatusRes = await fetch('/api/ai/key-status');
      if (keyStatusRes.ok) {
        const data = await keyStatusRes.json();
        setIsApiKeyConfigured(data.configured);
      }

      // 4. Fetch actual key if configured (to allow editing it)
      const keyRes = await fetch('/api/settings/anthropic_api_key');
      if (keyRes.ok) {
        const data = await keyRes.json();
        if (data.value) {
          setApiKey(data.value);
        }
      }
    } catch (err) {
      console.error('Error fetching Pluggen settings:', err);
    }
  }, [isBackendOnline]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Add scan path
  const handleAddScanPath = async (e) => {
    e.preventDefault();
    if (!newScanPath.trim() || !isBackendOnline) return;

    try {
      const res = await fetch('/api/scan-paths', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'plugin', path: newScanPath.trim() })
      });
      if (res.ok) {
        setNewScanPath('');
        fetchSettings();
        showStatus('Scan path added successfully.', 'success');
      } else {
        const data = await res.json();
        showStatus(data.error || 'Failed to add scan path.', 'error');
      }
    } catch (err) {
      showStatus('Network error occurred.', 'error');
    }
  };

  // Delete scan path
  const handleDeleteScanPath = async (id) => {
    if (!isBackendOnline) return;

    try {
      const res = await fetch(`/api/scan-paths/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchSettings();
        showStatus('Scan path removed.', 'success');
      } else {
        showStatus('Failed to remove scan path.', 'error');
      }
    } catch (err) {
      showStatus('Network error occurred.', 'error');
    }
  };

  // Add excluded folder
  const handleAddExcludedFolder = async (e) => {
    e.preventDefault();
    if (!newExcludedFolder.trim() || !isBackendOnline) return;

    try {
      const res = await fetch('/api/excluded-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: newExcludedFolder.trim() })
      });
      if (res.ok) {
        setNewExcludedFolder('');
        fetchSettings();
        showStatus('Excluded folder added successfully.', 'success');
      } else {
        const data = await res.json();
        showStatus(data.error || 'Failed to add excluded folder.', 'error');
      }
    } catch (err) {
      showStatus('Network error occurred.', 'error');
    }
  };

  // Delete excluded folder
  const handleDeleteExcludedFolder = async (id) => {
    if (!isBackendOnline) return;

    try {
      const res = await fetch(`/api/excluded-folders/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchSettings();
        showStatus('Excluded folder removed.', 'success');
      } else {
        showStatus('Failed to remove excluded folder.', 'error');
      }
    } catch (err) {
      showStatus('Network error occurred.', 'error');
    }
  };

  // Save API Key
  const handleSaveApiKey = async (e) => {
    e.preventDefault();
    if (!isBackendOnline) return;

    setIsSavingKey(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'anthropic_api_key', value: apiKey.trim() || null })
      });
      if (res.ok) {
        fetchSettings();
        showStatus('Anthropic API key updated successfully.', 'success');
      } else {
        showStatus('Failed to save API key.', 'error');
      }
    } catch (err) {
      showStatus('Network error occurred.', 'error');
    } finally {
      setIsSavingKey(false);
    }
  };

  // Show status indicator toast
  const showStatus = (text, type) => {
    setStatusMessage({ text, type });
    setTimeout(() => {
      setStatusMessage(null);
    }, 4000);
  };

  return (
    <div className="local-settings-container flex-col" style={{ height: '100%', overflowY: 'auto', paddingBottom: '30px' }}>
      {/* Header */}
      <div className="flex-col" style={{ marginBottom: '24px', shrink: 0 }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>Pluggen Scanner Settings</h2>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          Configure scanning paths, exclusions, and Claude AI Assistant credentials for your local machine
        </span>
      </div>

      {/* Offline Alert */}
      {!isBackendOnline && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: 'var(--accent-red)',
          fontSize: '12px',
          marginBottom: '20px',
          lineHeight: '1.5'
        }}>
          ⚠️ <strong>Pluggen Backend is Offline:</strong> The backend server is not running on port 3001. Settings cannot be loaded or saved. Please start the server.
        </div>
      )}

      {/* Global Status Toast */}
      {statusMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          padding: '12px 20px',
          borderRadius: '8px',
          backgroundColor: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${statusMessage.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)'}`,
          color: statusMessage.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)',
          fontSize: '12px',
          fontWeight: '500',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          zIndex: 1000
        }}>
          {statusMessage.text}
        </div>
      )}

      {/* Cards Container */}
      <div className="flex-col" style={{ gap: '20px' }}>
        
        {/* 1. Scan Paths Settings Card */}
        <div className="settings-section-card" style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '24px'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--accent-gold)', marginBottom: '6px' }}>
            📂 Plugin Scan Directories
          </h3>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.4' }}>
            Specify the folder paths on your local drive where the scanner searches for VST3, VST2, CLAP, or AU files.
          </p>

          {/* Paths list */}
          <div className="flex-col" style={{ gap: '8px', marginBottom: '16px' }}>
            {scanPaths.length > 0 ? (
              scanPaths.map((p) => (
                <div key={p.id} className="flex-row align-center justify-between" style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}>
                  <span style={{ color: '#fff', fontFamily: 'monospace', wordBreak: 'break-all' }}>{p.path}</span>
                  <button 
                    className="dev-tag-pill"
                    onClick={() => handleDeleteScanPath(p.id)}
                    style={{ color: 'var(--accent-red)', borderColor: 'rgba(239, 68, 68, 0.15)', backgroundColor: 'transparent', padding: '4px 8px', borderRadius: '4px' }}
                    title="Remove scan path"
                  >
                    🗑️ Remove
                  </button>
                </div>
              ))
            ) : (
              <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', backgroundColor: 'var(--bg-input)', borderRadius: '8px' }}>
                No scan directories defined.
              </div>
            )}
          </div>

          {/* Add form */}
          <form onSubmit={handleAddScanPath} className="flex-row" style={{ gap: '10px' }}>
            <input 
              type="text"
              className="sidebar-search-input"
              placeholder="e.g. C:\Program Files\Common Files\VST3"
              value={newScanPath}
              onChange={(e) => setNewScanPath(e.target.value)}
              style={{ flexGrow: 1, margin: 0 }}
              required
            />
            <button type="submit" className="sync-btn" style={{ borderRadius: '8px', padding: '0 20px', height: '38px', shrink: 0 }}>
              + Add Path
            </button>
          </form>
        </div>

        {/* 2. Excluded Folders Card */}
        <div className="settings-section-card" style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '24px'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--accent-gold)', marginBottom: '6px' }}>
            🚫 Excluded Folders
          </h3>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.4' }}>
            Ignore specific subdirectories or libraries inside your plugin paths to speed up scans and avoid unwanted utility plugins.
          </p>

          {/* Excluded folders list */}
          <div className="flex-col" style={{ gap: '8px', marginBottom: '16px' }}>
            {excludedFolders.length > 0 ? (
              excludedFolders.map((p) => (
                <div key={p.id} className="flex-row align-center justify-between" style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}>
                  <span style={{ color: '#fff', fontFamily: 'monospace', wordBreak: 'break-all' }}>{p.path}</span>
                  <button 
                    className="dev-tag-pill"
                    onClick={() => handleDeleteExcludedFolder(p.id)}
                    style={{ color: 'var(--accent-red)', borderColor: 'rgba(239, 68, 68, 0.15)', backgroundColor: 'transparent', padding: '4px 8px', borderRadius: '4px' }}
                    title="Remove exclusion"
                  >
                    🗑️ Remove
                  </button>
                </div>
              ))
            ) : (
              <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', backgroundColor: 'var(--bg-input)', borderRadius: '8px' }}>
                No folder exclusions defined.
              </div>
            )}
          </div>

          {/* Add form */}
          <form onSubmit={handleAddExcludedFolder} className="flex-row" style={{ gap: '10px' }}>
            <input 
              type="text"
              className="sidebar-search-input"
              placeholder="e.g. C:\Program Files\Common Files\VST3\IgnoredSubfolder"
              value={newExcludedFolder}
              onChange={(e) => setNewExcludedFolder(e.target.value)}
              style={{ flexGrow: 1, margin: 0 }}
              required
            />
            <button type="submit" className="sync-btn" style={{ borderRadius: '8px', padding: '0 20px', height: '38px', shrink: 0 }}>
              + Exclude
            </button>
          </form>
        </div>

        {/* 3. AI Claude Credentials Card */}
        <div className="settings-section-card" style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '24px'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--accent-gold)', marginBottom: '6px' }}>
            ✨ Claude AI Assistant Configuration
          </h3>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.4' }}>
            Pluggen Assistant uses Anthropic's Claude to analyze your scanned plugin catalog and suggest setup advice.
          </p>

          <form onSubmit={handleSaveApiKey} className="flex-col" style={{ gap: '12px' }}>
            <div className="form-group flex-col" style={{ gap: '6px' }}>
              <div className="flex-row align-center justify-between">
                <label className="form-label" style={{ margin: 0 }}>Anthropic API Key</label>
                <span style={{
                  fontSize: '10px',
                  fontWeight: '600',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: isApiKeyConfigured ? 'rgba(16, 185, 129, 0.1)' : 'rgba(223, 177, 91, 0.1)',
                  color: isApiKeyConfigured ? 'var(--accent-green)' : 'var(--accent-gold)'
                }}>
                  {isApiKeyConfigured ? '✓ Configured' : '⚠ Missing API Key'}
                </span>
              </div>
              <input 
                type="password"
                className="sidebar-search-input"
                placeholder="sk-ant-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{ margin: 0 }}
              />
            </div>

            <button 
              type="submit" 
              className="sync-btn-large" 
              disabled={isSavingKey}
              style={{ width: '100%', margin: '6px 0 0 0', padding: '10px 0', borderRadius: '8px' }}
            >
              {isSavingKey ? 'Saving Key...' : '💾 Save API Key'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
