const express = require('express');
const { getCachedWeather, refreshWeather } = require('../services/dashboardCache');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const weather = req.query.refresh === 'true'
      ? await refreshWeather({ force: true })
      : await getCachedWeather();
    res.json(weather);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
