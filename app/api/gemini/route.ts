import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  try {
    const { prompt, imageBase64, systemInstruction } = await req.json();
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
    
    if (!apiKey) {
      console.error("Gemini API key environment variable is not defined");
      return NextResponse.json({ text: '{}', isFallback: true });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: systemInstruction 
    });

    let response;
    if (imageBase64) {
      const rawData = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
      const mimeMatch = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

      response = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: rawData,
            mimeType: mimeType
          }
        }
      ]);
    } else {
      response = await model.generateContent(prompt);
    }

    const responseText = response.response.text() || '';
    return NextResponse.json({ text: responseText });

  } catch (error: any) {
    console.error("Gemini proxy route error:", error?.message || error);
    return NextResponse.json({ text: '{}', isFallback: true });
  }
}
