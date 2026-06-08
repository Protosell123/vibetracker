import React, { useState } from 'react';
import { getPluginFunction, getSampleType } from '../utils/classifier.js';

export default function PluginCard({ plugin, isFavorite, onToggleFavorite, onDownload }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const classification = plugin.category === 'Plugins'
    ? getPluginFunction(plugin.title, plugin.rawTitle)
    : getSampleType(plugin.title, plugin.rawTitle);

  return (
    <div className="modern-card">
      <div className="card-header">
        <span className="card-developer" title={plugin.developer}>
          {plugin.developer || 'Unknown'}
        </span>
        <button 
          className={`fav-star-btn ${isFavorite ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
        >
          ★
        </button>
      </div>

      <h3 className="card-title" title={plugin.rawTitle}>
        {plugin.title || plugin.rawTitle}
      </h3>

      <div className="card-meta">
        <span className="card-version">
          {plugin.version ? `v${plugin.version}` : 'Latest Release'}
        </span>
        <span className="card-category-badge" title={`Category: ${classification.label}`}>
          {classification.icon} {classification.label}
        </span>
      </div>

      <div className="card-formats-row">
        {plugin.formats && plugin.formats.slice(0, 3).map(fmt => (
          <span key={fmt} className="format-badge">
            {fmt}
          </span>
        ))}
        {plugin.os && plugin.os.map(os => (
          <span key={os} className={`os-badge ${os.toLowerCase()}`}>
            {os === 'macOS' ? ' Mac' : '❖ Win'}
          </span>
        ))}
      </div>

      <div className="card-stats-row">
        <div className="stat-item size" title="File Size">
          <span>💾 {plugin.size}</span>
        </div>
        <div className="stat-item seeds" title="Seeders">
          <span className="text-green">▲ {plugin.seeders}</span>
        </div>
        <div className="stat-item leeches" title="Leechers">
          <span className="text-red">▼ {plugin.leechers}</span>
        </div>
      </div>

      <div className="card-actions">
        {plugin.downloadUrl ? (
          <a 
            href={plugin.downloadUrl} 
            className="card-download-btn"
            onClick={() => onDownload && onDownload(plugin.id)}
            title="Download .torrent file"
          >
            📥 Download
          </a>
        ) : (
          <button className="card-download-btn disabled" disabled>
            No Download
          </button>
        )}

        <div className="card-secondary-actions">
          <button 
            className="icon-action-btn"
            onClick={() => copyToClipboard(plugin.topicUrl)}
            title={copied ? "Copied Link!" : "Copy Thread Link"}
          >
            {copied ? '✓' : '🔗'}
          </button>
          <a 
            href={plugin.topicUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="icon-action-btn"
            title="Open Thread"
          >
            💬
          </a>
          <a 
            href={`https://duckduckgo.com/?q=!ducky+${encodeURIComponent(plugin.developer + ' ' + (plugin.title || plugin.rawTitle))}`}
            target="_blank" 
            rel="noopener noreferrer" 
            className="icon-action-btn"
            title="Official Product Site"
          >
            🌐
          </a>
        </div>
      </div>
    </div>
  );
}
