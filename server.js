const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// User profile (could be moved to a database later)
const userProfile = {
  artists: ['Cody Hudson', 'Julian Watts', 'Ted Larsen', 'Simone Leigh', 'Julie Mehretu', 'Kevin Beasley', 'Theaster Gates', 'Martin Puryear'],
  venues: ['Karma Gallery', 'The Met', 'Whitney Museum', 'Noguchi Museum', 'Jane Hartsook Gallery'],
  sources: ['Artnet', 'Artsy', 'Upstate Art Weekend', 'Brooklyn Rail']
};

// API Routes
app.post('/api/scan-events', async (req, res) => {
  try {
    const prompt = `You are an art events curator for NYC. Based on this user's taste profile, find current and upcoming art events (gallery openings, museum exhibitions, pop-ups) in New York City.

User's favorite artists: ${userProfile.artists.join(', ')}
User's preferred venues: ${userProfile.venues.join(', ')}

These artists work in contemporary sculpture, abstraction, conceptual art, and socially engaged practices. Find events featuring:
1. These specific artists or venues
2. Similar contemporary artists working in sculpture, installation, abstraction
3. Artists exploring materiality, social themes, and spatial interventions
4. Emerging and established voices in contemporary art

Search recent listings from major NYC venues, galleries in Chelsea, Lower East Side, Tribeca, Brooklyn, and art platforms.

Return ONLY a JSON array with this exact structure (no markdown, no backticks, no preamble):
{
  "events": [
    {
      "title": "Exhibition title",
      "artist": "Artist name(s)",
      "venue": "Gallery/Museum name",
      "type": "opening|exhibition|popup|talk",
      "dates": "Date range",
      "description": "2-3 sentence description",
      "matchScore": 85-100 for direct matches, 70-84 for similar artists, 60-69 for thematic connections,
      "tags": ["sculpture", "abstraction", etc],
      "isNewVenue": true if venue not in user's list
    }
  ]
}

Make events realistic and current (April 2026). Include mix of 10-12 events with well-known and emerging artists.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const content = message.content[0].text;

    // Extract JSON from response
    let jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) {
      jsonMatch = content.match(/\{[\s\S]*\}/);
    }

    const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
    const eventsData = JSON.parse(jsonString);

    res.json(eventsData);
  } catch (error) {
    console.error('Error scanning events:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/similar-artists', async (req, res) => {
  try {
    const prompt = `Based on these artists: ${userProfile.artists.join(', ')}, recommend 10-12 contemporary artists working in similar areas (sculpture, installation, abstraction, conceptual, socially engaged art).

For each artist, explain the connection in one sentence and mention if they have upcoming shows in NYC.

Return ONLY JSON (no markdown, no backticks, no preamble):
{
  "artists": [
    {
      "name": "Artist name",
      "connection": "Why similar to user's taste",
      "currentShow": "NYC show info if any, or null"
    }
  ]
}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const content = message.content[0].text;
    let jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) {
      jsonMatch = content.match(/\{[\s\S]*\}/);
    }

    const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
    const artistsData = JSON.parse(jsonString);

    res.json(artistsData);
  } catch (error) {
    console.error('Error finding similar artists:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/discover-venues', async (req, res) => {
  try {
    const prompt = `Based on these venues: ${userProfile.venues.join(', ')}, recommend 15-20 NYC galleries, museums, and art spaces that show similar contemporary art (sculpture, installation, conceptual, emerging artists).

Include a mix of: established galleries, emerging spaces, non-profit spaces, museums, and alternative venues. Cover different neighborhoods.

Return ONLY JSON (no markdown, no backticks, no preamble):
{
  "venues": [
    {
      "name": "Venue name",
      "neighborhood": "Location",
      "focus": "What they show",
      "reason": "Why recommended"
    }
  ]
}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const content = message.content[0].text;
    let jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) {
      jsonMatch = content.match(/\{[\s\S]*\}/);
    }

    const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
    const venuesData = JSON.parse(jsonString);

    res.json(venuesData);
  } catch (error) {
    console.error('Error discovering venues:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/brooklyn-rail', async (req, res) => {
  try {
    // Fetch Brooklyn Rail ArtSeen listings
    const response = await fetch('https://brooklynrail.org/artseen/');
    if (!response.ok) {
      throw new Error(`Failed to fetch Brooklyn Rail: ${response.status}`);
    }
    const html = await response.text();

    // Strip HTML tags to reduce tokens
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 15000); // Keep within token limits

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `Here is the text content from the Brooklyn Rail ArtSeen listings page. Extract all exhibition listings you can find.

Then filter and rank them based on this user's taste profile:
- Favorite artists: ${userProfile.artists.join(', ')}
- Preferred venues: ${userProfile.venues.join(', ')}
- Interests: contemporary sculpture, abstraction, conceptual art, socially engaged practices, installation, materiality

PAGE CONTENT:
${text}

Return ONLY JSON (no markdown, no backticks, no preamble):
{
  "events": [
    {
      "title": "Exhibition title",
      "artist": "Artist name(s)",
      "venue": "Gallery/Museum name",
      "dates": "Date range if found, or null",
      "description": "Brief description from the listing",
      "matchScore": 85-100 for strong match to taste profile, 70-84 for moderate, 60-69 for loose connection,
      "tags": ["relevant", "tags"],
      "isNewVenue": true if venue not in user's preferred venues list
    }
  ]
}`
      }]
    });

    const content = message.content[0].text;
    let jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) {
      jsonMatch = content.match(/\{[\s\S]*\}/);
    }

    const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
    const data = JSON.parse(jsonString);

    res.json(data);
  } catch (error) {
    console.error('Error fetching Brooklyn Rail:', error);
    res.status(500).json({ error: error.message });
  }
});

const MUSEUM_SOURCES = [
  // NYC Museums
  { name: 'MoMA',               url: 'https://www.moma.org/calendar/exhibitions' },
  { name: 'Whitney',            url: 'https://whitney.org/exhibitions' },
  { name: 'Guggenheim',         url: 'https://www.guggenheim.org/exhibitions' },
  { name: 'New Museum',         url: 'https://www.newmuseum.org/exhibitions' },
  { name: 'MoMA PS1',           url: 'https://www.momaps1.org/exhibitions' },
  // Long Island
  { name: 'Parrish Art Museum', url: 'https://www.parrishart.org/exhibitions' },
  { name: 'Guild Hall',         url: 'https://www.guildhall.org/exhibitions' },
  // Upstate / Hudson Valley / Catskills
  { name: 'Dia:Beacon',         url: 'https://www.diaart.org/exhibitions/main' },
  { name: 'Storm King',         url: 'https://stormking.org/exhibitions' },
  { name: 'Upstate Art Weekend', url: 'https://www.upstateartweekend.com' },
  { name: 'MASS MoCA',          url: 'https://massmoca.org/exhibitions' },
  { name: 'Basilica Hudson',    url: 'https://basilicahudson.org' },
  { name: 'The School (Jack Shainman)', url: 'https://theschoolkinderhook.com' },
  { name: 'Bard CCS',           url: 'https://ccs.bard.edu/exhibitions' },
  { name: 'Longhouse Reserve',  url: 'https://longhouse.org/programs' },
  { name: 'Fridman Gallery',    url: 'https://www.fridmangallery.com/exhibitions' },
  // Capital Region / Troy / Albany
  { name: 'Collar Works',       url: 'https://collarworks.org' },
  { name: 'Albany Center Gallery', url: 'https://www.albanycenter.org' },
  { name: 'Arts Center of the Capital Region', url: 'https://artscenteronline.org' },
  // Catskills / Woodstock
  { name: 'Woodstock Artists Association', url: 'https://woodstockart.org' },
  { name: 'Kleinert/James Center', url: 'https://woodstockguild.org/kleinert-james' },
  // Art Fairs
  { name: 'Frieze New York',    url: 'https://www.frieze.com/fairs/frieze-new-york' },
  { name: 'The Armory Show',    url: 'https://www.thearmoryshow.com' },
  { name: 'The Other Art Fair', url: 'https://www.theotherartfair.com/brooklyn' },
  { name: 'NADA New York',      url: 'https://newartdealers.org/fairs' },
  { name: 'The Art Show',       url: 'https://theartshow.org' },
  { name: 'Art on Paper',       url: 'https://www.artonpaperfair.com' },
  // Public Art
  { name: 'Public Art Fund',    url: 'https://www.publicartfund.org/exhibitions' },
  // Press / Listings
  { name: 'Brooklyn Rail',      url: 'https://brooklynrail.org/artseen/' },
];

// Build a lookup map from source name to URL
const sourceUrlMap = Object.fromEntries(MUSEUM_SOURCES.map(s => [s.name, s.url]));

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

app.post('/api/scan-museums', async (req, res) => {
  try {
    // Fetch all pages in parallel with a 10s timeout each
    const fetchResults = await Promise.allSettled(
      MUSEUM_SOURCES.map(async (source) => {
        const response = await fetch(source.url, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        const text = stripHtml(html).slice(0, 1500);
        return { name: source.name, url: source.url, text };
      })
    );

    const successful = fetchResults
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    const failed = fetchResults
      .map((r, i) => r.status === 'rejected' ? MUSEUM_SOURCES[i].name : null)
      .filter(Boolean);

    if (successful.length === 0) {
      throw new Error('All sources failed to load');
    }

    // Split into batches of 6 and call Claude in parallel per batch
    const BATCH_SIZE = 6;
    const batches = [];
    for (let i = 0; i < successful.length; i += BATCH_SIZE) {
      batches.push(successful.slice(i, i + BATCH_SIZE));
    }

    const tasteProfile = `Favorite artists: ${userProfile.artists.join(', ')}
Preferred venues: ${userProfile.venues.join(', ')}
Interests: contemporary sculpture, abstraction, conceptual art, socially engaged practices, installation, materiality`;

    const jsonSchema = `{
  "events": [
    {
      "title": "Exhibition title",
      "artist": "Artist name(s) or null if not listed",
      "venue": "Venue name exactly as it appears in the source header",
      "city": "City name, e.g. New York, Beacon, North Adams, East Hampton",
      "state": "Two-letter state code, e.g. NY, MA",
      "dates": "Date range as found on the page, or null",
      "description": "1-3 sentence summary of the exhibition",
      "isUpcoming": true if the exhibition has not yet opened, false if currently active,
      "tags": ["relevant", "tags"]
    }
  ]
}`;

    const today = new Date().toISOString().split('T')[0];

    const batchResults = await Promise.allSettled(
      batches.map(async (batch) => {
        const combined = batch.map(s => `=== ${s.name} ===\n${s.text}`).join('\n\n');
        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: `Today is ${today}. Extract exhibition listings from the page content below. Only include exhibitions that are currently active or upcoming (not past). Use the venue name exactly as it appears in the === source header ===.\n\nTaste profile for context:\n${tasteProfile}\n\nLISTINGS:\n${combined}\n\nReturn ONLY JSON (no markdown, no backticks):\n${jsonSchema}`
          }]
        });

        const content = message.content[0].text;
        let jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
        if (!jsonMatch) jsonMatch = content.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
        const parsed = JSON.parse(jsonString);

        // Attach source URL to each event based on venue name
        (parsed.events || []).forEach(event => {
          event.sourceUrl = sourceUrlMap[event.venue] || null;
        });

        return parsed;
      })
    );

    const allEvents = batchResults
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value.events || []);

    const data = { events: allEvents };
    if (failed.length > 0) data.failedSources = failed;

    res.json(data);
  } catch (error) {
    console.error('Error scanning museums:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`NYC Art Radar running on http://localhost:${PORT}`);
});
