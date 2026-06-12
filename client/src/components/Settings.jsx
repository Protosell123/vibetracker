import React, { useState, useEffect, useRef } from 'react';
import { SCRAPER_API_BASE } from '../utils/api.js';

export default function Settings({ onClose, onScrapeSuccess }) {
  const [cookie, setCookie] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState('');
  const [status, setStatus] = useState('');
  
  const isLocalhost = window.location.hostname === 'localhost';
  const pollIntervalRef = useRef(null);
  const logConsoleRef = useRef(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logConsoleRef.current) {
      logConsoleRef.current.scrollTop = logConsoleRef.current.scrollHeight;
    }
  }, [logs]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Load the current cookie from the local API
    fetch(`${SCRAPER_API_BASE}/api/get-cookie`)
      .then(res => res.json())
      .then(data => {
        if (data.cookie) {
          setCookie(data.cookie);
        }
      })
      .catch(err => console.error('Error fetching cookie:', err));
  }, []);

  const handleSaveAndScrape = (e) => {
    e.preventDefault();
    if (!isLocalhost) return;

    setIsLoading(true);
    setLogs('');
    setStatus('Saving cookie and triggering scraper...');

    fetch(`${SCRAPER_API_BASE}/api/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ cookie: cookie.trim() })
    })
      .then(res => {
        if (!res.ok) {
          throw new Error(`Server returned status ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (data.success) {
          setStatus('Scraper running in background...');
          // Start polling status
          pollIntervalRef.current = setInterval(() => {
            fetch(`${SCRAPER_API_BASE}/api/scrape/status`)
              .then(statusRes => {
                if (!statusRes.ok) throw new Error('Failed to get status');
                return statusRes.json();
              })
              .then(statusData => {
                if (statusData.logs) {
                  setLogs(statusData.logs.join(''));
                }
                if (!statusData.running) {
                  clearInterval(pollIntervalRef.current);
                  setIsLoading(false);
                  if (statusData.done) {
                    setStatus('Scraper finished successfully!');
                    if (onScrapeSuccess) onScrapeSuccess();
                  } else if (statusData.error) {
                    setStatus(`Scraper failed: ${statusData.error}`);
                  } else {
                    setStatus('Scraper stopped.');
                  }
                }
              })
              .catch(err => {
                console.error('Error polling scraper status:', err);
              });
          }, 1000);
        } else {
          setIsLoading(false);
          setStatus('Failed to trigger scraper.');
          setLogs(data.error || 'Unknown error starting background process.');
        }
      })
      .catch(err => {
        setIsLoading(false);
        setStatus('Network error occurred.');
        setLogs(err.message);
      });
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">🎹 Scraper Settings</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        {!isLocalhost ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="warning-banner" style={{
              backgroundColor: 'rgba(223, 177, 91, 0.1)',
              border: '1px solid var(--accent-gold)',
              borderRadius: '12px',
              padding: '16px 20px',
              fontSize: '13px',
              lineHeight: '1.6',
              color: 'var(--text-secondary)'
            }}>
              <div style={{ color: 'var(--accent-gold)', fontWeight: 'bold', fontSize: '14px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚠️ Local Scraper Sync Only
              </div>
              <p style={{ margin: '0 0 12px 0' }}>
                Syncing the database downloads torrent listings from RuTracker and compiles them into a local file. This can only be executed when running the app locally on your PC.
              </p>
              <div style={{
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '12px 16px',
                fontSize: '12px',
                fontFamily: 'monospace',
                color: 'var(--text-secondary)',
                textAlign: 'left',
                lineHeight: '1.5'
              }}>
                1. Run <strong style={{ color: '#fff' }}>dev.bat</strong> locally on your machine.<br />
                2. Open Settings on <strong style={{ color: '#fff' }}>http://localhost:3000</strong>.<br />
                3. Run Scraper to sync the database.<br />
                4. Commit and push the updated <strong style={{ color: '#fff' }}>rutracker_plugins.json</strong> to GitHub to deploy online.
              </div>
            </div>
            <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : !isLoading && !logs ? (
          <form onSubmit={handleSaveAndScrape}>
            <div className="form-group">
              <label className="form-label">RuTracker bb_session Cookie</label>
              <input 
                type="text" 
                className="form-input" 
                value={cookie}
                onChange={(e) => setCookie(e.target.value)}
                placeholder="0-XXXXXXX-XXXXXXXXXXXXXXXXXXXX"
                required
              />
              <p className="help-text">
                To get the cookie: Log in to <a href="https://rutracker.org" target="_blank" rel="noopener noreferrer">rutracker.org</a> in your browser. Open DevTools (F12) &rarr; Application &rarr; Cookies &rarr; copy the value of <strong>bb_session</strong>.
              </p>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save & Run Scraper
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="progress-title">{status}</div>
            
            {isLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                <div className="spinner"></div>
              </div>
            )}
            
            {logs && (
              <div style={{ textAlign: 'left', marginTop: '10px' }}>
                <label className="form-label">Execution Logs:</label>
                <pre 
                  ref={logConsoleRef}
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    padding: '16px',
                    borderRadius: '12px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)'
                  }}
                >
                  {logs}
                </pre>
              </div>
            )}

            {!isLoading && (
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={() => { setLogs(''); setStatus(''); }}>
                  Configure Again
                </button>
                <button className="btn btn-secondary" onClick={onClose}>
                  Close
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
