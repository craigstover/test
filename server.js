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

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`NYC Art Radar running on http://localhost:${PORT}`);
});
