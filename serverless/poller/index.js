const { app } = require('deta');
const axios = require('axios');

const getNextMonday = () => {
    const now = new Date();
    const today = now.getDay();
    const monday = 1;
    const distance = monday - today;

    now.setDate(now.getDate() + distance + 7);
    now.setHours(12, 0, 0, 0);
    return now.toISOString();
};

// every Monday 12 PM: 
// deta cron set "0 12 ? * MON *"
app.lib.cron(async event => {
    const endpoint = `http://designacoes.edunsouza.xyz/api/v1/workbook/${getNextMonday()}`;

    const { data } = await axios(endpoint, { event }).catch(() => 'fail');

    if (data === 'fail') {
        console.error(`error trying to call ${endpoint}`);
    } else {
        console.log(`response from ${endpoint}:`, data);
    }
});

module.exports = app;