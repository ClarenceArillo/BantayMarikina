require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const {
  refreshWaterLevels,
  refreshWeather,
  warmDashboardCache,
} = require('./services/dashboardCache');
const { startOfficialAlertPolling, stopOfficialAlertPolling } = require('./services/officialAlertPoller');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

function log(level, message, meta = {}) {
  const payload = {
    level,
    message,
    service: 'bantay-marikina-backend',
    timestamp: new Date().toISOString(),
    ...meta,
  };
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

process.on('unhandledRejection', (reason) => {
  log('error', 'Unhandled promise rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

process.on('uncaughtException', (error) => {
  log('error', 'Uncaught exception', {
    error: error.message,
    stack: error.stack,
  });
});

app.use(cors());
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  req.setTimeout(30_000);
  res.setTimeout(35_000);
  next();
});

// Routes
const reportsRouter = require('./routes/reports');
const usersRouter = require('./routes/users');
const mediaRouter = require('./routes/media');
const weatherRouter = require('./routes/weather');
const waterLevelRouter = require('./routes/waterlevel');
const alertsRouter = require('./routes/alerts');

app.get('/', (req, res) => {
  res.json({ message: 'MarikinaSafeWatch API is running!' });
});

app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.use('/api/reports', reportsRouter);
app.use('/api/users', usersRouter);
app.use('/api/media', mediaRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/waterlevel', waterLevelRouter);
app.use('/api/alerts', alertsRouter);

const server = app.listen(PORT, HOST, () => {
  log('info', 'Backend listener ready', { host: HOST, port: Number(PORT) });
});
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.on('error', (error) => {
  log('error', 'Backend listener failed', {
    code: error.code,
    error: error.message,
    host: HOST,
    port: Number(PORT),
  });
  process.exitCode = 1;
});

warmDashboardCache().catch((error) => {
  log('warn', 'Dashboard cache warmup failed after listener startup', {
    error: error.message,
  });
});
startOfficialAlertPolling();
cron.schedule('*/10 * * * *', () => {
  refreshWeather().catch((error) => {
    log('warn', 'Failed to refresh weather cache', { error: error.message });
  });
});
cron.schedule('*/5 * * * *', () => {
  refreshWaterLevels().catch((error) => {
    log('warn', 'Failed to refresh water level cache', { error: error.message });
  });
});

process.on('SIGTERM', () => {
  stopOfficialAlertPolling();
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  stopOfficialAlertPolling();
  server.close(() => process.exit(0));
});
