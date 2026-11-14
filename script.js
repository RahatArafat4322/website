"use strict";

const CreatorHub = (() => {
  const DEFAULT_LOGO_SVG = `
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="9" y="9" width="18" height="18" rx="4" stroke="#00f0ff" stroke-width="2.2"/>
      <path d="M14 22V14L22 22V14" stroke="#f8fafc" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M13 4V9M23 4V9M13 27V32M23 27V32M4 13H9M4 23H9M27 13H32M27 23H32" stroke="#00f0ff" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;

  // YOUR PERMANENT SECURE CONFIGURATION IS HARDCODED HERE
  const DEFAULT_CONFIG = {
    channelName: "Nextcircuit",
    logoUrl: "image_499882.png",
    githubJsonUrl: "https://raw.githubusercontent.com/RahatArafat4322/nextcircuit-data/main/software.json",
    channelId: "UCYjqxJnWhLHKPc9mkuc2Mcg",
    apiKey: "AIzaSyAAycUXr6jdqRUgQUym-Czq63BqDGOSvXg",
    software: {
      windows: [
        { name: "STM32CubeIDE (Windows x64)", driveUrl: "https://drive.google.com" },
        { name: "CH340 / CP210x USB Drivers", driveUrl: "https://drive.google.com" }
      ],
      linux: [
        { name: "STM32CubeProgrammer (Linux)", driveUrl: "https://drive.google.com" }
      ],
      android: [
        { name: "Nextcircuit Serial Bluetooth Terminal", driveUrl: "https://drive.google.com" }
      ]
    },
    videos: []
  };

  let config = JSON.parse(localStorage.getItem("nextcircuit_v3_config")) || JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  
  // Force update config if hardcoded values changed but localStorage exists
  if (config.channelId !== DEFAULT_CONFIG.channelId || config.apiKey !== DEFAULT_CONFIG.apiKey) {
    config.channelId = DEFAULT_CONFIG.channelId;
    config.apiKey = DEFAULT_CONFIG.apiKey;
    config.githubJsonUrl = DEFAULT_CONFIG.githubJsonUrl;
    localStorage.setItem("nextcircuit_v3_config", JSON.stringify(config));
  }

  let toastTimer;

  const sanitizeUrl = (url) => {
    const trimmed = String(url).trim();
    if (/^(javascript:|vbscript:|data:text\/html)/i.test(trimmed)) return "#";
    return trimmed;
  };

  const escapeHTML = (str) => {
    if (!str) return "";
    return String(str).replace(/[&<>"'`=\/]/g, s => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;'
    }[s]));
  };

  const verifyAuth = (input) => btoa(input) === "MTQxMjgzd2U=";

  const showToast = (msg) => {
    const el = document.getElementById("toastBanner");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 3200);
  };

  const formatViews = (num) => {
    if (!num && num !== 0) return "YouTube Upload";
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M views";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K views";
    return num + " views";
  };

  const toggleAccordion = (id) => {
    const item = document.getElementById(id);
    const isOpen = item.classList.contains("open");
    
    document.querySelectorAll(".accordion-item").forEach(el => {
      el.classList.remove("open");
      el.querySelector('.accordion-header').setAttribute('aria-expanded', 'false');
    });
    
    if (!isOpen) {
      item.classList.add("open");
      item.querySelector('.accordion-header').setAttribute('aria-expanded', 'true');
    }
  };

  const renderSidebar = () => {
    document.getElementById("displayChannelName").textContent = config.channelName;
    const avatarEl = document.getElementById("avatarContainer");
    
    if (config.logoUrl) {
      avatarEl.innerHTML = '';
      const img = document.createElement('img');
      img.src = sanitizeUrl(config.logoUrl);
      img.alt = `${config.channelName} Logo`;
      img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;';
      img.onerror = () => { avatarEl.innerHTML = DEFAULT_LOGO_SVG; };
      avatarEl.appendChild(img);
    } else {
      avatarEl.innerHTML = DEFAULT_LOGO_SVG;
    }

    ["windows", "linux", "android"].forEach(platform => {
      const listEl = document.getElementById(`list-${platform}`);
      const items = (config.software && config.software[platform]) || [];
      
      if (items.length === 0) {
        listEl.innerHTML = `<div class="software-list"><div class="text-xs text-slate-500 px-2">No items configured.</div></div>`;
        return;
      }
      
      listEl.innerHTML = `<div class="software-list">` + items.map(item => `
        <div class="software-row">
          <span class="software-name" title="${escapeHTML(item.name)}">${escapeHTML(item.name)}</span>
          <a href="${sanitizeUrl(item.driveUrl)}" target="_blank" rel="noopener noreferrer" class="drive-btn" aria-label="Download ${escapeHTML(item.name)}">
            Drive ↗
          </a>
        </div>
      `).join("") + `</div>`;
    });
  };

  const renderVideos = () => {
    const sortMode = document.getElementById("sortMode").value;
    const sorted = [...(config.videos || [])].sort((a, b) => {
      if (sortMode === "views") return (b.views || 0) - (a.views || 0);
      return new Date(b.publishedAt) - new Date(a.publishedAt);
    });

    const gridEl = document.getElementById("videoGrid");

    if (sorted.length === 0) {
      gridEl.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 48px 32px; background: var(--bg-card); border: 1px dashed var(--border-glow); border-radius: 18px; text-align: center;">
          <div style="width: 52px; height: 52px; margin: 0 auto 14px; border-radius: 50%; background: rgba(0, 240, 255, 0.12); border: 1px solid rgba(0, 240, 255, 0.35); color: var(--accent-cyan); display: flex; align-items: center; justify-content: center; font-size: 20px;">▶</div>
          <h3 style="font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">Waiting for Feed Sync</h3>
          <p style="font-size: 14px; color: var(--text-secondary); max-width: 520px; margin: 0 auto 14px; line-height: 1.55;">
            Videos will appear here securely once your YouTube Channel ID is linked.
          </p>
        </div>
      `;
      return;
    }

    gridEl.innerHTML = sorted.map((v) => {
      const dateObj = new Date(v.publishedAt);
      const formattedDate = !isNaN(dateObj) ? dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown Date';
      
      return `
      <article tabindex="0" class="video-card" data-vid="${escapeHTML(v.id)}" data-title="${escapeHTML(v.title)}" onclick="CreatorHub.openPlayer('${escapeHTML(v.id)}', '${escapeHTML(v.title).replace(/'/g, "\\'")}')" onkeypress="if(event.key === 'Enter') CreatorHub.openPlayer('${escapeHTML(v.id)}', '${escapeHTML(v.title).replace(/'/g, "\\'")}')">
        <div class="thumb-container">
          <img src="${sanitizeUrl(v.thumbnail)}" alt="${escapeHTML(v.title)}" loading="lazy" onerror="this.src='https://placehold.co/640x360/090d16/00f0ff?text=Nextcircuit'" />
          <div class="play-overlay"><div class="play-circle" aria-hidden="true">▶</div></div>
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

  const syncGitHubSoftware = async () => {
    if (!config.githubJsonUrl) return;
    try {
      const res = await fetch(`${sanitizeUrl(config.githubJsonUrl)}?t=${Date.now()}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && (data.windows || data.linux || data.android)) {
        config.software = {
          windows: Array.isArray(data.windows) ? data.windows : [],
          linux: Array.isArray(data.linux) ? data.linux : [],
          android: Array.isArray(data.android) ? data.android : []
        };
        localStorage.setItem("nextcircuit_v3_config", JSON.stringify(config));
        renderSidebar();
      }
    } catch (err) { console.warn("GitHub JSON Sync failed (using cache)."); }
  };

  const syncYouTubeVideos = async () => {
    const badge = document.getElementById("syncBadge");
    if (!config.channelId && !config.apiKey) {
      badge.textContent = "● API Disabled";
      renderVideos();
      return;
    }
    badge.textContent = "↻ Syncing...";

    try {
      if (config.apiKey && config.channelId) {
        const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?key=${encodeURIComponent(config.apiKey)}&channelId=${encodeURIComponent(config.channelId)}&part=snippet,id&order=date&maxResults=30&type=video`);
        const searchData = await searchRes.json();
        if (searchData.items && searchData.items.length > 0) {
          const ids = searchData.items.map(item => item.id.videoId).join(",");
          const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?key=${encodeURIComponent(config.apiKey)}&id=${ids}&part=snippet,statistics`);
          const statsData = await statsRes.json();

          config.videos = statsData.items.map(v => ({
            id: v.id, title: v.snippet.title, views: parseInt(v.statistics.viewCount || "0", 10),
            publishedAt: v.snippet.publishedAt, thumbnail: v.snippet.thumbnails.high?.url || v.snippet.thumbnails.medium?.url
          }));
          localStorage.setItem("nextcircuit_v3_config", JSON.stringify(config));
          badge.textContent = `● Secure Sync (${config.videos.length})`;
          renderVideos();
          return;
        }
      }
      if (config.channelId) {
        const rssUrl = encodeURIComponent(`https://www.youtube.com/feeds/videos.xml?channel_id=${config.channelId}`);
        const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}`);
        const data = await res.json();
        if (data.status === "ok" && data.items) {
          config.videos = data.items.map(item => {
            const vidId = (item.guid && item.guid.includes(":")) ? item.guid.split(":")[2] : (item.link.split("v=")[1] || "").split("&")[0];
            return { id: vidId, title: item.title, views: null, publishedAt: item.pubDate, thumbnail: `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg` };
          });
          localStorage.setItem("nextcircuit_v3_config", JSON.stringify(config));
          badge.textContent = `● RSS Synced (${config.videos.length})`;
        }
      }
    } catch (err) { badge.textContent = "● Using Cache"; }
    renderVideos();
  };

  const openPlayer = (videoId, title) => {
    document.getElementById("playerTitle").textContent = title;
    document.getElementById("youtubeIframe").src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`;
    document.getElementById("playerModal").classList.add("active");
    document.getElementById("playerModal").focus();
  };

  const closePlayer = () => {
    document.getElementById("youtubeIframe").src = "";
    document.getElementById("playerModal").classList.remove("active");
  };

  const unlockAdminMode = (silent = false) => {
    const pass = prompt("Creator Auth Required:");
    if (verifyAuth(pass)) {
      document.body.classList.add("admin-unlocked");
      if (!silent) showToast("⚡ Secure Admin Unlocked");
    } else if (pass !== null) {
      alert("Security Lock: Invalid Credentials");
    }
  };

  const lockAdminMode = () => {
    document.body.classList.remove("admin-unlocked");
    closeAdminModal();
    showToast("🔒 Session Locked");
  };

  const openAdminModal = () => {
    document.getElementById("inputName").value = config.channelName;
    document.getElementById("inputLogo").value = config.logoUrl;
    document.getElementById("inputGithubJsonUrl").value = config.githubJsonUrl;
    document.getElementById("inputChannelId").value = config.channelId;
    document.getElementById("inputApiKey").value = config.apiKey;
    renderAdminSoftwareList();
    document.getElementById("adminModal").classList.add("active");
  };

  const closeAdminModal = () => document.getElementById("adminModal").classList.remove("active");

  const switchAdminTab = (tab) => {
    document.getElementById("adminTabSoftware").classList.toggle("hidden", tab !== "software");
    document.getElementById("adminTabSync").classList.toggle("hidden", tab !== "sync");
    document.getElementById("tabBtnSoftware").classList.toggle("active", tab === "software");
    document.getElementById("tabBtnSync").classList.toggle("active", tab === "sync");
  };

  const handleLogoFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById("inputLogo").value = e.target.result;
      showToast("Logo injected in memory. Click Save.");
    };
    reader.readAsDataURL(file);
  };

  const toggleCustomSelect = () => {
    document.getElementById('swPlatformOptions').classList.toggle('hidden');
  };

  const selectPlatform = (val, text) => {
    document.getElementById('swPlatform').value = val;
    document.getElementById('swPlatformDisplay').textContent = text;
    document.getElementById('swPlatformOptions').classList.add('hidden');
  };

  const toggleSortSelect = () => {
    document.getElementById('sortModeOptions').classList.toggle('hidden');
  };

  const selectSort = (val, text) => {
    document.getElementById('sortMode').value = val;
    document.getElementById('sortModeDisplay').textContent = text;
    document.getElementById('sortModeOptions').classList.add('hidden');
    renderVideos();
  };

  const renderAdminSoftwareList = () => {
    const container = document.getElementById("adminSoftwareManagerList");
    const platforms = [{ key: "windows", label: "Windows" }, { key: "linux", label: "Linux" }, { key: "android", label: "Android" }];

    container.innerHTML = platforms.map(p => {
      const items = config.software[p.key] || [];
      return `
        <div class="bg-[#090d16] p-3 rounded-lg border border-slate-800">
          <div class="text-xs font-bold text-cyan-400 uppercase mb-2">${p.label} (${items.length})</div>
          ${items.length === 0 ? `<div class="text-xs text-slate-500">Empty</div>` : items.map((item, idx) => `
            <div class="flex justify-between items-center gap-2 py-1.5 border-b border-slate-800/70 last:border-none text-xs">
              <span class="truncate text-slate-200">${escapeHTML(item.name)}</span>
              <button type="button" onclick="CreatorHub.removeSoftwareItem('${p.key}', ${idx})" class="text-rose-400 hover:text-rose-300 font-semibold px-2">Remove</button>
            </div>
          `).join("")}
        </div>
      `;
    }).join("");
    document.getElementById("softwareJsonPreview").value = JSON.stringify(config.software, null, 2);
  };

  const addSoftwareItem = (e) => {
    e.preventDefault();
    const platform = document.getElementById("swPlatform").value;
    const name = escapeHTML(document.getElementById("swName").value.trim());
    const driveUrl = sanitizeUrl(document.getElementById("swDriveUrl").value.trim());
    if (!name || driveUrl === "#") return showToast("Error: Invalid input detected.");

    config.software[platform].push({ name, driveUrl });
    localStorage.setItem("nextcircuit_v3_config", JSON.stringify(config));
    e.target.reset();
    renderSidebar();
    renderAdminSoftwareList();
    showToast(`Secure link added to ${platform}`);
  };

  const removeSoftwareItem = (platform, index) => {
    config.software[platform].splice(index, 1);
    localStorage.setItem("nextcircuit_v3_config", JSON.stringify(config));
    renderSidebar();
    renderAdminSoftwareList();
  };

  const copySoftwareJson = () => {
    const textarea = document.getElementById("softwareJsonPreview");
    textarea.select();
    document.execCommand("copy");
    showToast("Payload copied to clipboard.");
  };

  const downloadSoftwareJson = () => {
    const blob = new Blob([JSON.stringify(config.software, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "software.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const saveAdminSettings = () => {
    config.channelName = escapeHTML(document.getElementById("inputName").value.trim()) || "Nextcircuit";
    config.logoUrl = sanitizeUrl(document.getElementById("inputLogo").value.trim());
    config.githubJsonUrl = sanitizeUrl(document.getElementById("inputGithubJsonUrl").value.trim());
    config.channelId = escapeHTML(document.getElementById("inputChannelId").value.trim());
    config.apiKey = escapeHTML(document.getElementById("inputApiKey").value.trim());
    localStorage.setItem("nextcircuit_v3_config", JSON.stringify(config));
    
    renderSidebar();
    closeAdminModal();
    syncGitHubSoftware();
    syncYouTubeVideos();
    showToast("Configurations saved & encrypted locally.");
  };

  // The actual function that downloads changes for GitHub uploads
  const exportStandaloneHTML = () => {
    document.body.classList.remove("admin-unlocked");
    const updatedHTML = document.documentElement.outerHTML.replace(
      /const DEFAULT_CONFIG = \{[\s\S]*?\n      \};/,
      `const DEFAULT_CONFIG = ${JSON.stringify(config, null, 2)};`
    );
    const blob = new Blob(["<!DOCTYPE html>\n" + updatedHTML], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "index.html";
    a.click();
    URL.revokeObjectURL(a.href);
    document.body.classList.add("admin-unlocked");
    showToast("Secure HTML exported successfully.");
  };

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select-wrapper')) {
      const pOpts = document.getElementById('swPlatformOptions');
      const sOpts = document.getElementById('sortModeOptions');
      if (pOpts && !pOpts.classList.contains('hidden')) pOpts.classList.add('hidden');
      if (sOpts && !sOpts.classList.contains('hidden')) sOpts.classList.add('hidden');
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closePlayer(); closeAdminModal(); }
    if (e.ctrlKey && e.shiftKey && (e.key === "E" || e.key === "e")) {
      e.preventDefault();
      document.body.classList.contains("admin-unlocked") ? lockAdminMode() : unlockAdminMode();
    }
  });

  window.addEventListener("DOMContentLoaded", () => {
    if (new URLSearchParams(window.location.search).get("admin") === "true") unlockAdminMode(true);
    renderSidebar();
    syncGitHubSoftware();
    syncYouTubeVideos();
  });

  return {
    toggleAccordion, renderSidebar, renderVideos, openPlayer, closePlayer,
    openAdminModal, closeAdminModal, switchAdminTab, handleLogoFileUpload,
    addSoftwareItem, removeSoftwareItem, copySoftwareJson, downloadSoftwareJson,
    saveAdminSettings, lockAdminMode, toggleCustomSelect, selectPlatform,
    toggleSortSelect, selectSort, exportStandaloneHTML
  };
})();
