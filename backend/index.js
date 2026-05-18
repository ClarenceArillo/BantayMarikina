require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
const reportsRouter = require('./routes/reports');
const usersRouter = require('./routes/users');
const weatherRouter = require('./routes/weather');
const waterLevelRouter = require('./routes/waterlevel');
const infoRouter = require('./routes/info');
const uploadRouter = require('./routes/upload');
const notificationsRouter = require('./routes/notifications');

app.get('/', (req, res) => {
  res.json({ message: 'MarikinaSafeWatch API is running!' });
});

app.use('/api/reports', reportsRouter);
app.use('/api/users', usersRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/waterlevel', waterLevelRouter);
app.use('/api/info', infoRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/notifications', notificationsRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('OpenWeather API Key:', process.env.OPENWEATHER_API_KEY);
});