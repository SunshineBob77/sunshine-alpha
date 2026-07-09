"use client";

import { useEffect, useState } from "react";

const WAKEFIELD_LAT = 42.5042;
const WAKEFIELD_LON = -71.0728;
const REFRESH_MS = 10 * 60 * 1000;

type WeatherData = {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  code: number;
  today: {
    code: number;
    high: number;
    low: number;
  };
  tomorrow: {
    code: number;
    high: number;
    low: number;
  };
};

const weatherByCode: Record<number, { label: string; icon: string }> = {
  0: { label: "Clear sky", icon: "☀️" },
  1: { label: "Mostly clear", icon: "🌤️" },
  2: { label: "Partly cloudy", icon: "⛅" },
  3: { label: "Overcast", icon: "☁️" },
  45: { label: "Foggy", icon: "🌫️" },
  48: { label: "Freezing fog", icon: "🌫️" },
  51: { label: "Light drizzle", icon: "🌦️" },
  53: { label: "Drizzle", icon: "🌦️" },
  55: { label: "Heavy drizzle", icon: "🌧️" },
  56: { label: "Freezing drizzle", icon: "🌧️" },
  57: { label: "Freezing drizzle", icon: "🌧️" },
  61: { label: "Light rain", icon: "🌧️" },
  63: { label: "Rain", icon: "🌧️" },
  65: { label: "Heavy rain", icon: "🌧️" },
  66: { label: "Freezing rain", icon: "🌨️" },
  67: { label: "Freezing rain", icon: "🌨️" },
  71: { label: "Light snow", icon: "🌨️" },
  73: { label: "Snow", icon: "❄️" },
  75: { label: "Heavy snow", icon: "❄️" },
  77: { label: "Snow grains", icon: "🌨️" },
  80: { label: "Rain showers", icon: "🌦️" },
  81: { label: "Rain showers", icon: "🌦️" },
  82: { label: "Violent showers", icon: "⛈️" },
  85: { label: "Snow showers", icon: "🌨️" },
  86: { label: "Snow showers", icon: "🌨️" },
  95: { label: "Thunderstorm", icon: "⛈️" },
  96: { label: "Thunderstorm, hail", icon: "⛈️" },
  99: { label: "Thunderstorm, hail", icon: "⛈️" },
};

function describeWeather(code: number) {
  return weatherByCode[code] ?? { label: "Unknown", icon: "🌡️" };
}

export default function WeatherWidget({
  variant = "full",
}: {
  variant?: "full" | "forecast";
}) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchWeather() {
      try {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${WAKEFIELD_LAT}&longitude=${WAKEFIELD_LON}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FNew_York&forecast_days=2`
        );

        if (!response.ok) throw new Error("Weather request failed");

        const data = await response.json();
        if (cancelled) return;

        setWeather({
          temperature: Math.round(data.current.temperature_2m),
          feelsLike: Math.round(data.current.apparent_temperature),
          humidity: Math.round(data.current.relative_humidity_2m),
          windSpeed: Math.round(data.current.wind_speed_10m),
          code: data.current.weather_code,
          today: {
            code: data.daily.weather_code[0],
            high: Math.round(data.daily.temperature_2m_max[0]),
            low: Math.round(data.daily.temperature_2m_min[0]),
          },
          tomorrow: {
            code: data.daily.weather_code[1],
            high: Math.round(data.daily.temperature_2m_max[1]),
            low: Math.round(data.daily.temperature_2m_min[1]),
          },
        });
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    fetchWeather();
    const timer = setInterval(fetchWeather, REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (variant === "forecast") {
    if (error) {
      return <span className="text-sm text-gray-400">Weather unavailable</span>;
    }

    if (!weather) {
      return <span className="text-sm text-gray-400 animate-pulse">Loading weather…</span>;
    }

    const todayInfo = describeWeather(weather.today.code);
    const tomorrowInfo = describeWeather(weather.tomorrow.code);

    return (
      <div className="flex items-center gap-5 sm:gap-6">
        <div className="flex items-center gap-2">
          <span className="text-3xl leading-none">{todayInfo.icon}</span>
          <div className="leading-tight">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              Today
            </p>
            <p className="text-base font-bold text-gray-900">
              {weather.today.high}°{" "}
              <span className="font-normal text-gray-500">{weather.today.low}°</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-3xl leading-none">{tomorrowInfo.icon}</span>
          <div className="leading-tight">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              Tomorrow
            </p>
            <p className="text-base font-bold text-gray-900">
              {weather.tomorrow.high}°{" "}
              <span className="font-normal text-gray-500">{weather.tomorrow.low}°</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-white/70 ring-1 ring-black/5 shadow-sm px-5 py-4 text-sm text-gray-500">
        <span className="text-2xl">🌡️</span>
        Weather unavailable right now
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-white/70 ring-1 ring-black/5 shadow-sm px-5 py-4 text-sm text-gray-400 animate-pulse">
        <span className="text-2xl">🌡️</span>
        Loading Wakefield weather…
      </div>
    );
  }

  const { label, icon } = describeWeather(weather.code);
  const tomorrow = describeWeather(weather.tomorrow.code);

  return (
    <div className="flex flex-col sm:flex-row items-stretch rounded-2xl bg-gradient-to-br from-sky-50 to-amber-50 ring-1 ring-black/5 shadow-sm px-5 py-4">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="text-4xl leading-none">{icon}</div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Today</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">{weather.temperature}°F</span>
            <span className="text-sm text-gray-600 truncate">{label}</span>
          </div>

          <p className="text-xs text-gray-500 mt-0.5">
            Feels like {weather.feelsLike}°F · Humidity {weather.humidity}%
          </p>
        </div>
      </div>

      <div className="h-px w-full sm:h-auto sm:w-px bg-black/10 my-3 sm:my-0 sm:mx-4" />

      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="text-3xl leading-none">{tomorrow.icon}</div>

        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tomorrow</p>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-gray-900">{weather.tomorrow.high}°</span>
            <span className="text-sm text-gray-500">{weather.tomorrow.low}°</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{tomorrow.label}</p>
        </div>
      </div>
    </div>
  );
}
