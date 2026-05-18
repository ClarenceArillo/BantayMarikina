require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const {
  refreshWaterLevels,
  refreshWeather,
  warmDashboardCache,
} = require('./services/dashboardCache');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors());
app.use(express.json());

// Routes
const reportsRouter = require('./routes/reports');
const usersRouter = require('./routes/users');
const weatherRouter = require('./routes/weather');
const waterLevelRouter = require('./routes/waterlevel');
const notificationsRouter = require('./routes/notifications');

app.get('/', (req, res) => {
  res.json({ message: 'MarikinaSafeWatch API is running!' });
});

app.use('/api/reports', reportsRouter);
app.use('/api/users', usersRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/waterlevel', waterLevelRouter);
app.use('/api/notifications', notificationsRouter);

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});

warmDashboardCache();
cron.schedule('*/10 * * * *', () => {
  refreshWeather().catch((error) => {
    console.error('Failed to refresh weather cache:', error.message);
  });
});
cron.schedule('*/5 * * * *', () => {
  refreshWaterLevels().catch((error) => {
    console.error('Failed to refresh water level cache:', error.message);
  });
});
