const path = require('path');
const pug = require('pug');

const { getSession, getGoogleRedirect, getGoogleToken, createSession } = require('../helpers');

module.exports = app => {

    app.get('/auth', async (req, res) => {
        try {
            const { sessionId } = req.cookies;
            const session = await getSession(sessionId);

            if (!session) {
                return res.status(200).json({
                    status: 'invalid',
                    redirectUrl: await getGoogleRedirect()
                });
            }

            res.status(200).json({ status: 'valid' });
        } catch (error) {
            res.status(400).json({ status: 'unknown' });
        }
    });

    app.get('/callback', async (req, res) => {
        try {
            const token = await getGoogleToken(req.query.code);
            const sessionId = await createSession(token);

            if (sessionId) {
                res.cookie('sessionId', sessionId);
            }

            const authPath = path.join(__dirname, 'callback.pug');
            const authPage = pug.renderFile(authPath);
            res.status(200).send(authPage);
        } catch (error) {
            console.log(error)
            res.status(400).json({ status: 'unknown' });
        }
    });

    return app;
};