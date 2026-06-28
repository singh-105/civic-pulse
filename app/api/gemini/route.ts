import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

export async function POST(req: NextRequest) {
  try {
    const { prompt, imageBase64, systemInstruction } = await req.json();
    
    if (!process.env.GROQ_API_KEY) {
      console.error("GROQ_API_KEY server environment variable is not defined");
      return NextResponse.json({ text: '{}', isFallback: true });
    }

    const messages: any[] = [];
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }

    if (imageBase64) {
      const rawData = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
      const mimeMatch = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${rawData}`
            }
          }
        ]
      });
    } else {
      messages.push({ role: 'user', content: prompt });
    }

    const model = imageBase64 
      ? 'meta-llama/llama-4-scout-17b-16e-instruct'
      : 'llama-3.3-70b-versatile';

    const response = await groq.chat.completions.create({
      model,
      messages,
      max_tokens: 1000
    });

    const responseText = response.choices[0].message?.content || '';
    return NextResponse.json({ text: responseText });

  } catch (error: any) {
    console.error("Groq proxy route error:", error?.message || error);
    return NextResponse.json({ text: '{}', isFallback: true });
  }
}
