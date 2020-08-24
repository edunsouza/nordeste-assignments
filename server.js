const app = require('./server/start');

app((port) => {
    console.log(`Servidor (server/start) iniciado e rodando na porta: ${port}`);
});