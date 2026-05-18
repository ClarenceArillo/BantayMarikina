const express = require('express');
const router = express.Router();

// Safety Tips
router.get('/safety-tips', (req, res) => {
  res.json({
    typhoon: {
      before: [
        'Know your area',
        'Secure your home',
        'Prepare kit',
      ],
      during: [
        'Stay indoors',
        'Monitor updates',
        'Unplug appliances',
      ],
      after: [
        'Check for damages',
        'Report hazards',
        'Assist neighbors',
      ],
    },
    earthquake: {
      before: [
        'Know your area',
        'Secure heavy objects',
        'Prepare kit',
        'Family plan',
      ],
      during: [
        'Drop, cover, hold',
        'Stay clear',
        'Find open space',
        'Pull over if driving',
      ],
      after: [
        'Check for injuries',
        'Report hazards',
        'Expect aftershocks',
        'Stay informed',
      ],
    },
  });
});

//  evacuation
router.get('/evacuation', (req, res) => {
  res.json({
    steps: [
      {
        step: 1,
        title: 'Stay Informed',
        description: 'Monitor radio, app alerts',
      },
      {
        step: 2,
        title: 'Secure Your Home',
        description: 'Turn off gas, water, electricity',
      },
      {
        step: 3,
        title: 'Grab Go-Bag',
        description: 'Ensure you have IDs, first aid, water',
      },
      {
        step: 4,
        title: 'Move to Routes',
        description: 'Use designated routes to reach evacuation areas',
      },
      {
        step: 5,
        title: 'Check-in',
        description: 'Evacuate at the shelter upon arrival',
      },
    ],
    routes: [
      { name: 'Route A', color: 'Blue' },
      { name: 'Route B', color: 'Red' },
      { name: 'Route C', color: 'Yellow' },
    ],
    evacuation_areas: [
      {
        name: 'Barangay Hall',
        latitude: 14.6507,
        longitude: 121.1029,
      },
    ],
  });
});

// Hotlines
router.get('/hotlines', (req, res) => {
  res.json({
    main_emergency: {
      name: 'Marikina City Rescue',
      number: '8-161',
    },
    rescue: [
      '8-646-2436 to 38',
      '8-646-0427',
      '7-116-5532',
    ],
    telecoms: [
      { name: 'Globe', number: '0917-584-2168' },
      { name: 'Smart', numbers: ['0928-559-3341', '0998-997-0115', '0998-579-6435'] },
    ],
    government: [
      { name: "Mayor's Office", number: '8646-1634' },
      { name: 'DSWD', number: '369-4132' },
      { name: 'Health Office', number: '097-1108 / 942-2359' },
      { name: 'Engineering', number: '8948-1201 / 948-1202' },
      { name: 'PNP Marikina', number: '8405-0001' },
    ],
    fire_department: [
      { name: 'Malanday', number: '998-7412' },
      { name: 'Malanday', number: '998-7412' },
      { name: 'Malanday', number: '998-7412' },
      { name: 'Malanday', number: '998-7412' },
      { name: 'Malanday', number: '998-7412' },
      { name: 'Malanday', number: '998-7412' },
    ],
  });
});

module.exports = router;