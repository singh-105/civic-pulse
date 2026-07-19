import { NextRequest, NextResponse } from "next/server";
import { groqText, groqVision } from "@/lib/groq";

export async function POST(req: NextRequest) {
  try {
    const { prompt, imageBase64, systemInstruction } = await req.json();
    
    let text;
    if (imageBase64) {
      const fullPrompt = systemInstruction ? `${systemInstruction}\n\nTask:\n${prompt}` : prompt;
      text = await groqVision(fullPrompt, imageBase64);
    } else {
      const fullPrompt = systemInstruction ? `${systemInstruction}\n\nTask:\n${prompt}` : prompt;
      text = await groqText(fullPrompt);
    }
    return NextResponse.json({ text });

  } catch (error: any) {
    console.error("Groq proxy route error:", error?.message || error);
    return NextResponse.json({ text: '{}', isFallback: true });
  }
}
