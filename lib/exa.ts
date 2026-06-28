export interface ExaResult {
  title: string;
  url: string;
  publishedDate?: string;
  snippet?: string;
}

export async function searchExa(query: string, numResults: number = 5): Promise<ExaResult[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    console.warn("Exa API key not found. Returning mock search results.");
    return getMockExaResults(query);
  }

  try {
    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query: query,
        useAutoprompt: true,
        numResults: numResults,
        contents: {
          text: {
            maxCharacters: 200
          }
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Exa API error: ${response.statusText}`);
    }

    const data = await response.json();
    const results = data.results || [];

    return results.map((res: any) => ({
      title: res.title || "No Title",
      url: res.url || "#",
      publishedDate: res.publishedDate,
      snippet: res.text ? res.text.substring(0, 180) + "..." : "No description available."
    }));
  } catch (error) {
    console.error("Failed to fetch Exa search results:", error);
    return getMockExaResults(query);
  }
}

function getMockExaResults(query: string): ExaResult[] {
  return [
    {
      title: "Mumbai Roads Cry for Help: Clogged Drains and Potholes Cause Massive Traffic Snarls",
      url: "https://example.com/news/mumbai-roads-traffic",
      publishedDate: "2026-06-20",
      snippet: "Frequent rain showers in Mumbai have exposed the poor state of public infrastructure. Residents report potholes occurring along Link Road and express frustration over slow civic responses."
    },
    {
      title: "Waterlogging report in Andheri East Ward: Residents demand immediate action",
      url: "https://example.com/news/andheri-waterlogging",
      publishedDate: "2026-06-22",
      snippet: "Active civic groups in Andheri have highlighted multiple spots facing severe water accumulation issues after just 2 hours of rainfall, citing blocked stormwater systems."
    }
  ];
}
