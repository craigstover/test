const statusEl = document.getElementById('status');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const navBtns = document.querySelectorAll('.nav-btn');

// Section state — track if each section has been loaded
const loaded = { events: false, venues: false, artists: false };

// Nav tab switching
navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const section = btn.dataset.section;
        navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
        document.getElementById(`section-${section}`).style.display = 'block';
        if (!loaded[section]) loadSection(section);
    });
});

function loadSection(section) {
    if (section === 'events') loadEvents();
    if (section === 'venues') loadVenues();
    if (section === 'artists') loadArtists();
}

// ── Events ────────────────────────────────────────────────────────────────────

async function loadEvents() {
    setLoading(true, 'Scanning sources...');
    errorEl.style.display = 'none';

    try {
        const res = await fetch('/api/scan-museums', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const active = (data.events || []).filter(e => !e.isUpcoming);
        const upcoming = (data.events || []).filter(e => e.isUpcoming);

        renderEventGroup('events-active', 'Now On', active);
        renderEventGroup('events-upcoming', 'Upcoming', upcoming);

        loaded.events = true;
        const note = data.failedSources?.length ? ` — ${data.failedSources.length} sources unavailable` : '';
        statusEl.textContent = `${active.length + upcoming.length} events${note}`;

    } catch (err) {
        showError(`Failed to load events: ${err.message}`);
        statusEl.textContent = 'Error';
    } finally {
        setLoading(false);
    }
}

function renderEventGroup(containerId, label, events) {
    const container = document.getElementById(containerId);
    if (!events.length) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = `
        <div class="events-group">
            <h2 class="section-label">${label}</h2>
            <div class="events-grid">
                ${events.map(renderEventCard).join('')}
            </div>
        </div>
    `;
}

function renderEventCard(event) {
    const title = event.title || 'Untitled';
    const venue = event.venue || '';
    const dates = event.dates || '';
    const artist = event.artist && event.artist !== 'null' ? `<div class="event-artist">${event.artist}</div>` : '';
    const location = event.city && event.state ? `<div class="event-location">${event.city}, ${event.state}</div>` : '';
    const link = event.sourceUrl
        ? `<a class="event-link" href="${event.sourceUrl}" target="_blank" rel="noopener">View source ↗</a>`
        : '';

    return `
        <div class="event-card">
            <div class="event-title">${title}</div>
            ${artist}
            <div class="event-venue">${venue}</div>
            ${location}
            ${dates ? `<div class="event-dates">${dates}</div>` : ''}
            ${link}
        </div>
    `;
}

// ── Venues ────────────────────────────────────────────────────────────────────

async function loadVenues() {
    setLoading(true, 'Finding venues...');
    errorEl.style.display = 'none';

    try {
        const res = await fetch('/api/discover-venues', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const container = document.getElementById('section-venues');
        container.innerHTML = `
            <div class="events-grid">
                ${(data.venues || []).map(v => `
                    <div class="event-card">
                        <div class="event-title">${v.name}</div>
                        <div class="event-venue">${v.neighborhood}</div>
                        <div class="event-description">${v.focus}</div>
                        <div class="event-description" style="margin-top:0.5rem;">${v.reason}</div>
                    </div>
                `).join('')}
            </div>
        `;

        loaded.venues = true;
        statusEl.textContent = `${(data.venues || []).length} venues`;

    } catch (err) {
        showError(`Failed to load venues: ${err.message}`);
        statusEl.textContent = 'Error';
    } finally {
        setLoading(false);
    }
}

// ── Artists ───────────────────────────────────────────────────────────────────

async function loadArtists() {
    setLoading(true, 'Finding artists...');
    errorEl.style.display = 'none';

    try {
        const res = await fetch('/api/similar-artists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const container = document.getElementById('section-artists');
        container.innerHTML = `
            <div class="events-grid">
                ${(data.artists || []).map(a => `
                    <div class="event-card">
                        <div class="event-title">${a.name}</div>
                        <div class="event-description">${a.connection}</div>
                        ${a.currentShow ? `<div class="event-dates" style="margin-top:0.75rem;">${a.currentShow}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;

        loaded.artists = true;
        statusEl.textContent = `${(data.artists || []).length} artists`;

    } catch (err) {
        showError(`Failed to load artists: ${err.message}`);
        statusEl.textContent = 'Error';
    } finally {
        setLoading(false);
    }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function setLoading(isLoading, message = '') {
    loadingEl.style.display = isLoading ? 'block' : 'none';
    document.querySelectorAll('.content-section').forEach(s => {
        s.style.opacity = isLoading ? '0.4' : '1';
    });
    if (message) statusEl.textContent = message;
}

function showError(message) {
    errorEl.innerHTML = `<div class="error">${message}</div>`;
    errorEl.style.display = 'block';
}

// Auto-load events on page load
loadEvents();
