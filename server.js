const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware — handle both JSON and Mailgun's urlencoded POST
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
  { name: 'The Met',            url: 'https://www.metmuseum.org/exhibitions' },
  { name: 'MoMA',               url: 'https://www.moma.org/calendar/exhibitions' },
  { name: 'Whitney',            url: 'https://whitney.org/exhibitions' },
  { name: 'Guggenheim',         url: 'https://www.guggenheim.org/exhibitions' },
  { name: 'Brooklyn Museum',    url: 'https://www.brooklynmuseum.org/exhibitions' },
  { name: 'Cooper Hewitt',      url: 'https://www.cooperhewitt.org/exhibitions/' },
  { name: 'Studio Museum in Harlem', url: 'https://studiomuseum.org/exhibitions' },
  { name: 'Dia Art Foundation',  url: 'https://www.diaart.org/exhibition/exhibitions-projects' },
  { name: 'New Museum',         url: 'https://www.newmuseum.org/exhibitions' },
  { name: 'MoMA PS1',           url: 'https://www.momaps1.org/en/programs' },
  { name: 'The Frick',          url: 'https://www.frick.org/exhibitions' },
  { name: 'The Drawing Center', url: 'https://www.drawingcenter.org/exhibitions' },
  { name: 'ICP',                url: 'https://www.icp.org/exhibitions' },
  { name: 'El Museo del Barrio', url: 'https://www.elmuseo.org/exhibitions' },
  { name: 'Bronx Museum',       url: 'https://www.bronxmuseum.org/exhibitions' },
  { name: 'Queens Museum',      url: 'https://queensmuseum.org/exhibitions' },
  { name: 'Noguchi Museum',     url: 'https://www.noguchi.org/programs/exhibitions' },
  { name: 'SculptureCenter',    url: 'https://www.sculpture-center.org/program' },
  // Long Island
  { name: 'Parrish Art Museum', url: 'https://www.parrishart.org/exhibitions' },
  { name: 'Guild Hall',         url: 'https://www.guildhall.org/exhibitions' },
  // Upstate / Hudson Valley / Catskills
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
  // Downtown NYC — LES, East Village, Tribeca, Soho
  { name: 'Karma',                  url: 'https://karmakarma.org/exhibitions' },
  { name: 'Reena Spaulings',        url: 'https://www.reenaspaulings.com' },
  { name: 'Canada Gallery',         url: 'https://canadanewyork.com' },
  { name: 'Rachel Uffner Gallery',  url: 'https://www.racheluffnergallery.com' },
  { name: 'Foxy Production',        url: 'https://www.foxyproduction.com' },
  { name: 'Miguel Abreu Gallery',   url: 'https://miguelabreugallery.com' },
  { name: 'Bortolami',              url: 'https://bortolamigallery.com' },
  { name: 'Sperone Westwater',      url: 'https://www.speronewestwater.com/exhibitions' },
  { name: 'James Cohan',            url: 'https://www.jamescohan.com/exhibitions' },
  { name: 'The Hole',               url: 'https://theholenyc.com' },
  { name: 'Shoot the Lobster',      url: 'https://www.shootthelobster.com' },
  { name: 'Company Gallery',        url: 'https://www.company.gallery' },
  { name: 'Thierry Goldberg',       url: 'https://thierrygoldberg.com/exhibitions' },
  { name: 'Anton Kern Gallery',     url: 'https://antonkerngallery.com/exhibitions' },
  { name: 'Yours Mine & Ours',      url: 'https://yoursminenyc.com' },
  // Chelsea — Blue Chip
  { name: 'Gagosian',               url: 'https://gagosian.com/exhibitions' },
  { name: 'Pace Gallery',           url: 'https://www.pacegallery.com/exhibitions' },
  { name: 'David Zwirner',          url: 'https://www.davidzwirner.com/exhibitions' },
  { name: 'Hauser & Wirth',         url: 'https://www.hauserwirth.com/exhibitions' },
  { name: 'Matthew Marks',          url: 'https://matthewmarks.com/exhibitions' },
  { name: 'Marian Goodman',         url: 'https://www.mariangoodman.com/exhibitions' },
  { name: 'Paula Cooper',           url: 'https://www.paulacoopergallery.com/exhibitions' },
  { name: 'Gladstone Gallery',      url: 'https://www.gladstonegallery.com/exhibitions' },
  { name: 'Greene Naftali',         url: 'https://www.greenenaftaligallery.com/exhibitions' },
  { name: 'Luhring Augustine',      url: 'https://www.luhringaugustine.com/exhibitions' },
  { name: 'Sean Kelly',             url: 'https://www.skny.com/exhibitions' },
  { name: 'Jack Shainman Gallery',  url: 'https://jackshainman.com/exhibitions' },
  { name: 'Tanya Bonakdar',         url: 'https://www.tanyabonakdargallery.com/exhibitions' },
  { name: 'Lehmann Maupin',         url: 'https://www.lehmannmaupin.com/exhibitions' },
  { name: '303 Gallery',            url: 'https://www.303gallery.com/exhibitions' },
  { name: 'Andrew Kreps',           url: 'https://www.andrewkreps.com/exhibitions' },
  { name: 'Petzel Gallery',         url: 'https://petzel.com/exhibitions' },
  { name: 'Casey Kaplan',           url: 'https://caseykaplangallery.com/exhibitions' },
  { name: 'Team Gallery',           url: 'https://teamgal.com/exhibitions' },
  // Midtown
  { name: 'Marlborough Gallery',    url: 'https://www.marlboroughgallery.com/exhibitions' },
  { name: 'Acquavella Galleries',   url: 'https://www.acquavellagalleries.com/exhibitions' },
  { name: 'Mnuchin Gallery',        url: 'https://mnuchingallery.com/exhibitions' },
  // Art Fairs
  { name: 'Frieze New York',      url: 'https://www.frieze.com/fairs/frieze-new-york' },
  { name: 'The Armory Show',      url: 'https://www.thearmoryshow.com' },
  { name: 'The Other Art Fair',   url: 'https://www.theotherartfair.com/brooklyn' },
  { name: 'NADA New York',        url: 'https://newartdealers.org/fairs' },
  { name: 'The Art Show',         url: 'https://theartshow.org' },
  { name: 'Art on Paper',         url: 'https://www.artonpaperfair.com' },
  { name: 'Independent New York', url: 'https://independentnewyork.com' },
  { name: 'TEFAF New York',       url: 'https://www.tefaf.com/fairs/tefaf-new-york' },
  { name: 'Spring/Break Art Show', url: 'https://www.springbreakartshow.com' },
  { name: 'Untitled Art Fair',    url: 'https://untitledartfair.com' },
  { name: 'Paris Photo New York', url: 'https://www.parisphoto.com/en-us/fairs/new-york' },
  { name: 'Satellite Art Show',   url: 'https://www.satelliteartshow.com' },
  // Public Art
  { name: 'Public Art Fund',    url: 'https://www.publicartfund.org/exhibitions' },
  // Press / Listings
  { name: 'Brooklyn Rail',      url: 'https://brooklynrail.org/artseen' },
  { name: 'Artforum',           url: 'https://www.artforum.com/news' },
  { name: 'Hyperallergic',      url: 'https://hyperallergic.com/reviews/' },
  { name: 'Time Out New York',  url: 'https://www.timeout.com/newyork/art' },
  { name: 'New York Magazine',  url: 'https://nymag.com/arts/' },
];

