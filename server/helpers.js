const moment = require('moment-timezone');
const axios = require('axios');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const sendGridMail = require('@sendgrid/mail');

const { Configs } = require('./models');
const { encrypt, decrypt, to64, random, getProperText } = require('./utils');

function toTimezoneAndLocale(date) {
    return moment(date || undefined).tz('America/Sao_Paulo').locale('pt-br');
}

function getWorkbookEndpoints(skippable, date) {
    date = toTimezoneAndLocale(date);

    if (skippable && ['sex', 'sáb', 'dom'].includes(date.format('ddd'))) {
        // jump to next week if today is Friday, Saturday or Sunday
        date.add(1, 'week');
    }

    const week0 = date.clone().startOf('isoWeek');
    const week1 = date.clone().endOf('isoWeek');

    const [year0, year1] = [week0, week0.clone().add(1, 'y')].map(y => y.format('Y'));
    const [month0, month1] = [week0, week1].map(m => m.format('MMMM'));
    const [day0, day1] = [week0, week1].map(d => d.format('D'));

    const monthRange = [week0.clone(), week0.clone().add(1, 'month')];
    // month range should always be: [odd month, even month]
    if (week0.format('M') % 2 === 0) {
        monthRange[0].subtract(1, 'month');
        monthRange[1].subtract(1, 'month');
    }

    const templateUrl = '{M1-M2}-{Y}-mwb/Programação-da-semana-de-{FROM}{0}-{TO}{1}-na-Apostila-da-Reunião-Vida-e-Ministério';
    const endpoint = 'https://www.jw.org/pt/biblioteca/jw-apostila-do-mes/' + templateUrl
        .replace('{M1-M2}', monthRange.map(mr => getProperText(mr.format('MMMM'))).join('-'))
        .replace('{Y}', year0)
        .replace('{TO}', `${day1}-de-${month1}`)
        .replace('{FROM}', month0 === month1 ? day0 : [day0, 'de', month0].join('-'));

    return [
        encodeURI(endpoint.replace('{0}', '').replace('{1}', `-de-${year0}`)),
        encodeURI(endpoint.replace('{0}', `-de-${year0}`).replace('{1}', `-de-${year1}`)),
        encodeURI(endpoint.replace(/\{[01]\}/g, ''))
    ];
}

function getWeekSpan(withYear = false, date = null) {
    const now = toTimezoneAndLocale(date);
    const format = withYear ? 'DD/MM/YYYY' : 'DD/MM';
    return {
        dayWeekBegins: now.startOf('isoWeek').format(format),
        dayWeekEnds: now.endOf('isoWeek').format(format)
    };
}

async function getGoogleAuth() {
    const credentials = await Configs.findOne({ key: 'google-credentials' }).lean();
    const { clientId, clientSecret } = JSON.parse(credentials.value);
    const callbackHost = process.env.NODE_ENV !== 'PROD' ? 'http://localhost:8910' : 'https://jlt1y3.deta.dev';
    return new google.auth.OAuth2(clientId, clientSecret, `${callbackHost}/callback`);
}

async function getGoogleRedirect() {
    const auth = await getGoogleAuth();
    return auth.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/gmail.send']
    });
}

async function getGoogleToken(authorizationCode) {
    const auth = await getGoogleAuth();
    const { tokens } = await auth.getToken(authorizationCode);
    return tokens;
}

async function getSession(id) {
    if (id) {
        const session = await Configs.findOne({ key: id }).lean().catch(() => null);
        if (session) {
            return JSON.parse(decrypt(session.value));
        }
    }
}

async function createSession(data) {
    const id = random();

    await Configs.create({
        key: id,
        value: encrypt(JSON.stringify(data))
    });

    return id;
}

async function clearSession(id) {
    if (id) {
        return await Configs.deleteOne({ key: id });
    }
}

