export interface NewsArticle {
  title: string;
  link: string;
  source: string;
  pubDate?: string;
  description?: string;
}

export async function fetchNews(query: string = "accident road infrastructure", city: string = "Mumbai"): Promise<NewsArticle[]> {
  const apiKey = process.env.NEWSDATA_API_KEY;
  if (!apiKey) {
    console.warn("NewsData API key not found. Returning mock news data.");
    return getMockNews(city);
  }

  try {
    const searchQuery = `${query} ${city}`;
    const url = `https://newsdata.io/api/1/news?apikey=${apiKey}&q=${encodeURIComponent(searchQuery)}&country=in&language=en`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`NewsData API error: ${response.statusText}`);
    }

    const data = await response.json();
    const results = data.results || [];

    return results.map((item: any) => ({
      title: item.title || "Local news update",
      link: item.link || "#",
      source: item.source_id || "Local News",
      pubDate: item.pubDate,
      description: item.description || "No description provided."
    }));
  } catch (error) {
    console.error("Failed to fetch news from NewsData:", error);
    return getMockNews(city);
  }
}

function getMockNews(city: string): NewsArticle[] {
  return [
    {
      title: `Two-Wheeler Accident Reported in ${city} Due to Deep Pothole`,
      link: "https://example.com/news/accident-pothole",
      source: "Times of City",
      pubDate: "2026-06-24 08:30:00",
      description: "A minor collision took place on SV Road after a rider braked suddenly to avoid a deep pothole. Local community members are calling for immediate repair works."
    },
    {
      title: "Broken Streetlight Plunges Junction into Darkness, Safety Concerns Raised",
      link: "https://example.com/news/streetlight-safety",
      source: "Citizen Ledger",
      pubDate: "2026-06-25 19:15:00",
      description: "Residents have voiced alarm over non-functioning streetlights near the main crossroad, making it dangerous for pedestrians after sunset."
    }
  ];
}
