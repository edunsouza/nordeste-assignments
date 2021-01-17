const crypto = require('crypto');
const moment = require('moment');
const axios = require('axios');
const sendGridMail = require('@sendgrid/mail');

const secret = {
    algorithm: 'aes-256-ctr',
    password: process.env.HASHING_KEY || 'devmode'
};

const encrypt = value => {
    const cipher = crypto.createCipher(secret.algorithm, secret.password);
    const encrypted = cipher.update(String(value), 'utf8', 'hex');
    return encrypted + cipher.final('hex');
};

const decrypt = value => {
    const decipher = crypto.createDecipher(secret.algorithm, secret.password);
    const decrypted = decipher.update(String(value), 'hex', 'utf8');
    return decrypted + decipher.final('utf8');
};

const random = (size = 10) => {
    return [...Array(Math.ceil(size / 10))]
        .reduce(r => r += Math.random().toString(36).substring(2, 12), '')
        .substring(0, size);
};

const capitalize = text => {
    return String(text)
        .toLowerCase()
        .replace(/(\b|^)[a-z]/g, match => match.toUpperCase())
};

const getProperText = text => {
    text = text || '';
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
};

const getDynamicUrls = () => {
    const getMonth = d => d.format('MMMM');
    const getDay = d => d.format('D') + (d.date() === 1 ? 'º' : '');

    const today = moment().add(shouldJumpToNextWeek() ? 1 : 0, 'week').locale('pt-br');
    const startOfWeek = moment(today).startOf('isoWeek');
    const endOfWeek = moment(today).endOf('isoWeek');
    const currentYear = moment(startOfWeek).startOf('year').format('Y');

    const TEMPLATE_URL = 'https://www.jw.org/pt/biblioteca/jw-apostila-do-mes/'
        + '{M}-{M++}-{Y}-mwb/'
        + 'Programação-da-semana-de-{FROM}{0}-{TO}{1}-na-Apostila-da-Reunião-Vida-e-Ministério/';

    const endpoint = TEMPLATE_URL
        .replace('{M}', getMonth(startOfWeek))
        .replace('{M++}', getMonth(startOfWeek.clone().add(1, 'month')))
        .replace('{Y}', currentYear)
        .replace('{TO}', `${getDay(endOfWeek)}-de-${getMonth(endOfWeek)}`)
        .replace('{FROM}', getMonth(startOfWeek) == getMonth(endOfWeek)
            ? getDay(startOfWeek)
            : [getDay(startOfWeek), 'de', getMonth(startOfWeek)].join('-')
        );

    return [
        encodeURI(endpoint.replace('{0}', '').replace('{1}', `-de-${currentYear}`)),
        encodeURI(endpoint.replace('{0}', `-de-${currentYear}`).replace('{1}', `-de-${parseInt(currentYear, 10) + 1}`)),
        encodeURI(endpoint.replace(/\{[01]\}/g, ''))
    ]
}

const toWorkbookItem = scraped => {
    const spruce = String(scraped).replace(/[:"'”“]|\s+/g, m => `"'”“`.split('').includes(m) ? '"' : ' ').trim();
    const squeezed = getProperText(spruce);

    const id = squeezed.match(/[^\(]+\(|[^\(]+/).pop().replace(/[)(\s\?]/g, '').toLowerCase();
    const text = spruce.match(/[^\)]+\)|[^\)]+/).pop();
    const hasPair = Boolean(!squeezed.match(/(discurso|leitura da biblia) \(/gi) && squeezed.match(/\(melhore licao|estudo biblico de congregacao/gi));

    return { text, hasPair, id };
};

const shouldJumpToNextWeek = () => {
    return ['sex', 'sáb', 'dom'].includes(moment().locale('pt-br').format('ddd').toLowerCase());
}

const getWeekSpan = () => {
    const now = moment().locale('pt-br');

    if (shouldJumpToNextWeek()) {
        now.add(1, 'week');
    }

    return {
        dayWeekBegins: now.startOf('isoWeek').format('DD/MM'),
        dayWeekEnds: now.endOf('isoWeek').format('DD/MM')
    };
};

const getWorkbookSkeleton = () => [
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

/**
 * @to format: [{
 *      email: 'name@email.com',
 *      name: 'Name Example'
 * }]
*/
const sendEmail = async (to, subject, html) => {
    const headers = {
        'api_key': process.env.PEPIPOST_API_KEY,
        'content-type': 'application/json'
    };
    const fromName = 'Nordeste Designações';
    const body = {
        from: { email: process.env.PEPIPOST_FROM_EMAIL, name: fromName },
        subject: subject,
        content: [{ type: 'html', value: html }],
        personalizations: [{ to }]
    };
    // first attempt
    const { data: firstAttemptData } = await axios.post('https://api.pepipost.com/v5/mail/send', body, { headers }).catch(e => ({ data: { error: e } }));

    // backup - second attempt
    if (!firstAttemptData || firstAttemptData.error) {
        console.log('<EMAIL NOTIFICATION>: [FIRST ATTEMPT FAILED] - Pepipost error:', firstAttemptData.error);

        const secondAttemptBody = {
            from: `${fromName} <${process.env.SENDGRID_FROM_EMAIL}>`,
            to: to.map(t => t.email),
            subject,
            html,
        }

        sendGridMail.setApiKey(process.env.SENDGRID_API_KEY);
        const secondAttemptData = await sendGridMail.send(secondAttemptBody).catch(e => ({ error: e }));

        if (!secondAttemptData || secondAttemptData.error) {
            console.log('<EMAIL NOTIFICATION>: [SECOND ATTEMPT FAILED] - SendGrid error:', secondAttemptData.error);
            return false;
        }
    }

    console.log('<EMAIL NOTIFICATION>: [EMAIL SENT] - payload:', firstAttemptData);
    return { success: firstAttemptData };
};

module.exports = {
    encrypt,
    decrypt,
    getWeekSpan,
    random,
    capitalize,
    getProperText,
    getDynamicUrls,
    toWorkbookItem,
    getWorkbookSkeleton,
    sendEmail
};