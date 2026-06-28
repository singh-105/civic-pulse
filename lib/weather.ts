export interface WeatherForecast {
  temp: number;
  description: string;
  humidity: number;
  rainProbability: number;
  windSpeed: number;
  date: string;
}

export async function fetchWeatherForecast(city: string = "Mumbai"): Promise<WeatherForecast[]> {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    console.warn("OpenWeather API key not found. Returning mock weather data.");
    return getMockWeather();
  }

  try {
    // Fetch 5-day weather forecast
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`
    );

    if (!response.ok) {
      throw new Error(`Weather API error: ${response.statusText}`);
    }

    const data = await response.json();
    const list = data.list || [];

    // Filter to one forecast per day (e.g. at 12:00 PM) or just group them
    const dailyForecasts: WeatherForecast[] = list
      .filter((item: any) => item.dt_txt.includes("12:00:00"))
      .map((item: any) => ({
        temp: item.main.temp,
        description: item.weather[0].description,
        humidity: item.main.humidity,
        rainProbability: item.pop ? Math.round(item.pop * 100) : 0, // pop is probability of precipitation (0 to 1)
        windSpeed: item.wind.speed,
        date: item.dt_txt.split(" ")[0]
      }));

    return dailyForecasts.length > 0 ? dailyForecasts : getMockWeather();
  } catch (error) {
    console.error("Failed to fetch weather forecast:", error);
    return getMockWeather();
  }
}

function getMockWeather(): WeatherForecast[] {
  const today = new Date();
  return Array.from({ length: 5 }).map((_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    return {
      temp: 28 + Math.round(Math.random() * 5),
      description: i === 1 || i === 3 ? "heavy rain" : "scattered clouds",
      humidity: 80,
      rainProbability: i === 1 || i === 3 ? 90 : 20,
      windSpeed: 4.2,
      date: date.toISOString().split("T")[0]
    };
  });
}
