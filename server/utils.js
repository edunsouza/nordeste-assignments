const { createCipher, createDecipher } = require('crypto');

const secret = {
    algorithm: 'aes-256-ctr',
    password: process.env.HASHING_KEY || 'devmode'
};

// TODOD
const getLogger = () => { };

const encrypt = value => {
    const cipher = createCipher(secret.algorithm, secret.password);
    const encrypted = cipher.update(String(value), 'utf8', 'hex');
    return encrypted + cipher.final('hex');
};

const decrypt = value => {
    const decipher = createDecipher(secret.algorithm, secret.password);
    const decrypted = decipher.update(String(value), 'hex', 'utf8');
    return decrypted + decipher.final('utf8');
};

const to64 = utf8 => {
    return Buffer.from(utf8, 'utf-8').toString('base64');
};

const from64 = b64 => {
    return Buffer.from(b64, 'base64').toString('utf-8');
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

module.exports = {
    encrypt,
    decrypt,
    to64,
    from64,
    random,
    capitalize,
    getProperText
};