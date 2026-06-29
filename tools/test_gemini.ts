const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;

async function listModels() {
  const response = await fetch(GEMINI_API_URL);
  const data = await response.json();
  console.log(data.models.map((m: any) => m.name).join("\n"));
}

listModels();
