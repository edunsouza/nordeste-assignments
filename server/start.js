const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const path = require('path');

const { Configs } = require('./models');
const defineApiRoutes = require('./api');
const defineAuthRoutes = require('./auth');

const PORT = process.env.app_port || 8910;
const MONGO_URI = process.env.mongodb || 'mongodb://localhost:27017/nordeste';
const BUILD_FOLDER = path.join(__dirname, '..', 'client', 'build');

const app = express();
const apiRouter = express.Router();
const authRouter = express.Router();

async function setEnv() {
    const keys = {
        'sendgrid-api-key': 'SENDGRID_API_KEY',
        'pepipost-api-key': 'PEPIPOST_API_KEY',
        'sendgrid-from-email': 'SENDGRID_FROM_EMAIL',
        'pepipost-from-email': 'PEPIPOST_FROM_EMAIL',
        'reports-to-email': 'REPORTS_TO_EMAIL',
    };

    const configs = await Configs.find({
        key: {
            $in: Object.keys(keys)
        }
    }).lean();

    configs.forEach(({ key, value }) => {
        process.env[keys[key]] = value;
    });
}

module.exports = async callback => {
    try {
        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        setEnv();

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

        // main routes
        app.use('/', defineAuthRoutes(authRouter));
        app.use('/api/v1', defineApiRoutes(apiRouter));

        // otherwise api
        app.get('/api/*', (_, res) => res.status(404).json({ error: 'ENDEREÇO NÃO ENCONTRADO' }));

        // otherwise main routes
        app.get('*', (_, res) => {
            if (['PROD', 'STATIC'].includes(process.env.NODE_ENV)) {
                // client serving
                res.sendFile(path.join(BUILD_FOLDER, 'index.html'));
            } else {
                res.redirect('/api/v1');
            }
        });

        // start
        app.listen(PORT, () => callback(PORT));
    } catch (error) {
        console.error('<STARTUP>: [ERROR]', error);
    }
};