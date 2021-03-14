const express = require('express');
const app = express();

app.get('/', (req, res) => res.status(200).json({ success: true }));

module.exports = app