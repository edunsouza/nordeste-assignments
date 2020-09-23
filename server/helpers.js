const crypto = require('crypto');
const moment = require('moment');
const axios = require('axios');
const sendGridMail = require('@sendgrid/mail');

// TODO: LOGIN
const generateHash = value => {
    return crypto
        .createHmac('sha256', process.env.HASHING_KEY || 'devmode')
        .update(String(value))
        .digest('hex')
};

const getWeekSpan = () => {
    const now = moment().locale('pt-br');

    if (shouldJumpToNextWeek()) {
        now.add(1, 'week');
    }

    return {
        start: now.startOf('isoWeek').format('DD/MM'),
        end: now.endOf('isoWeek').format('DD/MM'),
    };
};

const generateRandomStringSized = size => {
    return Array(size > 0 && size < 100 ? size : 10)
        .fill()
        .map(() => '0ABC1DEF2GHI3JKL4MNO5PQR6STU7VWX8YZ9'[Math.round(Math.random() * 35)])
        .join('')
};

const capitalize = text => {
    if (typeof text === 'string') {
        return text.toLowerCase().replace(/(?:^|\s|["'([{])+\S/g, match => match.toUpperCase());
    }
};

const getProperText = text => {
    text = text || '';
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
};

const shouldJumpToNextWeek = () => {
    return ['sex', 'sáb', 'dom'].includes(moment().locale('pt-br').format('ddd').toLowerCase());
}

const getDynamicUrl = () => {
    const today = shouldJumpToNextWeek() ? moment().endOf('isoWeek').add(1, 'day') : moment();
    const startOfWeek = today.clone().locale('pt-br').startOf('isoWeek');
    const endOfWeek = today.clone().locale('pt-br').endOf('isoWeek');
    const getMonth = d => d.format('MMMM');
    const getMonthDay = d => d.format('D');
    const isSameMonth = getMonth(startOfWeek) == getMonth(endOfWeek);
    const monthName = getMonth(moment(startOfWeek));
    const yearNumber = moment(startOfWeek).startOf('year').format('Y');
    const start = isSameMonth ? getMonthDay(startOfWeek) : [getMonthDay(startOfWeek), 'de', getMonth(startOfWeek)].join('-');
    const end = `${getMonthDay(endOfWeek)}-de-${getMonth(endOfWeek)}`;
    return encodeURI(`https://www.jw.org/pt/biblioteca/jw-apostila-do-mes/${monthName}-${yearNumber}-mwb/Programa-da-semana-de-${start}-${end}-de-${yearNumber}-na-Apostila-da-Reunião-Vida-e-Ministério/`);
}

const indexOrInfinity = (needle, haystack) => {
    const idx = String(haystack).indexOf(String(needle));
    return ~idx ? idx : Infinity;
};

const toWorkbookItem = fullText => {
    fullText = (fullText || '').replace(/[:"']/g, '');
    const cleanText = getProperText(fullText);
    const should = /(\(melhore licao)|(estudo biblico de congregacao)/ig;
    const shouldNot = /(discurso \()|(leitura da biblia \()/ig;
    return {
        text: fullText
            .substring(0, indexOrInfinity(')', fullText) + 1)
            .replace(/[”“]/g, '"'),
        hasPair: Boolean(cleanText.match(should) && !cleanText.match(shouldNot)),
        id: getProperText(
            fullText
                .substring(0, indexOrInfinity('(', fullText) - 1)
                .replace(/[”“"':?]+/gi, '')
                .replace(/\s+/gi, '_')
        )
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
        getTitle: doc => doc('#section2 .shadedHeader').text(),
        isAssignable: () => true,
        chairmanAssigned: () => false,
        items: [],
        itemsSelector: '.treasures + .pGroup > ul > li',
        itemsTone: '#606a70',
    },
    {
        id: 'ministry',
        color: '#ffffff',
        tone: '#c18626',
        getTitle: doc => doc('#section3 .shadedHeader').text(),
        isAssignable: () => true,
        chairmanAssigned: part => !part.match(/\(melhore lição/gi),
        items: [],
        itemsSelector: '.ministry + .pGroup > ul > li',
        itemsTone: '#c18626',
    },
    {
        id: 'living',
        color: '#ffffff',
        tone: '#961526',
        getTitle: doc => doc('#section4 .shadedHeader').text(),
        isAssignable: part => Boolean(!part.match(/cântico/gi) || (part.match(/oração/gi))),
        chairmanAssigned: part => Boolean(part.match(/comentários finais/gi)),
        items: [],
        itemsSelector: '.christianLiving + .pGroup > ul > li',
        itemsTone: '#961526',
    },
];

/**
 * @to format: [{
 *      email: 'name@email.com',
 *      name: 'Name Example'
 * }]
*/
const sendEmail = async (to, subject, html) => {
    const headers = { "api_key": process.env.PEPIPOST_API_KEY, "content-type": "application/json" };
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
    getWeekSpan,
    generateRandomStringSized,
    capitalize,
    getProperText,
    getDynamicUrl,
    toWorkbookItem,
    getWorkbookSkeleton,
    sendEmail,
};