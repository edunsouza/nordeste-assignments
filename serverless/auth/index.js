const express = require('express');
const app = express();

// this is just a secure endpoint for oauth2 auth code step
app.get('/callback', (req, res) => {
    res.redirect(`http://designacoes.edunsouza.xyz/callback?code=${req.query.code}`);
});

module.exports = app;