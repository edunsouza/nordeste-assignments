const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const path = require('path');

const apiRoutes = require('./api');
const { validateSession } = require('./utils');

const PORT = process.env.app_port || 8910;
const app = express();
const apiRouter = express.Router();

module.exports = (callback) => {
    mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/nordeste', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    // settings
    app.use(cookieParser());
    app.use(express.json());
    app.use('/static', express.static(path.join(__dirname, '/../client/build/static'), { maxAge: 1000 }));
    // cors
    app.use((req, res, next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
        next();
    });
    // no cache
    app.use((req, res, next) => {
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.header('Expires', '-1');
        res.header('Pragma', 'no-cache');
        next();
    });

    // api root
    app.use('/api/v1', validateSession, apiRoutes(apiRouter));
    // otherwise api
    app.get('/api/*', (req, res) => res.status(404).json({ error: 'ROUTE NOT FOUND' }));

    // client serving
    app.get('*', validateSession, (req, res) => {
        if (process.env.NODE_ENV === 'PROD') {
            res.sendFile(path.join(__dirname, '..', 'client', 'build', 'index.html'));
        } else {
            res.redirect('/api/v1');
        }
    });

    // start
    app.listen(PORT, () => callback(PORT));
}