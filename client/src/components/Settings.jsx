import React, { useState, useEffect } from 'react';
import { SCRAPER_API_BASE } from '../utils/api.js';

export default function Settings({ onClose, onScrapeSuccess }) {
  const [cookie, setCookie] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState('');
  const [status, setStatus] = useState('');

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
      .then(res => res.json())
      .then(data => {
        setIsLoading(false);
        setLogs(data.log);
        if (data.success) {
          setStatus('Scraper finished successfully!');
          // Trigger reload in parent component
          if (onScrapeSuccess) onScrapeSuccess();
        } else {
          setStatus('Scraper failed. Check the logs below.');
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

        {!isLoading && !logs ? (
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
                <pre style={{
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
                }}>
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
