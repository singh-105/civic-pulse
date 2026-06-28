import { NextRequest, NextResponse } from "next/server";
import { sendOfficialComplaintEmail } from "@/lib/resend";

export async function POST(req: NextRequest) {
  try {
    const { to, subject, htmlContent } = await req.json();

    if (!to || !subject || !htmlContent) {
      return NextResponse.json({ error: "Missing to, subject, or htmlContent parameters" }, { status: 400 });
    }

    const result = await sendOfficialComplaintEmail(to, subject, htmlContent);

    if (result.success) {
      return NextResponse.json({ success: true, id: result.id });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (error: any) {
    console.error("API send-email error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to send email" },
      { status: 500 }
    );
  }
}