// Build a lookup map from source name to URL
const sourceUrlMap = Object.fromEntries(MUSEUM_SOURCES.map(s => [s.name, s.url]));

function extractOgImage(html) {
  const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return match ? match[1] : null;
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Preserve img src as inline markers before stripping all tags
    .replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, ' [img:$1] ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

app.post('/api/scan-museums', async (req, res) => {
  try {
    // Fetch all pages in parallel with a 10s timeout each
    const fetchResults = await Promise.allSettled(
      MUSEUM_SOURCES.map(async (source) => {
        const response = await fetch(source.url, {
          signal: AbortSignal.timeout(10000),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
          }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        const text = stripHtml(html).slice(0, 2500);
        const image = extractOgImage(html);
        return { name: source.name, url: source.url, text, image };
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
      "startDate": "Start date in YYYY-MM-DD format, or null if unknown",
      "description": "1-3 sentence summary of the exhibition",
      "type": "one of: art fair, gallery show, museum show, public art, performance, residency",
      "imageUrl": "URL from the nearest [img:URL] marker in the listing, or null if none found",
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
            content: `Today is ${today}. Extract exhibition listings from the page content below. Only include exhibitions that are currently active or upcoming (not past). Use the venue name exactly as it appears in the === source header ===.

Only include events located in New York City (Manhattan, Brooklyn, Queens, Bronx, Staten Island), Long Island, upstate New York, or other nearby East Coast locations (Connecticut, Massachusetts, New Jersey, Pennsylvania). Exclude any events outside this region.

Taste profile for context:\n${tasteProfile}\n\nLISTINGS:\n${combined}\n\nReturn ONLY JSON (no markdown, no backticks):\n${jsonSchema}`
          }]
        });

        const content = message.content[0].text;
        let jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
        if (!jsonMatch) jsonMatch = content.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
        const parsed = JSON.parse(jsonString);

        // Build a map of source name -> og:image fallback for this batch
        const batchImageMap = Object.fromEntries(batch.map(s => [s.name, s.image]));

        // Attach source URL; use Claude's per-exhibition imageUrl, fall back to og:image
        (parsed.events || []).forEach(event => {
          event.sourceUrl = sourceUrlMap[event.venue] || null;
          event.imageUrl = event.imageUrl || batchImageMap[event.venue] || null;
        });

        return parsed;
      })
    );

    const allEvents = batchResults
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value.events || []);

    // Sort by startDate ascending; events without a date go to the end
    allEvents.sort((a, b) => {
      if (!a.startDate && !b.startDate) return 0;
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return a.startDate.localeCompare(b.startDate);
    });

    const data = { events: allEvents };
    if (failed.length > 0) data.failedSources = failed;

    res.json(data);
  } catch (error) {
    console.error('Error scanning museums:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/arena-discovery', async (req, res) => {
  try {
    const ARENA_API = 'https://api.are.na/v2';

    // Search Are.na for channels related to a sample of the user's artists
    // Use a subset to avoid rate limits
    const searchArtists = userProfile.artists.slice(0, 4);

    const channelSearches = await Promise.allSettled(
      searchArtists.map(async (artist) => {
        const url = `${ARENA_API}/search/channels?q=${encodeURIComponent(artist)}&per=4`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error(`Arena search failed: ${res.status}`);
        const data = await res.json();
        return (data.channels || []).map(c => ({ slug: c.slug, title: c.title }));
      })
    );

    // Collect unique channel slugs
    const seen = new Set();
    const channels = channelSearches
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value)
      .filter(c => c.slug && !seen.has(c.slug) && seen.add(c.slug))
      .slice(0, 8); // cap at 8 channels to stay within rate limits

    if (channels.length === 0) {
      return res.json({ artists: [] });
    }

    // Fetch contents of each channel (stagger slightly to respect rate limits)
    const contentResults = [];
    for (const channel of channels) {
      await new Promise(r => setTimeout(r, 200));
      try {
        const url = `${ARENA_API}/channels/${channel.slug}/contents?per=40`;
        const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!r.ok) continue;
        const data = await r.json();
        contentResults.push({ channel: channel.title, blocks: data.contents || [] });
      } catch {}
    }

    // Build a condensed text representation for Claude
    const summary = contentResults.map(({ channel, blocks }) => {
      const items = blocks
        .filter(b => b.title || b.description)
        .slice(0, 20)
        .map(b => {
          const img = b.image?.thumb?.url || null;
          return `- ${b.title || ''}${b.description ? ': ' + b.description.slice(0, 120) : ''}${img ? ` [img:${img}]` : ''}`;
        })
        .join('\n');
      return `=== Channel: ${channel} ===\n${items}`;
    }).join('\n\n');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `The user follows these artists: ${userProfile.artists.join(', ')}.

Below are contents from Are.na channels curated by people who also collect and follow these artists. Identify 10-15 artists mentioned or implied in the channel contents that the user likely doesn't know yet but would enjoy — focus on contemporary, emerging, and mid-career artists working in sculpture, installation, abstraction, conceptual, or socially engaged practices.

Do NOT include artists already in the user's list.

ARENA CHANNEL CONTENTS:
${summary}

Return ONLY JSON (no markdown, no backticks):
{
  "artists": [
    {
      "name": "Artist name",
      "connection": "1-2 sentences on why they'd appeal to this user and what they make",
      "imageUrl": "URL from [img:URL] if one appeared near this artist's name, otherwise null"
    }
  ]
}`
      }]
    });

    const content = message.content[0].text;
    let jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
    const data = JSON.parse(jsonString);

    res.json(data);
  } catch (error) {
    console.error('Error with Are.na discovery:', error);
    res.status(500).json({ error: error.message });
  }
});

