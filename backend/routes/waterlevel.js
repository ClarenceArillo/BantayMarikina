const express = require('express');
const { getCachedWaterLevels, refreshWaterLevels } = require('../services/dashboardCache');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const waterLevels = req.query.refresh === 'true'
      ? await refreshWaterLevels({ force: true })
      : await getCachedWaterLevels();
    res.json(waterLevels);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
