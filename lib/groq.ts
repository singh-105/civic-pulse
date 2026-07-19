const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_VISION_URL = 'https://api.groq.com/openai/v1/chat/completions';

const TEXT_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'llama3-8b-8192',
  'mixtral-8x7b-32768'
];

const VISION_MODELS = [
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'llama-3.2-11b-vision-preview'
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
      console.error(`groqText failed for model ${model}:`, err);
      lastError = err;
    }
  }

  console.error('All Groq text models exhausted. Last error:', lastError);
  return '';
};

// VISION: for image analysis
export const groqVision = async (prompt: string, imageBase64: string): Promise<string> => {
  const base64Data = imageBase64.includes(',')
    ? imageBase64.split(',')[1]
    : imageBase64;

  let lastError: any = null;

  for (const model of VISION_MODELS) {
    try {
      console.log(`Attempting Groq vision analysis with model: ${model}`);
      const res = await fetch(GROQ_VISION_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getKey()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Data}`
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }],
          temperature: 0.3,
          max_tokens: 1024
        })
      });

      if (!res.ok) {
        const err = await res.text();
        console.warn(`Groq vision model ${model} failed:`, err);
        lastError = new Error(`Groq vision failed: ${res.status}`);
        continue;
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content || '';
      if (content) {
        return content;
      }
    } catch (err) {
      console.error(`groqVision failed for model ${model}:`, err);
      lastError = err;
    }
  }

  console.error('All Groq vision models exhausted. Last error:', lastError);
  return '';
};

// JSON helper — always returns parsed object or fallback
export const groqJSON = async (prompt: string, fallback: any = {}): Promise<any> => {
  try {
    const text = await groqText(prompt + '\n\nReturn ONLY valid JSON. No markdown. No backticks. No explanation.');
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('groqJSON parse failed:', err);
    return fallback;
  }
};
