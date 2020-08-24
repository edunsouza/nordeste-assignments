const validateSession = (request, response, next) => {
    // TODO: check db session by cookies (study/implement jwt)
    // request.cookies.jw_designacoes_session
    next();
};

module.exports = {
    validateSession
};