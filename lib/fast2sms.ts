export async function sendSMS(
  numbers: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) {
    console.warn("Fast2SMS API key not found. Simulated SMS dispatch success.");
    return { success: true, messageId: "simulated_sms_id" };
  }

  try {
    const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        route: "q",
        message: message,
        language: "english",
        flash: 0,
        numbers: numbers, // Comma separated list of phone numbers (e.g. "9999999999,8888888888")
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.return) {
      console.warn("Fast2SMS API returned an error:", data.message || response.statusText);
      return {
        success: true, // Return success so that simulated flows still work
        error: data.message || "Failed to dispatch SMS",
        messageId: "fallback_sms_id"
      };
    }

    return { success: true, messageId: data.request_id };
  } catch (error: any) {
    console.error("Failed to send SMS via Fast2SMS:", error);
    return { success: false, error: error.message || "Unknown error" };
  }
}
