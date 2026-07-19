const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_VISION_URL = 'https://api.groq.com/openai/v1/chat/completions';
const TEXT_MODEL = 'llama-3.3-70b-versatile';
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

const getKey = () => process.env.NEXT_PUBLIC_GROQ_API_KEY || '';

// TEXT: for letters, predictions, insights, summaries
export const groqText = async (prompt: string): Promise<string> => {
  try {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getKey()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1024
      })
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Groq text error:', err);
      throw new Error(`Groq failed: ${res.status}`);
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content || '';
  } catch (err) {
    console.error('groqText failed:', err);
    return '';
  }
};

// VISION: for image analysis
export const groqVision = async (prompt: string, imageBase64: string): Promise<string> => {
  try {
    const base64Data = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;

    const res = await fetch(GROQ_VISION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getKey()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: VISION_MODEL,
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
      console.error('Groq vision error:', err);
      throw new Error(`Groq vision failed: ${res.status}`);
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content || '';
  } catch (err) {
    console.error('groqVision failed:', err);
    return '';
  }
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
