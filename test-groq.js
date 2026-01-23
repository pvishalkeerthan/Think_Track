// Simple script to test Groq API key
// Load environment variables from .env file manually
const fs = require('fs');
const path = require('path');

// Read .env file and set process.env
try {
  const envPath = path.join(__dirname, '.env');
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
} catch (e) {
  console.warn('⚠️  Could not read .env file, using process.env directly');
}

const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function testGroqAPI() {
  console.log('🧪 Testing Groq API Key...\n');
  
  if (!process.env.GROQ_API_KEY) {
    console.error('❌ GROQ_API_KEY not found in .env file');
    process.exit(1);
  }

  console.log(`📝 API Key: ${process.env.GROQ_API_KEY.substring(0, 10)}...${process.env.GROQ_API_KEY.substring(process.env.GROQ_API_KEY.length - 5)}\n`);

  const models = [
    "llama-3.1-70b-instruct",  // Updated from decommissioned versatile
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768",
  ];

  for (const model of models) {
    try {
      console.log(`🔄 Testing model: ${model}...`);
      
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content: "Say 'Hello, Groq API is working!' in one sentence.",
          },
        ],
        model: model,
        max_tokens: 50,
      });

      const response = completion.choices[0]?.message?.content;
      
      if (response) {
        console.log(`✅ SUCCESS with ${model}!`);
        console.log(`📤 Response: ${response}\n`);
        console.log('🎉 Your Groq API key is working correctly!\n');
        return true;
      }
    } catch (error) {
      console.log(`❌ FAILED with ${model}:`);
      console.log(`   Error: ${error.message}\n`);
      
      // If it's an authentication error, stop trying other models
      if (error.status === 401 || error.message.includes('authentication') || error.message.includes('Invalid API key')) {
        console.error('🔒 Authentication failed. Please check your GROQ_API_KEY in .env file.');
        return false;
      }
    }
  }

  console.error('❌ All models failed. Please check your API key and network connection.');
  return false;
}

testGroqAPI()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
