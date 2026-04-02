/**
 * ollama.js
 *
 * Ollama integration layer: uses a local LLM served by Ollama
 * (https://ollama.ai) to intelligently extract structured data from
 * scraped Instagram page text when CSS/regex parsing is insufficient.
 *
 * Prerequisites:
 *   1. Install Ollama:  https://ollama.ai/download
 *   2. Pull a model:   ollama pull llama3
 *   3. Start server:   ollama serve
 *
 * Env vars (set in .env):
 *   OLLAMA_BASE_URL  — default: http://localhost:11434
 *   OLLAMA_MODEL     — default: llama3
 */

const OLLAMA_BASE = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").trim();
const OLLAMA_MODEL = (process.env.OLLAMA_MODEL || "qwen2.5-coder:7b").trim();

console.log(`[ollama] Config: base=${OLLAMA_BASE}, model=${OLLAMA_MODEL}`);

// ---------------------------------------------------------------------------
// Availability check
// ---------------------------------------------------------------------------

/**
 * Check if Ollama is running and reachable.
 * Returns true/false without throwing.
 */
export async function isOllamaAvailable() {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Profile extraction
// ---------------------------------------------------------------------------

/**
 * Ask Ollama to extract structured Instagram profile data from visible page text.
 *
 * Use this as a fallback when cheerio/regex parsing leaves fields empty.
 *
 * @param {string} pageText  - Stripped (no-HTML) visible text of the profile page.
 * @param {string} username  - The expected Instagram handle (hint for the model).
 * @returns {Promise<{
 *   username?: string,
 *   fullName?: string,
 *   bio?: string,
 *   followersCount?: number | null,
 *   followingCount?: number | null,
 *   externalUrl?: string | null,
 * } | null>} Parsed object or null if Ollama failed / returned bad JSON.
 */
export async function ollamaExtractProfile(pageText, username) {
  const prompt = `
You are a data extraction assistant. Below is text scraped from the Instagram profile page of @${username}.

Extract the following fields and respond ONLY with a JSON object (no markdown, no explanation):
{
  "username": "string (Instagram handle without @)",
  "fullName": "string (display name, may be empty string)",
  "bio": "string (profile bio, max 500 chars, may be empty string)",
  "followersCount": number or null,
  "followingCount": number or null,
  "externalUrl": "string or null"
}

Rules:
- followersCount / followingCount must be integers (e.g. 12300 not "12.3K")
- If a field is unknown, use null or empty string as appropriate
- Respond with valid JSON only

Scraped page text:
${pageText.slice(0, 3500)}
`.trim();

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.1, // low temp → deterministic, structured output
          num_predict: 256,
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      console.warn(`[ollama] generate request failed: HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const raw = (data?.response || "").trim();

    // Extract the first JSON object from the response text
    const jsonMatch = raw.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      console.warn("[ollama] No JSON found in model response.");
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      username: typeof parsed.username === "string" ? parsed.username : undefined,
      fullName: typeof parsed.fullName === "string" ? parsed.fullName : undefined,
      bio: typeof parsed.bio === "string" ? parsed.bio.slice(0, 500) : undefined,
      followersCount: Number.isFinite(parsed.followersCount) ? parsed.followersCount : null,
      followingCount: Number.isFinite(parsed.followingCount) ? parsed.followingCount : null,
      externalUrl: typeof parsed.externalUrl === "string" ? parsed.externalUrl : null,
    };
  } catch (err) {
    console.warn(`[ollama] ollamaExtractProfile error: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Post enrichment (optional)
// ---------------------------------------------------------------------------

/**
 * Ask Ollama to generate a short summary/analysis of a scraped profile.
 * Useful for enriching stored data with AI-generated insight.
 *
 * @param {{ username: string, fullName: string, bio: string }} profile
 * @returns {Promise<string | null>} A 1-2 sentence summary, or null on failure.
 */
export async function ollamaSummarizeProfile(profile) {
  const prompt = `
Summarize this Instagram profile in 1-2 sentences for a social graph app.
Be factual and concise. Respond with plain text only.

Username: @${profile.username}
Display name: ${profile.fullName || "(none)"}
Bio: ${profile.bio || "(none)"}
`.trim();

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.4, num_predict: 128 },
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return (data?.response || "").trim() || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// List extraction
// ---------------------------------------------------------------------------

/**
 * Ask Ollama to extract a list of users (e.g. from a followers modal) from visible text.
 * 
 * @param {string} listText - Stripped visible text containing handles and names.
 * @returns {Promise<Array<{ username: string, fullName: string }>>} Parsed array or empty.
 */
export async function ollamaExtractList(listText) {
  const prompt = `
You are a data extraction assistant. Below is text scraped from an Instagram followers/following list.

Extract all usernames and display names found in this text.
Respond ONLY with a JSON array of objects (no markdown, no explanation).
Format:
[
  { "username": "string (Instagram handle without @)", "fullName": "string (display name, may be empty string)" }
]

Rules:
- Respond with a valid JSON array only
- Igore text that is not a username or display name (like "Follow", "Requested", "Remove")

Scraped list text:
${listText.slice(0, 4000)}
`.trim();

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 1024, // Array can be long
        },
      }),
      signal: AbortSignal.timeout(45000), // Longer timeout for list generation
    });

    if (!res.ok) {
      console.warn(`[ollama] list generate failed: HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const raw = (data?.response || "").trim();

    // Extract JSON array
    const jsonMatch = raw.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      console.warn("[ollama] No JSON array found in list response. Raw:", raw.slice(0, 50));
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];
    
    return parsed
      .filter((u) => u && typeof u.username === "string" && u.username.trim() !== "")
      .map((u) => ({
        username: u.username.trim(),
        fullName: typeof u.fullName === "string" ? u.fullName.trim() : "",
      }));
  } catch (err) {
    console.warn(`[ollama] ollamaExtractList error: ${err.message}`);
    return [];
  }
}