// In-memory store for newsletter events (persists until server restarts)
let newsletterEvents = [];

// Cached scan results
let cachedEvents = [];
let lastScanTime = null;
let sourceStatuses = []; // { name, url, status: 'ok'|'failed', error? }

async function runDailyScan() {
  console.log('Running scheduled scan...');
  try {
    const fetchResults = await Promise.allSettled(
      MUSEUM_SOURCES.map(async (source) => {
        const response = await fetch(source.url, {
          signal: AbortSignal.timeout(10000),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
          }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        const text = stripHtml(html).slice(0, 2500);
        const image = extractOgImage(html);
        return { name: source.name, url: source.url, text, image };
      })
    );

    const successful = fetchResults
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    sourceStatuses = fetchResults.map((r, i) => ({
      name: MUSEUM_SOURCES[i].name,
      url: MUSEUM_SOURCES[i].url,
      status: r.status === 'fulfilled' ? 'ok' : 'failed',
      error: r.status === 'rejected' ? r.reason?.message : undefined,
    }));

    if (successful.length === 0) throw new Error('All sources failed');

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
      "startDate": "Start date in YYYY-MM-DD format, or null if unknown",
      "description": "1-3 sentence summary of the exhibition",
      "type": "one of: art fair, gallery show, museum show, public art, performance, residency",
      "imageUrl": "URL from the nearest [img:URL] marker in the listing, or null if none found",
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
            content: `Today is ${today}. Extract exhibition listings from the page content below. Only include exhibitions that are currently active or upcoming (not past). Use the venue name exactly as it appears in the === source header ===.

Only include events located in New York City (Manhattan, Brooklyn, Queens, Bronx, Staten Island), Long Island, upstate New York, or other nearby East Coast locations (Connecticut, Massachusetts, New Jersey, Pennsylvania). Exclude any events outside this region.

Taste profile for context:\n${tasteProfile}\n\nLISTINGS:\n${combined}\n\nReturn ONLY JSON (no markdown, no backticks):\n${jsonSchema}`
          }]
        });

        const content = message.content[0].text;
        let jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
        if (!jsonMatch) jsonMatch = content.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
        const parsed = JSON.parse(jsonString);

        const batchImageMap = Object.fromEntries(batch.map(s => [s.name, s.image]));
        (parsed.events || []).forEach(event => {
          event.sourceUrl = sourceUrlMap[event.venue] || null;
          event.imageUrl = event.imageUrl || batchImageMap[event.venue] || null;
        });

        return parsed;
      })
    );

    const allEvents = batchResults
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value.events || []);

    allEvents.sort((a, b) => {
      if (!a.startDate && !b.startDate) return 0;
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return a.startDate.localeCompare(b.startDate);
    });

    cachedEvents = allEvents;
    lastScanTime = new Date().toISOString();
    console.log(`Scan complete: ${allEvents.length} events cached at ${lastScanTime}`);
  } catch (err) {
    console.error('Scheduled scan failed:', err);
  }
}

