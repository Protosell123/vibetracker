import React, { useState, useEffect } from 'react';

export default function DeviceView({ plugin, isFavorite, onToggleFavorite }) {
  const [copied, setCopied] = useState(false);
  const [knobVal, setKnobVal] = useState(0);

  useEffect(() => {
    // Just a mock state for visual animation when switching plugins
    setKnobVal(0);
    const timer = setTimeout(() => setKnobVal(1), 50);
    return () => clearTimeout(timer);
  }, [plugin]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Convert size string to a percentage for a meter
  const getSizePercentage = (sizeStr) => {
    if (!sizeStr) return 0;
    const val = parseFloat(sizeStr.replace(/[^\d.]/g, ''));
    if (sizeStr.includes('GB')) return Math.min((val / 10) * 100, 100); // normalized to 10GB max
    if (sizeStr.includes('MB')) return Math.min((val / 1000) * 100, 100); // normalized to 1GB max
    return 5;
  };

  if (!plugin) {
    return (
      <div className="ableton-device-view empty-device-view">
        <div className="drop-area-box">
          <span className="drop-text-big">Drop Files and Devices Here</span>
          <span className="drop-text-small">Select a plugin or sample pack from the browser to load its device controls.</span>
        </div>
      </div>
    );
  }

  // Calculate rotation angles for knobs (from -135deg to 135deg based on values)
  const maxSeeds = 500;
  const seedPercentage = Math.min((plugin.seeders / maxSeeds), 1);
  const seedAngle = -135 + seedPercentage * 270;

  const maxLeechers = 200;
  const leechPercentage = Math.min((plugin.leechers / maxLeechers), 1);
  const leechAngle = -135 + leechPercentage * 270;

  const sizePercentage = getSizePercentage(plugin.size);
  const sizeAngle = -135 + (sizePercentage / 100) * 270;

  return (
    <div className="ableton-device-view">
      {/* Device 1: Utility / Header info */}
      <div className="ableton-device-rack">
        <div className="device-header">
          <div className="device-activator active"></div>
          <span className="device-title">INFO UTILITY</span>
        </div>
        <div className="device-body flex-col justify-between" style={{ padding: '8px', minWidth: '160px' }}>
          <div className="info-field">
            <span className="info-label">CREATOR</span>
            <span className="info-value text-orange" title={plugin.developer}>
              {plugin.developer.length > 18 ? `${plugin.developer.slice(0, 16)}..` : plugin.developer}
            </span>
          </div>
          <div className="info-field">
            <span className="info-label">VERSION</span>
            <span className="info-value">{plugin.version || 'LATEST'}</span>
          </div>
          <div className="info-field">
            <span className="info-label">PLATFORM</span>
            <span className="info-value text-cyan">
              {plugin.os ? plugin.os.join(' / ') : 'WIN / MAC'}
            </span>
          </div>
        </div>
      </div>

      {/* Device 2: Seeds & Leeches Knobs */}
      <div className="ableton-device-rack">
        <div className="device-header">
          <div className="device-activator active"></div>
          <span className="device-title">PEER RATIO</span>
        </div>
        <div className="device-body flex-row justify-around" style={{ minWidth: '180px', padding: '10px' }}>
          {/* Seeds Knob */}
          <div className="ableton-knob-container">
            <span className="knob-label">SEEDS</span>
            <div className="ableton-knob" style={{ transform: `rotate(${knobVal ? seedAngle : -135}deg)` }}>
              <div className="knob-pointer"></div>
            </div>
            <span className="knob-value">{plugin.seeders}</span>
          </div>

          {/* Leechers Knob */}
          <div className="ableton-knob-container">
            <span className="knob-label">LEECHES</span>
            <div className="ableton-knob" style={{ transform: `rotate(${knobVal ? leechAngle : -135}deg)` }}>
              <div className="knob-pointer"></div>
            </div>
            <span className="knob-value">{plugin.leechers}</span>
          </div>
        </div>
      </div>

      {/* Device 3: EQ-Eight Mock (Visual Wow) */}
      <div className="ableton-device-rack" style={{ flexGrow: 1, minWidth: '220px' }}>
        <div className="device-header">
          <div className="device-activator active"></div>
          <span className="device-title">SPECTRUM ANALYSIS</span>
        </div>
        <div className="device-body flex-row" style={{ padding: '8px', gap: '12px' }}>
          <div className="eq-graph-container">
            <div className="eq-grid"></div>
            <svg className="eq-curve" viewBox="0 0 100 40">
              <path 
                d={`M 0,25 Q 15,${25 - seedPercentage*15} 35,${20 - leechPercentage*10} T 70,${25 + sizePercentage*0.1} T 100,20`} 
                fill="none" 
                stroke="var(--accent-orange)" 
                strokeWidth="1.5"
              />
              <circle cx="35" cy={20 - leechPercentage*10} r="2.5" fill="#323232" stroke="var(--accent-orange)" strokeWidth="1.5" />
              <text x="37" y={22 - leechPercentage*10} fill="var(--accent-orange)" fontSize="4" fontWeight="bold">1</text>
            </svg>
            <div className="eq-labels">
              <span>100Hz</span>
              <span>1kHz</span>
              <span>10kHz</span>
            </div>
          </div>
          
          <div className="ableton-knob-container" style={{ alignSelf: 'center' }}>
            <span className="knob-label">FILE SIZE</span>
            <div className="ableton-knob" style={{ transform: `rotate(${knobVal ? sizeAngle : -135}deg)` }}>
              <div className="knob-pointer"></div>
            </div>
            <span className="knob-value" style={{ fontSize: '10px' }}>{plugin.size}</span>
          </div>
        </div>
      </div>

      {/* Device 4: Activator panel / Actions */}
      <div className="ableton-device-rack" style={{ minWidth: '220px' }}>
        <div className="device-header">
          <div className="device-activator active"></div>
          <span className="device-title">TORRENT TRIGGER</span>
        </div>
        <div className="device-body flex-col justify-around" style={{ padding: '10px' }}>
          <div className="flex-row" style={{ gap: '8px', width: '100%' }}>
            {plugin.downloadUrl ? (
              <a 
                href={plugin.downloadUrl} 
                className="ableton-btn ableton-btn-orange flex-grow text-center"
                style={{ display: 'block', padding: '12px 6px', textDecoration: 'none', fontWeight: 'bold' }}
              >
                📥 DOWNLOAD TORRENT
              </a>
            ) : (
              <button className="ableton-btn flex-grow text-muted" disabled>
                NO DOWNLOAD
              </button>
            )}

            <button 
              className={`ableton-btn-round ${isFavorite ? 'active' : ''}`}
              onClick={onToggleFavorite}
              title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
              style={{ fontSize: '14px', width: '40px', height: '40px' }}
            >
              ★
            </button>
          </div>

          <div className="flex-row" style={{ gap: '8px', width: '100%' }}>
            <a 
              href={plugin.topicUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="ableton-btn flex-grow text-center"
              style={{ padding: '6px', textDecoration: 'none' }}
            >
              💬 RUTRACKER THREAD
            </a>
            
            <button 
              className="ableton-btn" 
              onClick={() => copyToClipboard(plugin.topicUrl)}
              style={{ padding: '6px', minWidth: '70px' }}
            >
              {copied ? 'COPIED!' : '🔗 LINK'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
