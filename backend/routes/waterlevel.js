const express = require('express');
const router = express.Router();
const axios = require('axios');

function parseLevel(wl) {
  if (!wl) return null;
  const cleaned = wl.toString().replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function getStatus(level, alertwl, alarmwl, criticalwl) {
  if (level === null || level === undefined) return 'Unavailable';
  if (criticalwl && level >= parseFloat(criticalwl)) return 'Critical';
  if (alarmwl && level >= parseFloat(alarmwl)) return 'Warning';
  if (alertwl && level >= parseFloat(alertwl)) return 'Warning';
  return 'Normal';
}

// Map dashboard labels to PAGASA station names.
const STATION_MAP = {
  'Sto Nino': 'Sto Nino',
  Tumana: 'Tumana Bridge',
  Nangka: 'Nangka',
  Montalban: 'Montalban',
  Rodriguez: 'Rodriguez',
  Burgos: 'Burgos',
};

router.get('/', async (req, res) => {
  try {
    const response = await axios.get(
      'https://pasig-marikina-tullahanffws.pagasa.dost.gov.ph/water/main_list.do',
      {
        params: { _: Date.now() },
        headers: {
          accept: 'application/json, text/javascript, */*; q=0.01',
          isajax: 'true',
          'x-requested-with': 'XMLHttpRequest',
          referer: 'https://pasig-marikina-tullahanffws.pagasa.dost.gov.ph/',
        },
      }
    );

    const rawData = Array.isArray(response.data) ? response.data : response.data.value || [];

    const stations = Object.entries(STATION_MAP).map(([displayName, pagasaName]) => {
      const match = rawData.find((d) => d.obsnm === pagasaName);
      const level = match ? parseLevel(match.wl) : null;
      const status = match
        ? getStatus(level, match.alertwl, match.alarmwl, match.criticalwl)
        : 'Unavailable';

      return {
        station: displayName,
        level,
        status,
        last_reading: match ? match.timestr : null,
      };
    });

    res.json({ stations, updated_at: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