// todo: rewrite
async function scrapeWorkbook({ date, skippable } = {}) {
    const skeleton = [
        {
            id: 'intro',
            color: '#222222',
            tone: '#ffffff',
            getTitle: doc => `${doc('#p1').text()} | ${doc('#p2').text()}`,
            isAssignable: part => Boolean(part.match(/(comentários iniciais)|(oração)/gi)),
            chairmanAssigned: part => Boolean(part.match(/(comentários iniciais)/gi)),
            items: [],
            itemsSelector: '#p3,#p4',
            itemsTone: '#222222',
        },
        {
            id: 'treasures',
            color: '#ffffff',
            tone: '#606a70',
            getTitle: doc => doc('#section2 .mwbHeadingIcon').text(),
            isAssignable: () => true,
            chairmanAssigned: () => false,
            items: [],
            itemsSelector: '*[class*=treasures] + .pGroup > ul > li',
            itemsTone: '#606a70',
        },
        {
            id: 'ministry',
            color: '#ffffff',
            tone: '#c18626',
            getTitle: doc => doc('#section3 .mwbHeadingIcon').text(),
            isAssignable: () => true,
            chairmanAssigned: part => !part.match(/\(melhore lição/gi),
            items: [],
            itemsSelector: '*[class*=ministry] + .pGroup > ul > li',
            itemsTone: '#c18626',
        },
        {
            id: 'living',
            color: '#ffffff',
            tone: '#961526',
            getTitle: doc => doc('#section4 .mwbHeadingIcon').text(),
            isAssignable: part => Boolean(!part.match(/cântico/gi) || (part.match(/oração/gi))),
            chairmanAssigned: part => Boolean(part.match(/comentários finais/gi)),
            items: [],
            itemsSelector: '*[class*=christianLiving] + .pGroup > ul > li',
            itemsTone: '#961526',
        }
    ];

    const [workbookUrl, fallback1, fallback2] = getWorkbookEndpoints(skippable, date);
    const { data } = await axios.get(workbookUrl).catch(async () => {
        return await axios.get(fallback1).catch(async () => {
            return await axios.get(fallback2).catch(() => null);
        });
    });

    if (!data) {
        console.log('multiple attempts failed trying to get workbook endpoint');
    }

    const $ = cheerio.load(data);
    let sectionPosition = 1;

    return skeleton.map(section => {
        section.title = section.getTitle($);
        section.position = sectionPosition++;
        let itemPosition = 0;

        $(section.itemsSelector).remove('.noMarker').each((_, e) => {
            const fullText = $(e).text();
            const spruce = fullText.replace(/\n/g, '').replace(/[:"'”“]|\s+/g, m => `"'”“`.split('').includes(m) ? '"' : ' ').trim();
            const squeezed = getProperText(spruce).replace(/\s+/g, ' ');

            const item = {
                position: itemPosition,
                chairmanAssigned: section.chairmanAssigned(fullText),
                hasPair: Boolean(!squeezed.match(/(discurso|leitura da biblia) \(/gi) && squeezed.match(/\(melhore licao|estudo biblico de congregacao/gi)),
                text: spruce.match(/[^\)]+\)|[^\)]+/).pop(),
                id: squeezed.match(/[^\(]+\(|[^\(]+/).pop().replace(/[)(\s\?\"\']/g, '').toLowerCase().concat(`_${++itemPosition}`),
            };

            item.isAssignable = section.isAssignable(item.text);

            section.items.push(item);
        });

        delete section.itemsSelector;
        return section;
    });
}

// todo: rewrite - split into multiple functions
async function sendEmail(to, subject, html) {
    if (process.env.NODE_ENV !== 'PROD') {
        to = [process.env.REPORTS_TO_EMAIL];
    }

    const fromName = 'Nordeste Designações';
    const options = {
        headers: {
            'api_key': process.env.PEPIPOST_API_KEY,
            'Content-Type': 'application/json; charset=UTF-8'
        }
    };
    const body1 = {
        subject,
        from: {
            email: process.env.PEPIPOST_FROM_EMAIL,
            name: fromName
        },
        content: [{
            type: 'html',
            value: html
        }],
        personalizations: [{
            to: to.map(email => ({
                email,
                name: random()
            }))
        }]
    };

    // first attempt
    const { data: first } = await axios.post('https://api.pepipost.com/v5/mail/send', body1, options).catch(error => {
        return { data: { error } };
    });

    // second attempt
    if (!first || first.error) {
        console.log(`${moment().format('DD/MM/YYYY HH:mm')} :::: <EMAIL NOTIFICATION>: [FIRST ATTEMPT FAILED] - Pepipost error:`, first.error.response.data);

        const body2 = {
            from: `${fromName} <${process.env.SENDGRID_FROM_EMAIL}>`,
            to,
            subject,
            html,
        };

        sendGridMail.setApiKey(process.env.SENDGRID_API_KEY);
        const second = await sendGridMail.send(body2).catch(error => ({ error }));

        if (!second || second.error) {
            console.log(`${moment().format('DD/MM/YYYY HH:mm')} :::: <EMAIL NOTIFICATION>: [SECOND ATTEMPT FAILED] - SendGrid error:`, second.error);
            return false;
        }

        console.log(`${moment().format('DD/MM/YYYY HH:mm')} :::: <EMAIL NOTIFICATION>: [EMAIL SENT ON 2nd ATTEMPT] - payload:`, second);
        return {
            success: true,
            response: second
        };
    }

    console.log(`${moment().format('DD/MM/YYYY HH:mm')} :::: <EMAIL NOTIFICATION>: [EMAIL SENT ON 1st ATTEMPT] - payload:`, first);
    return {
        success: true,
        response: first
    };
}

async function sendGmail(auth, to = [], subject, content) {
    if (process.env.NODE_ENV !== 'PROD') {
        to = [];
    }

    to = [...to, process.env.REPORTS_TO_EMAIL];

    const rfcContent = [
        `From: Designator <me>`,
        `To: ${to.join(', ')}`,
        `Subject: =?utf-8?B?${to64(subject)}?=`,
        `Date: ${new Date().toGMTString()}`,
        `Content-Type: text/html; charset=UTF-8`,
        `Message-ID: ${Math.random().toString(36).substring(2)}`,
        '',
        content
    ].join('\n');

    return await google.gmail({ version: 'v1', auth }).users.messages.send({
        userId: 'me',
        requestBody: {
            raw: to64(rfcContent)
        }
    });
}

module.exports = {
    getWeekSpan,
    getGoogleAuth,
    getGoogleRedirect,
    getGoogleToken,
    getSession,
    createSession,
    clearSession,
    scrapeWorkbook,
    sendEmail,
    sendGmail,
};