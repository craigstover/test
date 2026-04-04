const statusEl = document.getElementById('status');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const emptyState = document.getElementById('empty-state');
const eventsSection = document.getElementById('section-events');

document.getElementById('scanBtn').addEventListener('click', loadEvents);

async function loadEvents() {
    emptyState.style.display = 'none';
    setLoading(true);
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

        renderEventGroup('events-active', 'now on', active);
        renderEventGroup('events-upcoming', 'upcoming', upcoming);

        eventsSection.style.display = 'block';

        const note = data.failedSources?.length ? ` — ${data.failedSources.length} sources unavailable` : '';
        statusEl.textContent = `${active.length + upcoming.length} events${note}`;

    } catch (err) {
        showError(`failed to load events: ${err.message}`);
        emptyState.style.display = 'flex';
        statusEl.textContent = '';
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

function venueFallbackSvg(venueName) {
    const lines = [];
    const words = venueName.split(' ');
    let line = '';
    for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (test.length > 22 && line) {
            lines.push(line);
            line = word;
        } else {
            line = test;
        }
    }
    if (line) lines.push(line);

    const lineHeight = 26;
    const totalHeight = lines.length * lineHeight;
    const startY = 150 - (totalHeight / 2) + lineHeight / 2;

    const textEls = lines.map((l, i) =>
        `<text x="200" y="${startY + i * lineHeight}" font-family="Helvetica Neue,Helvetica,Arial,sans-serif" font-size="15" font-weight="500" fill="#8a8680" text-anchor="middle" dominant-baseline="middle">${l}</text>`
    ).join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#f7f7f6"/>${textEls}</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function renderEventCard(event) {
    const title = event.title || 'untitled';
    const venue = event.venue || '';
    const dates = event.dates || '';
    const artist = event.artist && event.artist !== 'null' ? `<div class="event-artist">${event.artist}</div>` : '';
    const location = event.city && event.state ? `<div class="event-location">${event.city}, ${event.state}</div>` : '';
    const description = event.description ? `<div class="event-description">${event.description}</div>` : '';
    const type = event.type ? `<div class="event-type-tag">${event.type}</div>` : '';
    const svgFallback = venueFallbackSvg(venue);
    const imgSrc = event.imageUrl || svgFallback;
    const image = `<img src="${imgSrc}" alt="${venue}" loading="lazy" onerror="this.onerror=null;this.src='${svgFallback}';this.classList.add('is-logo')">`;
    const link = event.sourceUrl
        ? `<a class="event-link" href="${event.sourceUrl}" target="_blank" rel="noopener">view source ↗</a>`
        : '';

    return `
        <div class="event-card">
            <div class="event-image">${image}</div>
            <div class="event-card-body">
                ${type}
                <div class="event-title">${title}</div>
                ${artist}
                <div class="event-venue">${venue}</div>
                ${location}
                ${dates ? `<div class="event-dates">${dates}</div>` : ''}
                ${description}
                ${link}
            </div>
        </div>
    `;
}

function setLoading(isLoading) {
    loadingEl.style.display = isLoading ? 'block' : 'none';
}

function showError(message) {
    errorEl.innerHTML = `<div class="error">${message}</div>`;
    errorEl.style.display = 'block';
}
