import { NextRequest, NextResponse } from "next/server";
import { analyzeImage } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();
    if (!image) {
      return NextResponse.json({ error: "Missing image base64 data" }, { status: 400 });
    }

    const analysisResult = await analyzeImage(image);
    return NextResponse.json(analysisResult);
  } catch (error: any) {
    console.error("API Analyze Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to analyze image" },
      { status: 500 }
    );
  }
}
