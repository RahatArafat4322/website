"use strict";

const CreatorHub = (() => {
    const DEFAULT_LOGO_SVG = `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="9" width="18" height="18" rx="4" stroke="#ffffff" stroke-width="2.2"/><path d="M14 22V14L22 22V14" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/><path d="M13 4V9M23 4V9M13 27V32M23 27V32M4 13H9M4 23H9M27 13H32M27 23H32" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/></svg>`;

    const DEFAULT_CONFIG = Object.freeze({
        channelName: "Nextcircuit",
        logoUrl: "image_499882.png",
        channelId: "UCYjqxJnWhLHKPc9mkuc2Mcg",
        apiKey: "AIzaSyAAycUXr6jdqRUgQUym-Czq63BqDG0SvXg",
        software: {
            github: [],
            windows: [],
            linux: [],
            android: []
        },
        videos: []
    });

    const STORAGE_KEY = "nextcircuit_v3_config";
    const VALID_TABS = new Set(["youtube", "github", "windows", "linux", "android"]);

    const searchQueries = {
        youtube: "",
        github: "",
        windows: "",
        linux: "",
        android: ""
    };

    let softwareSyncError = null;
    let toastTimer = null;

    // SECURITY: Strict URL allowlist (only HTTPS external URLs or safe relative asset paths)
    const sanitizeUrl = (url) => {
        if (!url || typeof url !== "string") return "#";
        const trimmed = url.trim();
        if (!trimmed || /^(\/\/|javascript:|vbscript:|data:|file:|blob:)/i.test(trimmed)) return "#";

        // Allow safe relative filenames (e.g. "image_499882.png")
        if (!trimmed.includes(":") && /^[a-zA-Z0-9_./-]+$/.test(trimmed)) {
            return trimmed;
        }

        try {
            const parsed = new URL(trimmed);
            if (parsed.protocol === "https:") {
                return parsed.href;
            }
        } catch (_) {
            return "#";
        }
        return "#";
    };

    // SECURITY: Validate YouTube Video ID format
    const isValidVideoId = (id) => typeof id === "string" && /^[a-zA-Z0-9_-]{11}$/.test(id);

    // SECURITY: HTML entity escaping
    const escapeHTML = (str) => {
        if (!str) return "";
        return String(str).replace(/[&<>"'`=\/]/g, s => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;'
        }[s]));
    };

    const sanitizeSoftwareList = (list) => {
        if (!Array.isArray(list)) return [];
        return list
            .filter(item => item && typeof item === "object" && typeof item.name === "string")
            .map(item => ({
                name: item.name.slice(0, 120),
                url: sanitizeUrl(item.url),
                driveUrl: sanitizeUrl(item.driveUrl),
                links: Array.isArray(item.links)
                    ? item.links
                        .filter(l => l && typeof l === "object")
                        .map(l => ({
                            label: typeof l.label === "string" ? l.label.slice(0, 60) : "Secure Download",
                            url: sanitizeUrl(l.url || l.driveUrl)
                        }))
                    : undefined
            }));
    };

    const loadSafeConfig = () => {
        const base = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return base;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object") return base;

            if (parsed.software && typeof parsed.software === "object") {
                base.software = {
                    github: sanitizeSoftwareList(parsed.software.github),
                    windows: sanitizeSoftwareList(parsed.software.windows),
                    linux: sanitizeSoftwareList(parsed.software.linux),
                    android: sanitizeSoftwareList(parsed.software.android)
                };
            }

            if (Array.isArray(parsed.videos)) {
                base.videos = parsed.videos
                    .filter(v => v && typeof v === "object" && isValidVideoId(v.id))
                    .map(v => ({
                        id: v.id,
                        title: typeof v.title === "string" ? v.title.slice(0, 200) : "Untitled Video",
                        views: Number.isFinite(Number(v.views)) ? Number(v.views) : 0,
                        publishedAt: typeof v.publishedAt === "string" ? v.publishedAt : "",
                        thumbnail: sanitizeUrl(v.thumbnail)
                    }));
            }
        } catch (_) {
            return base;
        }
        return base;
    };

    const config = loadSafeConfig();

    const saveConfig = () => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        } catch (_) {
            // Ignore storage quota / private-mode errors
        }
    };

    const showToast = (message) => {
        const toast = document.getElementById("toastBanner");
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.classList.remove("show");
        }, 2600);
    };

    const formatViews = (num) => {
        if (!num && num !== 0) return "YouTube Upload";
        if (num >= 1000000) return (num / 1000000).toFixed(1) + "M views";
        if (num >= 1000) return (num / 1000).toFixed(1) + "K views";
        return num + " views";
    };

    const updateCountBadge = (tabId, count) => {
        const badge = document.getElementById(`count-${tabId}`);
        if (!badge) return;
        badge.textContent = String(count);
        badge.style.animation = "none";
        void badge.offsetWidth;
        badge.style.animation = "badgePop 0.45s var(--ease-spring) forwards, badgeBreathe 3s ease-in-out infinite";
    };

    // Animated Heading Text Character Wave on Tab Switch
    const animateSectionHeading = (tabId) => {
        const tabEl = document.getElementById(`tab-${tabId}`);
        if (!tabEl) return;
        const h1 = tabEl.querySelector("h1.animated-title");
        if (!h1) return;
        const rawText = h1.getAttribute("data-text") || h1.textContent.trim();
        h1.innerHTML = Array.from(rawText).map((ch, idx) => {
            if (ch === " ") return " ";
            return `<span class="char-reveal" style="animation-delay: ${(idx * 0.025).toFixed(3)}s;">${escapeHTML(ch)}</span>`;
        }).join("");
    };

    // 3D Tilt & Mouse Spotlight Tracking on Cards (Desktop Pointer Only)
    const attachCardTilt = (container) => {
        if (!container || window.matchMedia("(hover: none)").matches) return;
        const cards = container.querySelectorAll(".video-card");
        cards.forEach(card => {
            card.addEventListener("mousemove", (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                card.style.setProperty("--mouse-x", `${x}px`);
                card.style.setProperty("--mouse-y", `${y}px`);

                const rotateY = ((x / rect.width) - 0.5) * 7;
                const rotateX = (0.5 - (y / rect.height)) * 7;
                card.style.transform = `perspective(900px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-7px) scale(1.015)`;
            });

            card.addEventListener("mouseleave", () => {
                card.style.transform = "";
            });
        });
    };

    const getPrimaryUrl = (item) => {
        if (!item) return "#";
        if (Array.isArray(item.links) && item.links.length > 0) {
            return sanitizeUrl(item.links[0].url || item.links[0].driveUrl);
        }
        const drive = sanitizeUrl(item.driveUrl);
        if (drive !== "#") return drive;
        return sanitizeUrl(item.url);
    };

    const buildDownloadButtons = (item) => {
        if (Array.isArray(item.links) && item.links.length > 0) {
            return `<div class="links-stack">` + item.links.map(link => {
                const href = sanitizeUrl(link.url || link.driveUrl);
                const label = escapeHTML(link.label || "Secure Download");
                return `
                    <a href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer nofollow" class="drive-btn">
                        <svg style="width:16px; margin-right:8px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                        ${label}
                    </a>
                `;
            }).join("") + `</div>`;
        }

        const href = getPrimaryUrl(item);
        return `
            <div class="links-stack">
                <a href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer nofollow" class="drive-btn">
                    <svg style="width:16px; margin-right:8px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                    Secure Download
                </a>
            </div>
        `;
    };

    const openExternalLink = (url) => {
        const cleanUrl = sanitizeUrl(url);
        if (!cleanUrl || cleanUrl === "#") return;
        window.open(cleanUrl, "_blank", "noopener,noreferrer");
    };

    const switchTab = (tabId) => {
        if (!VALID_TABS.has(tabId)) return;

        document.querySelectorAll('button.nav-btn').forEach(btn => btn.classList.remove('active'));
        const navBtn = document.getElementById(`nav-${tabId}`);
        if (navBtn) navBtn.classList.add('active');

        document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
        const tabView = document.getElementById(`tab-${tabId}`);
        if (tabView) tabView.classList.add('active');

        const mainContent = document.getElementById('mainContent');
        if (mainContent) mainContent.scrollTop = 0;

        animateSectionHeading(tabId);

        if (tabId === 'youtube') renderVideos();
        if (tabId === 'github') fetchGitHubRepos();
        if (['windows', 'linux', 'android'].includes(tabId)) renderSoftwareGrid(tabId);
    };

    const initProfile = () => {
        const nameEl = document.getElementById("displayChannelName");
        if (nameEl) nameEl.textContent = config.channelName;
        const avatarEl = document.getElementById("avatarContainer");
        if (!avatarEl) return;

        const safeLogo = sanitizeUrl(config.logoUrl);
        if (safeLogo !== "#") {
            avatarEl.innerHTML = '';
            const img = document.createElement('img');
            img.src = safeLogo;
            img.alt = `${config.channelName} Logo`;
            img.className = 'avatar';
            img.onerror = () => { avatarEl.innerHTML = DEFAULT_LOGO_SVG; };
            avatarEl.appendChild(img);
        } else {
            avatarEl.innerHTML = DEFAULT_LOGO_SVG;
        }
    };

    // Animated Typewriter Cycling Specialties in Sidebar
    const initTypewriter = () => {
        const el = document.getElementById("typewriterText");
        if (!el) return;

        const phrases = [
            "Embedded Systems & PCB Design",
            "STM32 & ARM Cortex-M Firmware",
            "ESP32 & IoT Wireless Projects",
            "Arduino & Hardware Engineering",
            "Open-Source Tools & Software"
        ];

        let phraseIdx = 0;
        let charIdx = phrases[0].length;
        let isDeleting = true;

        const tick = () => {
            const currentPhrase = phrases[phraseIdx];
            if (isDeleting) {
                charIdx--;
                el.textContent = currentPhrase.substring(0, charIdx);
                if (charIdx <= 0) {
                    isDeleting = false;
                    phraseIdx = (phraseIdx + 1) % phrases.length;
                    setTimeout(tick, 260);
                    return;
                }
                setTimeout(tick, 28);
            } else {
                charIdx++;
                el.textContent = currentPhrase.substring(0, charIdx);
                if (charIdx >= currentPhrase.length) {
                    isDeleting = true;
                    setTimeout(tick, 2200);
                    return;
                }
                setTimeout(tick, 52);
            }
        };

        setTimeout(tick, 2000);
    };

    const fetchGitHubRepos = () => {
        const grid = document.getElementById("githubGrid");
        if (!grid) return;

        if (softwareSyncError) {
            grid.innerHTML = `<div class="error-banner">${escapeHTML(softwareSyncError)}</div>`;
            updateCountBadge("github", 0);
            return;
        }

        const allRepos = (config.software && Array.isArray(config.software.github)) ? config.software.github : [];
        const query = (searchQueries.github || "").toLowerCase();
        const repos = allRepos.filter(repo => (repo.name || "").toLowerCase().includes(query));

        updateCountBadge("github", repos.length);

        if (allRepos.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-secondary);">No repositories linked yet. Edit software.json to add some!</div>`;
            return;
        }

        if (repos.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-secondary);">No repositories matching "${escapeHTML(searchQueries.github)}"</div>`;
            return;
        }

        grid.innerHTML = repos.map((repo, idx) => {
            const href = sanitizeUrl(repo.url || repo.driveUrl);
            const delay = Math.min(idx * 0.035, 0.55).toFixed(3);
            return `
            <a href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer nofollow" class="video-card" style="padding: 24px; animation-delay: ${delay}s;">
                <h4 class="video-title" style="font-size: 16px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <svg class="repo-icon" width="18" height="18" viewBox="0 0 16 16" fill="var(--text-muted)"><path fill-rule="evenodd" d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z"></path></svg>
                    <span>${escapeHTML(repo.name)}</span>
                </h4>
                <div class="video-stats" style="margin-top: auto; padding-top: 16px; border-top: 1px solid var(--border-subtle);">
                    <span>View on GitHub ↗</span>
                </div>
            </a>
            `;
        }).join("");

        attachCardTilt(grid);
    };

    const renderSoftwareGrid = (platform) => {
        if (!VALID_TABS.has(platform)) return;
        const grid = document.getElementById(`grid-${platform}`);
        if (!grid) return;

        if (softwareSyncError) {
            grid.innerHTML = `<div class="error-banner">${escapeHTML(softwareSyncError)}</div>`;
            updateCountBadge(platform, 0);
            return;
        }

        const allItems = (config.software && Array.isArray(config.software[platform])) ? config.software[platform] : [];
        const query = (searchQueries[platform] || "").toLowerCase();
        const items = allItems.filter(item => (item.name || "").toLowerCase().includes(query));

        updateCountBadge(platform, items.length);

        if (allItems.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-secondary);">No software linked for this platform yet.</div>`;
            return;
        }

        if (items.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-secondary);">No results matching "${escapeHTML(searchQueries[platform])}"</div>`;
            return;
        }

        grid.innerHTML = items.map((item, idx) => {
            const primaryUrl = getPrimaryUrl(item);
            const delay = Math.min(idx * 0.035, 0.55).toFixed(3);
            return `
            <div class="video-card" style="padding: 24px; animation-delay: ${delay}s;" data-external-url="${escapeHTML(primaryUrl)}" tabindex="0" role="link">
                <h4 class="video-title" style="font-size: 16px; margin-bottom: 20px;">
                    ${escapeHTML(item.name)}
                </h4>
                ${buildDownloadButtons(item)}
            </div>
            `;
        }).join("");

        attachCardTilt(grid);
    };

    const renderAllSoftwareTabs = () => {
        fetchGitHubRepos();
        ['windows', 'linux', 'android'].forEach(platform => renderSoftwareGrid(platform));
    };

    const syncGitHubSoftware = async () => {
        renderAllSoftwareTabs();

        try {
            const res = await fetch(`software.json?t=${Date.now()}`, {
                method: 'GET',
                mode: 'same-origin',
                cache: 'no-store',
                credentials: 'omit',
                headers: { 'Accept': 'application/json' }
            });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status} loading software.json`);
            }
            const data = await res.json();
            if (data && typeof data === 'object') {
                softwareSyncError = null;
                config.software = {
                    windows: sanitizeSoftwareList(data.windows),
                    linux: sanitizeSoftwareList(data.linux),
                    android: sanitizeSoftwareList(data.android),
                    github: sanitizeSoftwareList(data.github)
                };
                saveConfig();
                renderAllSoftwareTabs();
            }
        } catch (err) {
            console.warn("Failed to sync software data securely:", err);
            const hasCached = ['github', 'windows', 'linux', 'android'].some(
                k => Array.isArray(config.software?.[k]) && config.software[k].length > 0
            );
            if (!hasCached) {
                softwareSyncError = "Unable to load software.json. Make sure software.json contains valid JSON and is served over HTTP/HTTPS.";
                renderAllSoftwareTabs();
            }
        }
    };

    const handleSearch = (tabId = 'youtube') => {
        if (!VALID_TABS.has(tabId)) return;
        const inputMap = {
            youtube: "searchInput",
            github: "searchGithub",
            windows: "searchWindows",
            linux: "searchLinux",
            android: "searchAndroid"
        };
        const inputEl = document.getElementById(inputMap[tabId]);
        if (!inputEl) return;

        searchQueries[tabId] = inputEl.value.trim();

        if (tabId === 'youtube') {
            renderVideos();
        } else if (tabId === 'github') {
            fetchGitHubRepos();
        } else {
            renderSoftwareGrid(tabId);
        }
    };

    const renderVideos = () => {
        const sortModeEl = document.getElementById("sortMode");
        const sortMode = sortModeEl ? sortModeEl.value : 'views';
        const query = (searchQueries.youtube || "").toLowerCase();

        const sorted = [...(config.videos || [])]
            .filter(v => (v.title || "").toLowerCase().includes(query))
            .sort((a, b) => {
                if (sortMode === "views") return (b.views || 0) - (a.views || 0);
                return new Date(b.publishedAt) - new Date(a.publishedAt);
            });

        updateCountBadge("youtube", sorted.length);

        const gridEl = document.getElementById("videoGrid");
        if (!gridEl) return;

        if (config.videos && config.videos.length > 0 && sorted.length === 0) {
            gridEl.innerHTML = `<div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-secondary);">No results found for "${escapeHTML(searchQueries.youtube)}"</div>`;
            return;
        }

        if (sorted.length === 0) {
            gridEl.innerHTML = `
                <div style="grid-column: 1 / -1; padding: 60px 32px; background: rgba(0,0,0,0.35); border: 1px dashed var(--border-subtle); border-radius: 12px; text-align: center;">
                    <h3 style="font-size: 16px; font-weight: 500; color: var(--text-primary); margin-bottom: 8px;">Waiting for Feed Sync</h3>
                    <p style="font-size: 13px; color: var(--text-secondary);">Videos will appear here securely once synced.</p>
                </div>
            `;
            return;
        }

        gridEl.innerHTML = sorted.map((v, idx) => {
            const dateObj = new Date(v.publishedAt);
            const formattedDate = !isNaN(dateObj) ? dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown Date';
            const delay = Math.min(idx * 0.035, 0.55).toFixed(3);

            return `
            <article class="video-card" data-video-id="${escapeHTML(v.id)}" data-video-title="${escapeHTML(v.title)}" style="animation-delay: ${delay}s;" tabindex="0" role="button">
                <div class="thumb-container">
                    <img src="${escapeHTML(sanitizeUrl(v.thumbnail))}" alt="${escapeHTML(v.title)}" loading="lazy" />
                    <div class="play-overlay"><div class="play-circle">▶</div></div>
                </div>
                <div class="card-body">
                    <h4 class="video-title">${escapeHTML(v.title)}</h4>
                    <div class="video-stats">
                        <span class="views-pill">${formatViews(v.views)}</span>
                        <span><time datetime="${escapeHTML(v.publishedAt)}">${formattedDate}</time></span>
                    </div>
                </div>
            </article>
            `;
        }).join("");

        attachCardTilt(gridEl);
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
        if (!config.channelId || !config.apiKey) {
            renderVideos();
            return;
        }

        if (!config.videos || config.videos.length === 0) renderSkeletons();

        try {
            const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?key=${encodeURIComponent(config.apiKey)}&channelId=${encodeURIComponent(config.channelId)}&part=snippet,id&order=date&maxResults=30&type=video`, {
                method: 'GET',
                mode: 'cors',
                credentials: 'omit'
            });
            if (!searchRes.ok) throw new Error("YouTube search failed");
            const searchData = await searchRes.json();

            if (searchData.items && searchData.items.length > 0) {
                const ids = searchData.items
                    .map(item => item.id?.videoId)
                    .filter(isValidVideoId)
                    .join(",");

                if (!ids) throw new Error("No valid video IDs");

                const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?key=${encodeURIComponent(config.apiKey)}&id=${encodeURIComponent(ids)}&part=snippet,statistics`, {
                    method: 'GET',
                    mode: 'cors',
                    credentials: 'omit'
                });
                if (!statsRes.ok) throw new Error("YouTube stats failed");
                const statsData = await statsRes.json();

                if (Array.isArray(statsData.items)) {
                    config.videos = statsData.items
                        .filter(v => v && isValidVideoId(v.id))
                        .map(v => ({
                            id: v.id,
                            title: String(v.snippet?.title || "Untitled Video").slice(0, 200),
                            views: parseInt(v.statistics?.viewCount || "0", 10),
                            publishedAt: String(v.snippet?.publishedAt || ""),
                            thumbnail: sanitizeUrl(v.snippet?.thumbnails?.high?.url || v.snippet?.thumbnails?.medium?.url)
                        }));
                    saveConfig();
                }
            }
        } catch (_) {
            // Fallback to cached videos silently
        }
        renderVideos();
    };

    const openPlayer = (videoId, title) => {
        if (!isValidVideoId(videoId)) return;
        const titleEl = document.getElementById("playerTitle");
        const iframeEl = document.getElementById("youtubeIframe");
        const modalEl = document.getElementById("playerModal");

        if (titleEl) titleEl.textContent = title || "Now Playing";
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
        const trigger = document.getElementById('sortSelectTrigger');
        if (!opts) return;
        const isHidden = opts.classList.toggle('hidden');
        if (trigger) trigger.setAttribute('aria-expanded', String(!isHidden));
    };

    const selectSort = (val, text) => {
        if (val !== 'views' && val !== 'newest') return;
        const sortModeEl = document.getElementById('sortMode');
        const displayEl = document.getElementById('sortModeDisplay');
        const optsEl = document.getElementById('sortModeOptions');
        const trigger = document.getElementById('sortSelectTrigger');

        if (sortModeEl) sortModeEl.value = val;
        if (displayEl) displayEl.textContent = text;
        if (optsEl) optsEl.classList.add('hidden');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
        renderVideos();
    };

    // Interactive Circuit-Constellation + Shooting Data Pulses + Pulse Rings on Black Background
    const initParticles = () => {
        const canvas = document.getElementById("bgParticles");
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);

        const mouse = { x: -9999, y: -9999, radius: 150 };

        window.addEventListener("mousemove", (e) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        });

        window.addEventListener("touchmove", (e) => {
            if (e.touches && e.touches.length > 0) {
                mouse.x = e.touches[0].clientX;
                mouse.y = e.touches[0].clientY;
            }
        }, { passive: true });

        window.addEventListener("touchend", () => {
            mouse.x = -9999;
            mouse.y = -9999;
        });

        window.addEventListener("mouseleave", () => {
            mouse.x = -9999;
            mouse.y = -9999;
        });

        window.addEventListener("resize", () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        });

        const palette = ["#22d3ee", "#818cf8", "#34d399"];
        const count = Math.min(58, Math.max(30, Math.floor((width * height) / 23000)));

        const particles = Array.from({ length: count }, (_, i) => ({
            x: Math.random() * width,
            y: Math.random() * height,
            r: Math.random() * 2 + 0.9,
            vx: (Math.random() - 0.5) * 0.52,
            vy: (Math.random() - 0.5) * 0.52,
            color: palette[i % palette.length],
            pulse: Math.random() * Math.PI * 2
        }));

        const pulses = Array.from({ length: 6 }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            len: Math.random() * 85 + 55,
            speed: Math.random() * 2.5 + 1.8,
            horizontal: Math.random() > 0.5,
            alpha: Math.random() * 0.3 + 0.14
        }));

        const rings = Array.from({ length: 3 }, (_, idx) => ({
            x: Math.random() * width,
            y: Math.random() * height,
            r: idx * 35,
            maxR: 115 + Math.random() * 65,
            speed: 0.48 + Math.random() * 0.25,
            color: palette[idx % palette.length]
        }));

        const animate = () => {
            ctx.clearRect(0, 0, width, height);

            // Expanding signal rings
            for (const ring of rings) {
                ring.r += ring.speed;
                if (ring.r > ring.maxR) {
                    ring.r = 2;
                    ring.x = Math.random() * width;
                    ring.y = Math.random() * height;
                }
                const alpha = (1 - ring.r / ring.maxR) * 0.2;
                ctx.beginPath();
                ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
                ctx.strokeStyle = ring.color === "#22d3ee"
                    ? `rgba(34, 211, 238, ${alpha.toFixed(3)})`
                    : ring.color === "#818cf8"
                        ? `rgba(129, 140, 248, ${alpha.toFixed(3)})`
                        : `rgba(52, 211, 153, ${alpha.toFixed(3)})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // Shooting circuit data pulses
            for (const beam of pulses) {
                if (beam.horizontal) {
                    beam.x += beam.speed;
                    if (beam.x > width + beam.len) {
                        beam.x = -beam.len;
                        beam.y = Math.random() * height;
                    }
                    const grad = ctx.createLinearGradient(beam.x - beam.len, beam.y, beam.x, beam.y);
                    grad.addColorStop(0, "rgba(34, 211, 238, 0)");
                    grad.addColorStop(1, `rgba(34, 211, 238, ${beam.alpha})`);
                    ctx.strokeStyle = grad;
                    ctx.lineWidth = 1.6;
                    ctx.beginPath();
                    ctx.moveTo(beam.x - beam.len, beam.y);
                    ctx.lineTo(beam.x, beam.y);
                    ctx.stroke();
                } else {
                    beam.y += beam.speed;
                    if (beam.y > height + beam.len) {
                        beam.y = -beam.len;
                        beam.x = Math.random() * width;
                    }
                    const grad = ctx.createLinearGradient(beam.x, beam.y - beam.len, beam.x, beam.y);
                    grad.addColorStop(0, "rgba(129, 140, 248, 0)");
                    grad.addColorStop(1, `rgba(129, 140, 248, ${beam.alpha})`);
                    ctx.strokeStyle = grad;
                    ctx.lineWidth = 1.6;
                    ctx.beginPath();
                    ctx.moveTo(beam.x, beam.y - beam.len);
                    ctx.lineTo(beam.x, beam.y);
                    ctx.stroke();
                }
            }

            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                p.pulse += 0.03;
                p.x = (p.x + p.vx + width) % width;
                p.y = (p.y + p.vy + height) % height;

                const dxMouse = p.x - mouse.x;
                const dyMouse = p.y - mouse.y;
                const distMouse = Math.hypot(dxMouse, dyMouse);
                if (distMouse < mouse.radius && distMouse > 0) {
                    const force = (mouse.radius - distMouse) / mouse.radius;
                    p.x += (dxMouse / distMouse) * force * 1.15;
                    p.y += (dyMouse / distMouse) * force * 1.15;

                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(mouse.x, mouse.y);
                    ctx.strokeStyle = `rgba(34, 211, 238, ${(force * 0.38).toFixed(3)})`;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }

                const radius = p.r + Math.sin(p.pulse) * 0.4;
                ctx.beginPath();
                ctx.arc(p.x, p.y, Math.max(0.5, radius), 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.fill();

                for (let j = i + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
                    if (dist < 135) {
                        const alpha = (1 - dist / 135) * 0.25;
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = `rgba(129, 140, 248, ${alpha.toFixed(3)})`;
                        ctx.lineWidth = 0.85;
                        ctx.stroke();
                    }
                }
            }
            requestAnimationFrame(animate);
        };
        animate();
    };

    const bindEventListeners = () => {
        // Sidebar tab buttons
        document.querySelectorAll("[data-tab]").forEach(btn => {
            btn.addEventListener("click", () => {
                switchTab(btn.getAttribute("data-tab"));
            });
        });

        // Coming-soon social buttons
        document.querySelectorAll("[data-coming-soon]").forEach(btn => {
            btn.addEventListener("click", () => {
                const name = btn.getAttribute("data-coming-soon");
                showToast(`${name} link coming soon!`);
            });
        });

        // Search inputs
        document.querySelectorAll("[data-search-tab]").forEach(input => {
            const tab = input.getAttribute("data-search-tab");
            input.addEventListener("input", () => handleSearch(tab));
            input.addEventListener("keydown", (e) => {
                if (e.key === "Escape") {
                    input.value = "";
                    handleSearch(tab);
                }
            });
        });

        // Custom sort dropdown
        const sortTrigger = document.getElementById("sortSelectTrigger");
        if (sortTrigger) {
            sortTrigger.addEventListener("click", toggleSortSelect);
            sortTrigger.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleSortSelect();
                }
            });
        }

        document.querySelectorAll("[data-sort-val]").forEach(opt => {
            opt.addEventListener("click", () => {
                selectSort(opt.getAttribute("data-sort-val"), opt.getAttribute("data-sort-label"));
            });
        });

        // Event delegation for Video cards and Software cards
        const mainContent = document.getElementById("mainContent");
        if (mainContent) {
            mainContent.addEventListener("click", (e) => {
                if (e.target.closest("a.drive-btn")) return;

                const videoCard = e.target.closest("[data-video-id]");
                if (videoCard) {
                    openPlayer(videoCard.getAttribute("data-video-id"), videoCard.getAttribute("data-video-title"));
                    return;
                }

                const extCard = e.target.closest("[data-external-url]");
                if (extCard) {
                    openExternalLink(extCard.getAttribute("data-external-url"));
                }
            });

            mainContent.addEventListener("keydown", (e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                const videoCard = e.target.closest("[data-video-id]");
                if (videoCard) {
                    e.preventDefault();
                    openPlayer(videoCard.getAttribute("data-video-id"), videoCard.getAttribute("data-video-title"));
                    return;
                }
                const extCard = e.target.closest("[data-external-url]");
                if (extCard) {
                    e.preventDefault();
                    openExternalLink(extCard.getAttribute("data-external-url"));
                }
            });
        }

        // Modal close handlers
        const modal = document.getElementById("playerModal");
        const modalBox = document.getElementById("playerModalBox");
        const closeBtn = document.getElementById("closeModalBtn");

        if (modal) modal.addEventListener("click", closePlayer);
        if (modalBox) modalBox.addEventListener("click", (e) => e.stopPropagation());
        if (closeBtn) closeBtn.addEventListener("click", closePlayer);

        // Close sort dropdown on outside click
        document.addEventListener("click", (e) => {
            if (!e.target.closest(".custom-select-wrapper")) {
                const sOpts = document.getElementById("sortModeOptions");
                const trigger = document.getElementById("sortSelectTrigger");
                if (sOpts) sOpts.classList.add("hidden");
                if (trigger) trigger.setAttribute("aria-expanded", "false");
            }
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") closePlayer();
        });
    };

    window.addEventListener("DOMContentLoaded", () => {
        bindEventListeners();
        initProfile();
        initTypewriter();
        initParticles();
        animateSectionHeading("youtube");
        syncGitHubSoftware();
        syncYouTubeVideos();
    });

    return Object.freeze({
        switchTab,
        handleSearch,
        openPlayer,
        closePlayer,
        toggleSortSelect,
        selectSort,
        openExternalLink
    });
})();
