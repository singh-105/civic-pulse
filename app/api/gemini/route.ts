import { NextRequest, NextResponse } from "next/server";
import { callGemini } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const { prompt, imageBase64, systemInstruction } = await req.json();
    
    const text = await callGemini(prompt, imageBase64, systemInstruction);
    return NextResponse.json({ text });

  } catch (error: any) {
    console.error("Gemini proxy route error:", error?.message || error);
    return NextResponse.json({ text: '{}', isFallback: true });
  }
}
