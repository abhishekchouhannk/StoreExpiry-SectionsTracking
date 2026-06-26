const express = require('express');
const path = require('path');
const attachDb = require('./middleware/attachDb');
const apiRoutes = require('./routes');
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(attachDb);
app.use('/api', apiRoutes);
// SPA fallback
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
module.exports = app;