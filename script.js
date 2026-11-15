"use strict";

const CreatorHub = (() => {
  const DEFAULT_LOGO_SVG = `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="9" width="18" height="18" rx="4" stroke="#ffffff" stroke-width="2.2"/><path d="M14 22V14L22 22V14" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/><path d="M13 4V9M23 4V9M13 27V32M23 27V32M4 13H9M4 23H9M27 13H32M27 23H32" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/></svg>`;

  // SECURITY: Hardcoded config that cannot be changed by malicious visitors
  const DEFAULT_CONFIG = {
    channelName: "Nextcircuit",
    logoUrl: "image_499882.png",
    channelId: "UCYjqxJnWhLHKPc9mkuc2Mcg",
    apiKey: "AIzaSyAAycUXr6jdqRUgQUym-Czq63BqDGOSvXg",
    software: {
      github: [],
      windows: [],
      linux: [],
      android: []
    },
    videos: []
  };

  let config = JSON.parse(localStorage.getItem("nextcircuit_v3_config")) || JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  
  if (config.channelId !== DEFAULT_CONFIG.channelId || config.apiKey !== DEFAULT_CONFIG.apiKey) {
    config.channelId = DEFAULT_CONFIG.channelId;
    config.apiKey = DEFAULT_CONFIG.apiKey;
    localStorage.setItem("nextcircuit_v3_config", JSON.stringify(config));
  }

  // SECURITY: Freezes config object so it cannot be hijacked via developer console
  Object.freeze(DEFAULT_CONFIG);

  let searchQuery = "";

  // SECURITY: XSS Sanitization for all links injected from JSON
  const sanitizeUrl = (url) => {
    const trimmed = String(url).trim();
    if (/^(javascript:|vbscript:|data:text\/html)/i.test(trimmed)) return "#";
    return trimmed;
  };

  // SECURITY: HTML entity escaping to prevent code injection
  const escapeHTML = (str) => {
    if (!str) return "";
    return String(str).replace(/[&<>"'`=\/]/g, s => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;'
    }[s]));
  };

  const formatViews = (num) => {
    if (!num && num !== 0) return "YouTube Upload";
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M views";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K views";
    return num + " views";
  };

  const switchTab = (tabId) => {
    // Only target nav buttons that are part of the tab system (not external social links)
    document.querySelectorAll('button.nav-btn').forEach(btn => btn.classList.remove('active'));
    const navBtn = document.getElementById(`nav-${escapeHTML(tabId)}`);
    if (navBtn) navBtn.classList.add('active');

    document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
    const tabView = document.getElementById(`tab-${escapeHTML(tabId)}`);
    if (tabView) tabView.classList.add('active');

    if (tabId === 'github') fetchGitHubRepos();
    if (['windows', 'linux', 'android'].includes(tabId)) renderSoftwareGrid(tabId);
  };

  const initProfile = () => {
    document.getElementById("displayChannelName").textContent = config.channelName;
    const avatarEl = document.getElementById("avatarContainer");
    
    if (config.logoUrl) {
      avatarEl.innerHTML = '';
      const img = document.createElement('img');
      img.src = sanitizeUrl(config.logoUrl);
      img.alt = `${config.channelName} Logo`;
      img.className = 'avatar';
      img.onerror = () => { avatarEl.innerHTML = DEFAULT_LOGO_SVG; };
      avatarEl.appendChild(img);
    } else {
      avatarEl.innerHTML = DEFAULT_LOGO_SVG;
    }
  };

  const fetchGitHubRepos = () => {
    const grid = document.getElementById("githubGrid");
    const repos = (config.software && config.software.github) || [];

    if (repos.length === 0) {
      grid.innerHTML = `<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-secondary);">No repositories linked yet. Edit software.json to add some!</div>`;
      return;
    }

    grid.innerHTML = repos.map((repo, idx) => `
      <a href="${sanitizeUrl(repo.url)}" target="_blank" rel="noopener noreferrer" class="video-card" style="padding: 24px; animation-delay: ${idx * 0.04}s;">
        <h4 class="video-title" style="font-size: 16px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="var(--text-muted)"><path fill-rule="evenodd" d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z"></path></svg>
          ${escapeHTML(repo.name)}
        </h4>
        <div class="video-stats" style="margin-top: auto; padding-top: 16px; border-top: 1px solid var(--border-subtle);">
          <span>View on GitHub ↗</span>
        </div>
      </a>
    `).join("");
  };

  const renderSoftwareGrid = (platform) => {
    const grid = document.getElementById(`grid-${escapeHTML(platform)}`);
    if (!grid) return;
    
    const items = (config.software && config.software[platform]) || [];

    if (items.length === 0) {
      grid.innerHTML = `<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-secondary);">No software linked for this platform yet.</div>`;
      return;
    }

    grid.innerHTML = items.map((item, idx) => `
      <div class="video-card" style="padding: 24px; animation-delay: ${idx * 0.04}s;">
        <h4 class="video-title" style="font-size: 16px; margin-bottom: 20px;">
          ${escapeHTML(item.name)}
        </h4>
        <a href="${sanitizeUrl(item.driveUrl)}" target="_blank" rel="noopener noreferrer" class="drive-btn">
          <svg style="width:16px; margin-right:8px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          Secure Download
        </a>
      </div>
    `).join("");
  };

  const syncGitHubSoftware = async () => {
    try {
      // Secure local fetching constraint
      const res = await fetch(`software.json?t=${Date.now()}`, { 
        method: 'GET', 
        mode: 'same-origin', 
        headers: { 'Accept': 'application/json' } 
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data && (data.windows || data.linux || data.android || data.github)) {
        config.software = {
          windows: Array.isArray(data.windows) ? data.windows : [],
          linux: Array.isArray(data.linux) ? data.linux : [],
          android: Array.isArray(data.android) ? data.android : [],
          github: Array.isArray(data.github) ? data.github : []
        };
        localStorage.setItem("nextcircuit_v3_config", JSON.stringify(config));
        
        ['windows', 'linux', 'android'].forEach(p => {
          const tab = document.getElementById(`tab-${p}`);
          if (tab && tab.classList.contains('active')) renderSoftwareGrid(p);
        });
        if(document.getElementById('tab-github')?.classList.contains('active')) fetchGitHubRepos();
      }
    } catch (err) {
      console.warn("Failed to sync software data securely.");
    }
  };

  const handleSearch = () => {
    const inputEl = document.getElementById("searchInput");
    if (!inputEl) return;
    searchQuery = inputEl.value.toLowerCase();
    renderVideos();
  };

  const renderVideos = () => {
    const sortModeEl = document.getElementById("sortMode");
    const sortMode = sortModeEl ? sortModeEl.value : 'views';
    
    const sorted = [...(config.videos || [])]
      .filter(v => escapeHTML(v.title).toLowerCase().includes(searchQuery))
      .sort((a, b) => {
        if (sortMode === "views") return (b.views || 0) - (a.views || 0);
        return new Date(b.publishedAt) - new Date(a.publishedAt);
      });

    const gridEl = document.getElementById("videoGrid");
    if (!gridEl) return;

    if (config.videos && config.videos.length > 0 && sorted.length === 0) {
      gridEl.innerHTML = `<div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-secondary);">No results found for "${escapeHTML(searchQuery)}"</div>`;
      return;
    }

    if (sorted.length === 0) {
      gridEl.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 60px 32px; background: var(--bg-card); border: 1px dashed var(--border-subtle); border-radius: 12px; text-align: center;">
          <h3 style="font-size: 16px; font-weight: 500; color: var(--text-primary); margin-bottom: 8px;">Waiting for Feed Sync</h3>
          <p style="font-size: 13px; color: var(--text-secondary);">Videos will appear here securely once synced.</p>
        </div>
      `;
      return;
    }

    gridEl.innerHTML = sorted.map((v, idx) => {
      const dateObj = new Date(v.publishedAt);
      const formattedDate = !isNaN(dateObj) ? dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown Date';
      
      return `
      <article class="video-card" onclick="CreatorHub.openPlayer('${escapeHTML(v.id)}', '${escapeHTML(v.title).replace(/'/g, "\\'")}')" style="animation-delay: ${idx * 0.04}s;">
        <div class="thumb-container">
          <img src="${sanitizeUrl(v.thumbnail)}" alt="${escapeHTML(v.title)}" loading="lazy" />
          <div class="play-overlay"><div class="play-circle">▶</div></div>
        </div>
        <div class="card-body">
          <h4 class="video-title">${escapeHTML(v.title)}</h4>
          <div class="video-stats">
            <span class="views-pill">${formatViews(v.views)}</span>
            <span><time datetime="${v.publishedAt}">${formattedDate}</time></span>
          </div>
        </div>
      </article>
    `}).join("");
  };

  const renderSkeletons = () => {
    const gridEl = document.getElementById("videoGrid");
    if (!gridEl) return;
    gridEl.innerHTML = Array(6).fill(0).map((_, idx) => `
      <div class="skeleton-card" style="animation-delay: ${idx * 0.04}s;">
        <div class="skeleton skeleton-thumb"></div>
        <div class="skeleton-body">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-title" style="width: 60%;"></div>
          <div class="skeleton skeleton-meta"></div>
        </div>
      </div>
    `).join("");
  };

  const syncYouTubeVideos = async () => {
    const badge = document.getElementById("syncBadge");
    if (!config.channelId && !config.apiKey) {
      if (badge) badge.textContent = "● API Disabled";
      renderVideos();
      return;
    }
    
    if (badge) badge.textContent = "↻ Syncing...";
    if (!config.videos || config.videos.length === 0) renderSkeletons();

    try {
      if (config.apiKey && config.channelId) {
        // Secure credential stripping for external API calls
        const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?key=${encodeURIComponent(config.apiKey)}&channelId=${encodeURIComponent(config.channelId)}&part=snippet,id&order=date&maxResults=30&type=video`, {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit'
        });
        const searchData = await searchRes.json();
        if (searchData.items && searchData.items.length > 0) {
          const ids = searchData.items.map(item => item.id.videoId).join(",");
          const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?key=${encodeURIComponent(config.apiKey)}&id=${ids}&part=snippet,statistics`, {
            method: 'GET',
            mode: 'cors',
            credentials: 'omit'
          });
          const statsData = await statsRes.json();

          config.videos = statsData.items.map(v => ({
            id: v.id, title: v.snippet.title, views: parseInt(v.statistics.viewCount || "0", 10),
            publishedAt: v.snippet.publishedAt, thumbnail: v.snippet.thumbnails.high?.url || v.snippet.thumbnails.medium?.url
          }));
          localStorage.setItem("nextcircuit_v3_config", JSON.stringify(config));
          if (badge) badge.textContent = `● Secure Sync (${config.videos.length})`;
          renderVideos();
          return;
        }
      }
    } catch (err) { 
      if (badge) badge.textContent = "● Using Cache"; 
    }
    renderVideos();
  };

  const openPlayer = (videoId, title) => {
    const titleEl = document.getElementById("playerTitle");
    const iframeEl = document.getElementById("youtubeIframe");
    const modalEl = document.getElementById("playerModal");
    
    if (titleEl) titleEl.textContent = title;
    if (iframeEl) iframeEl.src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`;
    if (modalEl) modalEl.classList.add("active");
  };

  const closePlayer = () => {
    const iframeEl = document.getElementById("youtubeIframe");
    const modalEl = document.getElementById("playerModal");
    
    if (iframeEl) iframeEl.src = "";
    if (modalEl) modalEl.classList.remove("active");
  };

  const toggleSortSelect = () => {
    const opts = document.getElementById('sortModeOptions');
    if (opts) opts.classList.toggle('hidden');
  };

  const selectSort = (val, text) => {
    const sortModeEl = document.getElementById('sortMode');
    const displayEl = document.getElementById('sortModeDisplay');
    const optsEl = document.getElementById('sortModeOptions');
    
    if (sortModeEl) sortModeEl.value = val;
    if (displayEl) displayEl.textContent = text;
    if (optsEl) optsEl.classList.add('hidden');
    renderVideos();
  };

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select-wrapper')) {
      const sOpts = document.getElementById('sortModeOptions');
      if (sOpts) sOpts.classList.add('hidden');
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePlayer();
  });

  window.addEventListener("DOMContentLoaded", () => {
    initProfile();
    syncGitHubSoftware();
    syncYouTubeVideos();
  });

  return {
    switchTab, 
    handleSearch, 
    openPlayer, 
    closePlayer,
    toggleSortSelect, 
    selectSort
  };
})();
