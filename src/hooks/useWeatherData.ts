import { useState, useEffect } from 'react';

interface WeatherData {
  temperature: number;
  location: string;
  description: string;
}

// Open-Meteo API (free, no key required)
export const useWeatherData = () => {
  const [globalTemp, setGlobalTemp] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // Get current weather for a representative global location (multiple cities)
        const cities = [
          { name: 'New York', lat: 40.71, lon: -74.01 },
          { name: 'London', lat: 51.51, lon: -0.13 },
          { name: 'Tokyo', lat: 35.68, lon: 139.69 },
        ];
        
        const randomCity = cities[Math.floor(Math.random() * cities.length)];
        
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${randomCity.lat}&longitude=${randomCity.lon}&current=temperature_2m,weather_code&timezone=auto`
        );
        
        if (response.ok) {
          const data = await response.json();
          const temp = data.current?.temperature_2m;
          const weatherCode = data.current?.weather_code;
          
          const weatherDescriptions: Record<number, string> = {
            0: 'Clear',
            1: 'Mainly Clear',
            2: 'Partly Cloudy',
            3: 'Overcast',
            45: 'Foggy',
            48: 'Depositing Rime Fog',
            51: 'Light Drizzle',
            53: 'Drizzle',
            55: 'Dense Drizzle',
            61: 'Slight Rain',
            63: 'Moderate Rain',
            65: 'Heavy Rain',
            71: 'Slight Snow',
            73: 'Moderate Snow',
            75: 'Heavy Snow',
            77: 'Snow Grains',
            80: 'Slight Showers',
            81: 'Moderate Showers',
            82: 'Violent Showers',
            85: 'Slight Snow Showers',
            86: 'Heavy Snow Showers',
            95: 'Thunderstorm',
            96: 'Thunderstorm + Hail',
            99: 'Severe Thunderstorm',
          };
          
          setGlobalTemp({
            temperature: temp,
            location: randomCity.name,
            description: weatherDescriptions[weatherCode] || 'Unknown',
          });
        }
      } catch (error) {
        console.error('Weather API error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    // Refresh every 30 minutes
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return { globalTemp, loading };
};

export default useWeatherData;
