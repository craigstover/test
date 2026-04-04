// UI Elements
const scanBtn = document.getElementById('scanBtn');
const similarArtistsBtn = document.getElementById('similarArtistsBtn');
const discoverVenuesBtn = document.getElementById('discoverVenuesBtn');
const brooklynRailBtn = document.getElementById('brooklynRailBtn');
const scanMuseumsBtn = document.getElementById('scanMuseumsBtn');
const loading = document.getElementById('loading');
const eventsContainer = document.getElementById('events');
const errorContainer = document.getElementById('error');
const status = document.getElementById('status');
const statsBar = document.getElementById('statsBar');

// Event listeners
scanBtn.addEventListener('click', () => scanForEvents());
similarArtistsBtn.addEventListener('click', () => findSimilarArtists());
discoverVenuesBtn.addEventListener('click', () => discoverVenues());
brooklynRailBtn.addEventListener('click', () => scanBrooklynRail());
scanMuseumsBtn.addEventListener('click', () => scanMuseums());

async function scanForEvents() {
    setLoading(true);
    status.textContent = 'Scanning sources...';
    errorContainer.style.display = 'none';

    try {
        const response = await fetch('/api/scan-events', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        displayEvents(data.events);
        updateStats(data.events);
        status.textContent = 'Scan complete';

    } catch (error) {
        console.error('Error:', error);
        showError(`Failed to scan events: ${error.message}`);
        status.textContent = 'Scan failed';
    } finally {
        setLoading(false);
    }
}

async function findSimilarArtists() {
    setLoading(true);
    status.textContent = 'Finding similar artists...';
    errorContainer.style.display = 'none';

    try {
        const response = await fetch('/api/similar-artists', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        displaySimilarArtists(data.artists);
        status.textContent = 'Artists found';

    } catch (error) {
        console.error('Error:', error);
        showError(`Failed to find similar artists: ${error.message}`);
        status.textContent = 'Search failed';
    } finally {
        setLoading(false);
    }
}

async function discoverVenues() {
    setLoading(true);
    status.textContent = 'Discovering venues...';
    errorContainer.style.display = 'none';

    try {
        const response = await fetch('/api/discover-venues', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        displayVenues(data.venues);
        status.textContent = 'Venues found';

    } catch (error) {
        console.error('Error:', error);
        showError(`Failed to discover venues: ${error.message}`);
        status.textContent = 'Search failed';
    } finally {
        setLoading(false);
    }
}

function displayEvents(events) {
    if (!events || events.length === 0) {
        eventsContainer.innerHTML = '<div class="empty-state"><h3>No events found</h3><p>Try scanning again</p></div>';
        return;
    }

    // Sort by match score
    events.sort((a, b) => b.matchScore - a.matchScore);

    const html = `
        <div class="events-grid">
            ${events.map(event => `
                <div class="event-card">
                    <div class="event-header">
                        <div class="event-type">${event.type}</div>
                        <div class="match-score">${event.matchScore}% match</div>
                    </div>
                    <div class="event-title">${event.title}</div>
                    <div class="event-artist">${event.artist}</div>
                    <div class="event-venue">${event.venue}${event.isNewVenue ? ' ✦' : ''}</div>
                    <div class="event-dates">${event.dates}</div>
                    <div class="event-description">${event.description}</div>
                    <div class="event-tags">
                        ${event.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    eventsContainer.innerHTML = html;
}

function displaySimilarArtists(artists) {
    const html = `
        <div class="events-grid">
            ${artists.map(artist => `
                <div class="event-card">
                    <div class="event-header">
                        <div class="event-type">Artist</div>
                    </div>
                    <div class="event-title">${artist.name}</div>
                    <div class="event-description">${artist.connection}</div>
                    ${artist.currentShow ? `<div class="event-dates" style="margin-top: 0.75rem;">Currently: ${artist.currentShow}</div>` : ''}
                </div>
            `).join('')}
        </div>
    `;

    eventsContainer.innerHTML = html;
    statsBar.style.display = 'none';
}

function displayVenues(venues) {
    const html = `
        <div class="events-grid">
            ${venues.map(venue => `
                <div class="event-card">
                    <div class="event-header">
                        <div class="event-type">Venue</div>
                    </div>
                    <div class="event-title">${venue.name}</div>
                    <div class="event-venue">${venue.neighborhood}</div>
                    <div class="event-description" style="margin-top: 0.75rem;"><strong>Focus:</strong> ${venue.focus}</div>
                    <div class="event-description">${venue.reason}</div>
                </div>
            `).join('')}
        </div>
    `;

    eventsContainer.innerHTML = html;
    statsBar.style.display = 'none';
}

function updateStats(events) {
    document.getElementById('eventCount').textContent = events.length;
    document.getElementById('highMatchCount').textContent =
        events.filter(e => e.matchScore >= 85).length;
    document.getElementById('venueCount').textContent =
        events.filter(e => e.isNewVenue).length;
    statsBar.style.display = 'flex';
}

async function scanMuseums() {
    setLoading(true);
    status.textContent = 'Scanning museums...';
    errorContainer.style.display = 'none';

    try {
        const response = await fetch('/api/scan-museums', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        displayEvents(data.events);
        updateStats(data.events);

        const note = data.failedSources && data.failedSources.length > 0
            ? ` (${data.failedSources.join(', ')} unavailable)`
            : '';
        status.textContent = `Museum scan complete${note}`;

    } catch (error) {
        console.error('Error:', error);
        showError(`Failed to scan museums: ${error.message}`);
        status.textContent = 'Scan failed';
    } finally {
        setLoading(false);
    }
}

async function scanBrooklynRail() {
    setLoading(true);
    status.textContent = 'Fetching Brooklyn Rail listings...';
    errorContainer.style.display = 'none';

    try {
        const response = await fetch('/api/brooklyn-rail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        displayEvents(data.events);
        updateStats(data.events);
        status.textContent = 'Brooklyn Rail scan complete';

    } catch (error) {
        console.error('Error:', error);
        showError(`Failed to fetch Brooklyn Rail: ${error.message}`);
        status.textContent = 'Scan failed';
    } finally {
        setLoading(false);
    }
}

function setLoading(isLoading) {
    loading.style.display = isLoading ? 'block' : 'none';
    scanBtn.disabled = isLoading;
    similarArtistsBtn.disabled = isLoading;
    discoverVenuesBtn.disabled = isLoading;
    brooklynRailBtn.disabled = isLoading;
    scanMuseumsBtn.disabled = isLoading;
    eventsContainer.style.display = isLoading ? 'none' : 'block';
}

function showError(message) {
    errorContainer.innerHTML = `<div class="error">${message}</div>`;
    errorContainer.style.display = 'block';
}
