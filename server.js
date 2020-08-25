const app = require('./server/start');

app(port => console.log(`Server is up and running on port: ${port}`));