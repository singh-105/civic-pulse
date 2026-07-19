const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const TEXT_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'llama3-8b-8192',
  'mixtral-8x7b-32768'
];

const getKey = () => process.env.NEXT_PUBLIC_GROQ_API_KEY || '';

// TEXT: for letters, predictions, insights, summaries
export const groqText = async (prompt: string): Promise<string> => {
  let lastError: any = null;

  for (const model of TEXT_MODELS) {
    try {
      console.log(`Attempting Groq text completion with model: ${model}`);
      const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getKey()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 1024
        })
      });

      if (!res.ok) {
        const err = await res.text();
        console.warn(`Groq model ${model} failed:`, err);
        lastError = new Error(`Groq failed: ${res.status}`);
        continue;
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content || '';
      if (content) {
        return content;
      }
    } catch (err) {
      console.warn(`groqText failed for model ${model}:`, err);
      lastError = err;
    }
  }

  console.warn('All Groq text models exhausted. Last error:', lastError);
  return '';
};

// VISION: for image analysis (Bypassed as vision models are currently decommissioned on Groq)
export const groqVision = async (prompt: string, imageBase64: string): Promise<string> => {
  console.warn("Groq Vision models are currently decommissioned on the public API. Redirecting to text-based JSON completion.");
  return '';
};

// JSON helper — always returns parsed object or fallback
export const groqJSON = async (prompt: string, fallback: any = {}): Promise<any> => {
  try {
    const text = await groqText(prompt + '\n\nReturn ONLY valid JSON. No markdown. No backticks. No explanation.');
    if (!text) return fallback;
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn('groqJSON parse failed, returning fallback:', err);
    return fallback;
  }
};
