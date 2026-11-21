"use strict";

const CreatorHub = (() => {
    const DEFAULT_LOGO_SVG = `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="9" width="18" height="18" rx="4" stroke="#ffffff" stroke-width="2.2"/><path d="M14 22V14L22 22V14" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/><path d="M13 4V9M23 4V9M13 27V32M23 27V32M4 13H9M4 23H9M27 13H32M27 23H32" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/></svg>`;

    const DEFAULT_CONFIG = Object.freeze({
        channelName: "Nextcircuit",
        githubUser: "RahatArafat4322",
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

    let siteConfig = {
        channelName: DEFAULT_CONFIG.channelName,
        handle: "@next_circuit",
        bio: "Embedded systems, STM32, ESP32, and Arduino builds—plus PCB design and open-source tools.",
        typewriterPhrases: [
            "Embedded Systems & PCB Design",
            "STM32 & ARM Cortex-M Firmware",
            "ESP32 & IoT Wireless Projects",
            "Arduino & Hardware Engineering",
            "Open-Source Tools & Software"
        ],
        topics: [
            { id: "all", label: "All" },
            { id: "stm32", label: "STM32" },
            { id: "esp32", label: "ESP32" },
            { id: "arduino", label: "Arduino" },
            { id: "pcb", label: "PCB" }
        ],
        channelId: DEFAULT_CONFIG.channelId,
        apiKey: DEFAULT_CONFIG.apiKey
    };

    let activeTopic = "all";
    let softwareSyncError = null;
    let youtubeSyncError = null;
    let toastTimer = null;

    // SECURITY: Strict URL allowlist (only HTTPS external URLs or safe relative asset paths)
    const sanitizeUrl = (url) => {
        if (!url || typeof url !== "string") return "#";
        const trimmed = url.trim();
        if (!trimmed || /^(\/\/|javascript:|vbscript:|data:|file:|blob:)/i.test(trimmed)) return "#";

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

    const isValidVideoId = (id) => typeof id === "string" && /^[a-zA-Z0-9_-]{11}$/.test(id);

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
                version: typeof item.version === "string" ? item.version.slice(0, 32) : "",
                size: typeof item.size === "string" ? item.size.slice(0, 32) : "",
                description: typeof item.description === "string" ? item.description.slice(0, 10000) : "",
                language: typeof item.language === "string" ? item.language.slice(0, 40) : "",
                credit: typeof item.credit === "string" ? item.credit.slice(0, 60) : "",
                stars: Number.isFinite(Number(item.stars)) ? Number(item.stars) : null,
                updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
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
    };

    const buildDescriptionBlock = (description) => {
        if (!description) return "";
        return `
            <div class="card-desc-wrap">
                <p class="card-desc">${escapeHTML(description)}</p>
                <button type="button" class="desc-toggle-btn hidden" aria-expanded="false">Show more</button>
            </div>
        `;
    };

    const initDescriptionToggles = (container) => {
        if (!container) return;
        requestAnimationFrame(() => {
            container.querySelectorAll(".card-desc-wrap").forEach(wrap => {
                const desc = wrap.querySelector(".card-desc");
                const btn = wrap.querySelector(".desc-toggle-btn");
                if (!desc || !btn) return;
                if (desc.scrollHeight > desc.clientHeight + 2) {
                    btn.classList.remove("hidden");
                } else {
                    btn.classList.add("hidden");
                }
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
                const label = escapeHTML(link.label || "Download");
                return `
                    <a href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer nofollow" class="drive-btn">
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                        ${label}
                    </a>
                `;
            }).join("") + `</div>`;
        }

        const href = getPrimaryUrl(item);
        return `
            <div class="links-stack">
                <a href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer nofollow" class="drive-btn">
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                    Download
                </a>
            </div>
        `;
    };

    const switchTab = (tabId, updateHash = true) => {
        if (!VALID_TABS.has(tabId)) return;

        document.querySelectorAll('button.nav-btn').forEach(btn => btn.classList.remove('active'));
        const navBtn = document.getElementById(`nav-${tabId}`);
        if (navBtn) navBtn.classList.add('active');

        document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
        const tabView = document.getElementById(`tab-${tabId}`);
        if (tabView) tabView.classList.add('active');

        const mainContent = document.getElementById('mainContent');
        if (mainContent) mainContent.scrollTop = 0;

        if (updateHash && window.location.hash !== `#${tabId}`) {
            history.replaceState(null, "", `#${tabId}`);
        }


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

    const initTypewriter = () => {
        const el = document.getElementById("typewriterText");
        if (!el) return;

        let phraseIdx = 0;
        let charIdx = (siteConfig.typewriterPhrases[0] || "").length;
        let isDeleting = true;

        const tick = () => {
            const phrases = Array.isArray(siteConfig.typewriterPhrases) && siteConfig.typewriterPhrases.length > 0
                ? siteConfig.typewriterPhrases
                : ["Embedded Systems & PCB Design"];
            if (phraseIdx >= phrases.length) phraseIdx = 0;
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

        if (softwareSyncError && (!config.software?.github || config.software.github.length === 0)) {
            grid.innerHTML = `<div class="error-banner">${escapeHTML(softwareSyncError)}</div>`;
            updateCountBadge("github", 0);
            return;
        }

        const allRepos = (config.software && Array.isArray(config.software.github)) ? config.software.github : [];
        const query = (searchQueries.github || "").toLowerCase();
        const repos = allRepos.filter(repo =>
            (repo.name || "").toLowerCase().includes(query) ||
            (repo.description || "").toLowerCase().includes(query) ||
            (repo.language || "").toLowerCase().includes(query)
        );

        updateCountBadge("github", repos.length);

        if (allRepos.length === 0) {
            grid.innerHTML = `<div class="grid-empty-state">No repositories linked yet.</div>`;
            return;
        }

        if (repos.length === 0) {
            grid.innerHTML = `<div class="grid-empty-state">No repositories matching "${escapeHTML(searchQueries.github)}"</div>`;
            return;
        }

        grid.innerHTML = repos.map((repo) => {
            const href = sanitizeUrl(repo.url || repo.driveUrl);
            const pills = [];
            if (repo.version) pills.push(`<span class="meta-pill accent">${escapeHTML(repo.version)}</span>`);
            if (repo.language) pills.push(`<span class="meta-pill">${escapeHTML(repo.language)}</span>`);
            if (Number.isFinite(repo.stars) && repo.stars > 0) pills.push(`<span class="meta-pill">★ ${repo.stars}</span>`);

            const descHtml = buildDescriptionBlock(repo.description);

            const updatedLabel = (repo.credit && repo.credit.trim())
                ? repo.credit.trim()
                : (repo.updatedAt
                    ? new Date(repo.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                    : "Repository");

            return `
            <div class="video-card software-card">
                <div class="card-header-row">
                    <h4 class="video-title github-card-title">
                        <svg class="repo-icon" width="18" height="18" viewBox="0 0 16 16" fill="var(--text-muted)"><path fill-rule="evenodd" d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z"></path></svg>
                        <span>${escapeHTML(repo.name)}</span>
                    </h4>
                </div>
                ${descHtml}
                ${pills.length ? `<div class="meta-pills">${pills.join("")}</div>` : ""}
                <div class="card-footer-row">
                    <span class="card-footer-meta">${escapeHTML(updatedLabel)}</span>
                    <div class="links-stack">
                        <a href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer nofollow" class="drive-btn">
                            <svg class="btn-icon" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
                            GitHub ↗
                        </a>
                    </div>
                </div>
            </div>
            `;
        }).join("");
        initDescriptionToggles(grid);
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
        const items = allItems.filter(item =>
            (item.name || "").toLowerCase().includes(query) ||
            (item.description || "").toLowerCase().includes(query)
        );

        updateCountBadge(platform, items.length);

        if (allItems.length === 0) {
            grid.innerHTML = `<div class="grid-empty-state">No software linked for this platform yet.</div>`;
            return;
        }

        if (items.length === 0) {
            grid.innerHTML = `<div class="grid-empty-state">No results matching "${escapeHTML(searchQueries[platform])}"</div>`;
            return;
        }

        grid.innerHTML = items.map((item) => {
            const pills = [];
            if (item.version) pills.push(`<span class="meta-pill accent">${escapeHTML(item.version)}</span>`);

            const descHtml = buildDescriptionBlock(item.description);

            const footerMeta = item.size ? escapeHTML(item.size) : "Ready";
            return `
            <div class="video-card software-card">
                <div class="card-header-row">
                    <h4 class="video-title software-card-title">
                        ${escapeHTML(item.name)}
                    </h4>
                </div>
                ${descHtml}
                ${pills.length ? `<div class="meta-pills">${pills.join("")}</div>` : ""}
                <div class="card-footer-row">
                    <span class="card-footer-meta">${footerMeta}</span>
                    ${buildDownloadButtons(item)}
                </div>
            </div>
            `;
        }).join("");
        initDescriptionToggles(grid);
    };

    const renderAllSoftwareTabs = () => {
        fetchGitHubRepos();
        ['windows', 'linux', 'android'].forEach(platform => renderSoftwareGrid(platform));
    };

    const renderSocialLinks = (links) => {
        const container = document.getElementById("connectLinks");
        if (!container || !Array.isArray(links) || links.length === 0) return;
        container.innerHTML = links
            .filter(item => item && typeof item === "object" && typeof item.name === "string")
            .map(item => {
                const name = item.name.trim().slice(0, 40);
                const icon = sanitizeUrl(item.icon || "");
                const url = sanitizeUrl(item.url || "");
                const iconHtml = icon !== "#"
                    ? `<img src="${escapeHTML(icon)}" alt="${escapeHTML(name)}" class="icon-badge" />`
                    : "";
                if (url !== "#") {
                    return `
                    <a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer nofollow" class="social-btn nav-btn">
                        <div class="social-btn-left">
                            ${iconHtml}
                            <span class="nav-text">${escapeHTML(name)}</span>
                        </div>
                    </a>`;
                }
                return `
                <button type="button" class="social-btn nav-btn" data-coming-soon="${escapeHTML(name)}">
                    <div class="social-btn-left">
                        ${iconHtml}
                        <span class="nav-text">${escapeHTML(name)}</span>
                    </div>
                </button>`;
            }).join("");
    };

    const loadSocialLinks = async () => {
        try {
            const res = await fetch(`social-links.json?t=${Date.now()}`, {
                method: 'GET',
                mode: 'same-origin',
                cache: 'no-store',
                credentials: 'omit',
                headers: { 'Accept': 'application/json' }
            });
            if (!res.ok) return;
            const data = await res.json();
            if (Array.isArray(data)) {
                renderSocialLinks(data);
            }
        } catch (_) {
            // Keep HTML fallback links if social-links.json is missing
        }
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

    const selectTopic = (topic) => {
        activeTopic = topic || "all";
        document.querySelectorAll("[data-topic]").forEach(chip => {
            chip.classList.toggle("active", chip.getAttribute("data-topic") === activeTopic);
        });
        renderVideos();
    };

    const renderVideos = () => {
        const sortModeEl = document.getElementById("sortMode");
        const sortMode = sortModeEl ? sortModeEl.value : 'views';
        const query = (searchQueries.youtube || "").toLowerCase();

        const sorted = [...(config.videos || [])]
            .filter(v => {
                const title = (v.title || "").toLowerCase();
                const matchesQuery = title.includes(query);
                const matchesTopic = activeTopic === "all" || title.includes(activeTopic);
                return matchesQuery && matchesTopic;
            })
            .sort((a, b) => {
                if (sortMode === "views") return (b.views || 0) - (a.views || 0);
                return new Date(b.publishedAt) - new Date(a.publishedAt);
            });

        updateCountBadge("youtube", sorted.length);

        const gridEl = document.getElementById("videoGrid");
        if (!gridEl) return;

        if (config.videos && config.videos.length > 0 && sorted.length === 0) {
            gridEl.innerHTML = `<div class="grid-empty-state">No matching videos found.</div>`;
            return;
        }

        if (sorted.length === 0) {
            if (youtubeSyncError) {
                gridEl.innerHTML = `<div class="error-banner">${escapeHTML(youtubeSyncError)}</div>`;
            } else {
                gridEl.innerHTML = `
                    <div class="waiting-sync-state">
                        <h3>Waiting for Feed Sync</h3>
                        <p>Videos will appear here securely once synced.</p>
                    </div>
                `;
            }
            return;
        }

        gridEl.innerHTML = sorted.map((v) => {
            const dateObj = new Date(v.publishedAt);
            const formattedDate = !isNaN(dateObj) ? dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown Date';

            return `
            <article class="video-card" data-video-id="${escapeHTML(v.id)}" data-video-title="${escapeHTML(v.title)}" tabindex="0" role="button">
                <div class="thumb-container">
                    <img src="${escapeHTML(sanitizeUrl(v.thumbnail))}" alt="${escapeHTML(v.title)}" loading="lazy" decoding="async" />
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

    };

    const renderSkeletons = () => {
        const gridEl = document.getElementById("videoGrid");
        if (!gridEl) return;
        gridEl.innerHTML = Array(6).fill(0).map(() => `
            <div class="skeleton-card">
                <div class="skeleton skeleton-thumb"></div>
                <div class="skeleton-body">
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-title skeleton-title-short"></div>
                    <div class="skeleton skeleton-meta"></div>
                </div>
            </div>
        `).join("");
    };

    const applySiteConfig = () => {
        const nameEl = document.getElementById("displayChannelName");
        if (nameEl) nameEl.textContent = siteConfig.channelName;

        const handleEl = document.querySelector(".channel-handle");
        if (handleEl) handleEl.textContent = siteConfig.handle;

        const bioEl = document.querySelector(".channel-bio");
        if (bioEl) bioEl.textContent = siteConfig.bio;

        const twEl = document.getElementById("typewriterText");
        if (twEl && Array.isArray(siteConfig.typewriterPhrases) && siteConfig.typewriterPhrases.length > 0) {
            twEl.textContent = siteConfig.typewriterPhrases[0];
        }

        const filtersEl = document.getElementById("topicFilters");
        if (filtersEl && Array.isArray(siteConfig.topics)) {
            filtersEl.innerHTML = siteConfig.topics.map(t => {
                const id = String(t.id || "all").toLowerCase();
                const cls = id === activeTopic ? "topic-chip active" : "topic-chip";
                return `<button type="button" class="${cls}" data-topic="${escapeHTML(id)}">${escapeHTML(t.label || id)}</button>`;
            }).join("");
        }
    };

    const syncYouTubeVideos = async () => {
        if (!config.videos || config.videos.length === 0) renderSkeletons();

        try {
            const cfgRes = await fetch(`config.json?t=${Date.now()}`, {
                method: 'GET',
                mode: 'same-origin',
                cache: 'no-store',
                credentials: 'omit',
                headers: { 'Accept': 'application/json' }
            });
            if (cfgRes.ok) {
                const cfgData = await cfgRes.json();
                if (cfgData && typeof cfgData === "object" && !Array.isArray(cfgData)) {
                    if (typeof cfgData.channelName === "string") siteConfig.channelName = cfgData.channelName.slice(0, 60);
                    if (typeof cfgData.handle === "string") siteConfig.handle = cfgData.handle.slice(0, 40);
                    if (typeof cfgData.bio === "string") siteConfig.bio = cfgData.bio.slice(0, 260);
                    if (Array.isArray(cfgData.typewriterPhrases)) {
                        siteConfig.typewriterPhrases = cfgData.typewriterPhrases
                            .filter(p => typeof p === "string" && p.trim())
                            .map(p => p.slice(0, 80));
                    }
                    if (Array.isArray(cfgData.topics)) {
                        siteConfig.topics = cfgData.topics
                            .filter(t => t && typeof t === "object" && typeof t.id === "string" && typeof t.label === "string")
                            .map(t => ({ id: t.id.slice(0, 30), label: t.label.slice(0, 30) }));
                    }
                    if (typeof cfgData.channelId === "string" && /^[a-zA-Z0-9_-]{10,40}$/.test(cfgData.channelId)) {
                        siteConfig.channelId = cfgData.channelId;
                    }
                    if (typeof cfgData.apiKey === "string" && /^[a-zA-Z0-9_-]{20,80}$/.test(cfgData.apiKey)) {
                        siteConfig.apiKey = cfgData.apiKey;
                    }
                    applySiteConfig();
                }
            }
        } catch (_) {
            // Keep defaults if config.json missing
        }

        const apiKey = siteConfig.apiKey || config.apiKey;
        const channelId = siteConfig.channelId || config.channelId;

        if (!channelId || !apiKey) {
            renderVideos();
            return;
        }

        try {
            let idList = [];
            let lastStatus = null;

            if (channelId.startsWith("UC")) {
                const uploadsId = "UU" + channelId.slice(2);
                const plRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?key=${encodeURIComponent(apiKey)}&playlistId=${encodeURIComponent(uploadsId)}&part=snippet&maxResults=30`, {
                    method: 'GET',
                    mode: 'cors',
                    credentials: 'omit'
                });
                if (plRes.ok) {
                    const plData = await plRes.json();
                    if (Array.isArray(plData.items)) {
                        idList = plData.items
                            .map(item => item.snippet?.resourceId?.videoId)
                            .filter(isValidVideoId);
                    }
                } else {
                    lastStatus = plRes.status;
                }
            }

            if (idList.length === 0) {
                const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?key=${encodeURIComponent(apiKey)}&channelId=${encodeURIComponent(channelId)}&part=snippet,id&order=date&maxResults=30&type=video`, {
                    method: 'GET',
                    mode: 'cors',
                    credentials: 'omit'
                });
                if (searchRes.ok) {
                    const searchData = await searchRes.json();
                    if (Array.isArray(searchData.items)) {
                        idList = searchData.items
                            .map(item => item.id?.videoId)
                            .filter(isValidVideoId);
                    }
                } else if (!lastStatus) {
                    lastStatus = searchRes.status;
                }
            }

            if (idList.length === 0) {
                if (!config.videos || config.videos.length === 0) {
                    youtubeSyncError = lastStatus === 403
                        ? "YouTube API returned 403 (check Google Cloud API key referrer restrictions or quota)."
                        : "Could not load YouTube videos (API key restricted, quota exceeded, or offline).";
                }
                renderVideos();
                return;
            }

            const ids = idList.join(",");
            if (ids) {

                const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?key=${encodeURIComponent(apiKey)}&id=${encodeURIComponent(ids)}&part=snippet,statistics`, {
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
                    youtubeSyncError = null;
                    saveConfig();
                }
            }
        } catch (_) {
            if (!config.videos || config.videos.length === 0) {
                youtubeSyncError = "Could not load YouTube videos (check network or API key settings in config.json).";
            }
        }
        renderVideos();
    };

    const openPlayer = (videoId, title) => {
        if (!isValidVideoId(videoId)) return;
        const titleEl = document.getElementById("playerTitle");
        const iframeEl = document.getElementById("youtubeIframe");
        const modalEl = document.getElementById("playerModal");

        if (titleEl) titleEl.textContent = title || "Now Playing";
        if (iframeEl) iframeEl.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`;
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

    const bindEventListeners = () => {
        document.querySelectorAll("[data-tab]").forEach(btn => {
            btn.addEventListener("click", () => {
                switchTab(btn.getAttribute("data-tab"));
            });
        });

        const connectEl = document.getElementById("connectLinks");
        if (connectEl) {
            connectEl.addEventListener("click", (e) => {
                const btn = e.target.closest("[data-coming-soon]");
                if (btn) {
                    const name = btn.getAttribute("data-coming-soon");
                    showToast(`${name} link coming soon!`);
                }
            });
        }

        const filtersEl = document.getElementById("topicFilters");
        if (filtersEl) {
            filtersEl.addEventListener("click", (e) => {
                const chip = e.target.closest("[data-topic]");
                if (chip) selectTopic(chip.getAttribute("data-topic"));
            });
        }

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

        const mainContent = document.getElementById("mainContent");
        if (mainContent) {
            mainContent.addEventListener("click", (e) => {

                const toggleBtn = e.target.closest(".desc-toggle-btn");
                if (toggleBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const wrap = toggleBtn.closest(".card-desc-wrap");
                    const desc = wrap ? wrap.querySelector(".card-desc") : null;
                    if (desc) {
                        const isExpanded = desc.classList.toggle("expanded");
                        toggleBtn.textContent = isExpanded ? "Show less" : "Show more";
                        toggleBtn.setAttribute("aria-expanded", String(isExpanded));
                        if (!isExpanded) desc.scrollTop = 0;
                    }
                    return;
                }

                if (e.target.closest("a.drive-btn")) return;

                const videoCard = e.target.closest("[data-video-id]");
                if (videoCard) {
                    openPlayer(videoCard.getAttribute("data-video-id"), videoCard.getAttribute("data-video-title"));
                    return;
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

            });
        }

        const modal = document.getElementById("playerModal");
        const modalBox = document.getElementById("playerModalBox");
        const closeBtn = document.getElementById("closeModalBtn");

        if (modal) modal.addEventListener("click", closePlayer);
        if (modalBox) modalBox.addEventListener("click", (e) => e.stopPropagation());
        if (closeBtn) closeBtn.addEventListener("click", closePlayer);

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

        window.addEventListener("hashchange", () => {
            const hashTab = window.location.hash.replace(/^#/, "");
            if (VALID_TABS.has(hashTab)) switchTab(hashTab, false);
        });
    };

    window.addEventListener("DOMContentLoaded", () => {
        bindEventListeners();
        initProfile();
        initTypewriter();

        const initialTab = window.location.hash.replace(/^#/, "");
        if (VALID_TABS.has(initialTab)) {
            switchTab(initialTab, false);
        }

        let resizeRaf = 0;
        window.addEventListener("resize", () => {
            if (resizeRaf) return;
            resizeRaf = requestAnimationFrame(() => {
                resizeRaf = 0;
                const activeGrid = document.querySelector(".view-section.active .video-grid");
                if (activeGrid) initDescriptionToggles(activeGrid);
            });
        }, { passive: true });

        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => {
                const activeGrid = document.querySelector(".view-section.active .video-grid");
                if (activeGrid) initDescriptionToggles(activeGrid);
            });
        }

        loadSocialLinks();
        syncGitHubSoftware();
        syncYouTubeVideos();
    });

    return Object.freeze({
        switchTab,
        handleSearch,
        openPlayer,
        closePlayer,
        toggleSortSelect,
        selectSort
    });
})();