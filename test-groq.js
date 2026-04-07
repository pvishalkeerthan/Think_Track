const fs = require('fs');
const path = require('path');
const Groq = require('groq-sdk');

// --- Load .env safely ---
try {
  const envPath = path.join(__dirname, '.env');
  const envFile = fs.readFileSync(envPath, 'utf8');

  envFile.split('\n').forEach(line => {
    if (!line || line.startsWith('#')) return;

    const idx = line.indexOf('=');
    if (idx === -1) return;

    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();

    // remove quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  });
} catch {
  console.warn('⚠️ Could not read .env file');
}

// --- Init ---
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// --- Models ---
const models = [
  "llama-3.3-70b-versatile",
  "qwen/qwen3-32b",
  "openai/gpt-oss-20b",
  "llama-3.1-8b-instant"
];

// --- Utils ---
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// --- Main test ---
async function testGroqAPI() {
  console.log('🧪 Testing Groq API\n');

  if (!process.env.GROQ_API_KEY) {
    console.error('❌ Missing GROQ_API_KEY');
    return false;
  }

  for (const model of models) {
    try {
      console.log(`🔄 ${model}`);

      const completion = await groq.chat.completions.create({
        model,
        messages: [
          {
            role: "user",
            content: "Reply with exactly: Groq working",
          },
        ],
        max_tokens: 20,
        temperature: 0
      });

      const response = completion.choices?.[0]?.message?.content;

      if (response) {
        console.log(`✅ SUCCESS: ${model}`);
        console.log(response);
        return true;
      }

    } catch (error) {
      const status = error?.status;
      const msg = error?.message || '';

      console.log(`❌ ${model} failed`);
      console.log(`   status: ${status}`);
      console.log(`   msg: ${msg}`);

      // Auth failure → stop immediately
      if (status === 401) {
        console.error('🔒 Invalid API key');
        return false;
      }

      // Rate limit → wait + retry once
      if (status === 429 || msg.includes('rate_limit')) {
        console.log('⏳ Rate limited, retrying...');
        await sleep(1500);
        continue;
      }
    }
  }

  console.error('❌ All models failed');
  return false;
}

// --- Run ---
testGroqAPI().then(success => {
  process.exit(success ? 0 : 1);
});