// Run on startup, then every 24 hours
runDailyScan();
setInterval(runDailyScan, 24 * 60 * 60 * 1000);

// Mailgun posts form-encoded data when an email arrives
app.post('/api/ingest-email', async (req, res) => {
  // Acknowledge immediately so Mailgun doesn't retry
  res.sendStatus(200);

  try {
    const subject = req.body.subject || '';
    const sender  = req.body.sender || req.body.from || '';
    const html    = req.body['body-html'] || req.body['stripped-html'] || '';
    const text    = req.body['body-plain'] || req.body['stripped-text'] || '';

    // Prefer plain text, fall back to stripped HTML
    const body = text || stripHtml(html);
    if (!body || body.length < 50) return;

    const today = new Date().toISOString().split('T')[0];

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Today is ${today}. The following is an art newsletter email. Extract any art exhibitions, events, or openings mentioned that are located in New York City, Long Island, upstate New York, or nearby East Coast areas (CT, MA, NJ, PA). Only include current or upcoming events, not past ones.

From: ${sender}
Subject: ${subject}

EMAIL BODY:
${body.slice(0, 6000)}

Return ONLY JSON (no markdown, no backticks):
{
  "events": [
    {
      "title": "Exhibition or event title",
      "artist": "Artist name(s) or null",
      "venue": "Gallery or venue name",
      "city": "City",
      "state": "Two-letter state code",
      "dates": "Date range as written, or null",
      "startDate": "YYYY-MM-DD or null",
      "description": "1-3 sentence summary",
      "type": "one of: art fair, gallery show, museum show, public art, performance, residency",
      "isUpcoming": true if not yet opened,
      "sourceUrl": null,
      "imageUrl": null,
      "source": "newsletter"
    }
  ]
}`
      }]
    });

    const content = message.content[0].text;
    let jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
    const data = JSON.parse(jsonString);
    const incoming = (data.events || []).filter(e => e.title);

    // Merge, avoiding duplicates by title+venue
    const existing = new Set(newsletterEvents.map(e => `${e.title}|${e.venue}`));
    const fresh = incoming.filter(e => !existing.has(`${e.title}|${e.venue}`));
    newsletterEvents = [...newsletterEvents, ...fresh];

    console.log(`Ingested ${fresh.length} new events from: ${sender}`);
  } catch (err) {
    console.error('Error ingesting email:', err);
  }
});

// Return stored newsletter events
app.get('/api/newsletter-events', (req, res) => {
  res.json({ events: newsletterEvents });
});

// Return cached scan results + newsletter events merged
app.get('/api/events', (req, res) => {
  res.json({ events: cachedEvents, lastScanTime, newsletterEvents });
});

// Force a fresh scan
app.post('/api/refresh', async (req, res) => {
  res.json({ message: 'Scan started' });
  runDailyScan();
});

// Source status from last scan
app.get('/api/source-status', (req, res) => {
  res.json({ lastScanTime, sources: sourceStatuses });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Sightline running on http://localhost:${PORT}`);
});
