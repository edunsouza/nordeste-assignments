const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const path = require('path');

const defineRoutes = require('./api');
const app = express();
const apiRouter = express.Router();

const PORT = process.env.app_port || 8910;
const MONGO_URI = process.env.mongodb || 'mongodb://localhost:27017/nordeste';
const BUILD_FOLDER = path.join(__dirname, '..', 'client', 'build');

module.exports = async callback => {
    try {
        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // settings
        app.use(cookieParser());
        app.use(express.json());
        app.use('/static', express.static(path.join(BUILD_FOLDER, 'static'), { maxAge: 1000 }));

        // cors
        app.use((_, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
            next();
        });

        // no cache
        app.use((_, res, next) => {
            res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
            res.header('Expires', '-1');
            res.header('Pragma', 'no-cache');
            next();
        });

        // api root
        app.use('/api/v1', defineRoutes(apiRouter));

        // otherwise api
        app.get('/api/*', (_, res) => res.status(404).json({ error: 'ENDEREÇO NÃO ENCONTRADO' }));

        // client serving
        app.get('*', (_, res) => {
            if (process.env.NODE_ENV === 'PROD') {
                res.sendFile(path.join(BUILD_FOLDER, 'index.html'));
            } else {
                res.redirect('/api/v1');
            }
        });

        // start
        app.listen(PORT, () => callback(PORT));
    } catch (error) {
        console.error('<STARTUP>: [ERROR]', JSON.stringify(error, null, 4));
    }
};