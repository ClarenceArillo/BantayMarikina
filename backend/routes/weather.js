const express = require('express');
const router = express.Router();
const axios = require('axios');

// Marikina City coordinates
const LAT = 14.6507;
const LON = 121.1029;

function getCondition(weatherCode) {
  if (weatherCode === 0) return 'Clear Sky';
  if (weatherCode <= 2) return 'Partly Cloudy';
  if (weatherCode === 3) return 'Overcast';
  if (weatherCode <= 49) return 'Foggy';
  if (weatherCode <= 59) return 'Drizzle';
  if (weatherCode <= 69) return 'Rainy';
  if (weatherCode <= 79) return 'Snowy';
  if (weatherCode <= 84) return 'Rain Showers';
  if (weatherCode <= 99) return 'Thunderstorm';
  return 'Unknown';
}

function getDayName(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
}

router.get('/', async (req, res) => {
  try {
    const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: LAT,
        longitude: LON,
        current: 'temperature_2m,weathercode,relative_humidity_2m,windspeed_10m',
        daily: 'temperature_2m_max,temperature_2m_min,weathercode',
        timezone: 'Asia/Manila',
        forecast_days: 4,
      }
    });

    const data = response.data;
    const current = data.current;
    const daily = data.daily;

    // 3-day forecast (skip today which is index 0)
    const forecast = [1, 2, 3].map(i => ({
      day: getDayName(daily.time[i]),
      temp_max: Math.round(daily.temperature_2m_max[i]),
      temp_min: Math.round(daily.temperature_2m_min[i]),
      condition: getCondition(daily.weathercode[i]),
    }));

    res.json({
      location: 'Marikina City',
      date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
      temperature: Math.round(current.temperature_2m),
      humidity: current.relative_humidity_2m,
      windspeed: current.windspeed_10m,
      condition: getCondition(current.weathercode),
      forecast,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;