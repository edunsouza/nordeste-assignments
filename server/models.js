const mongoose = require('mongoose');
const { Schema, connection } = mongoose;
const db = connection.useDb('nordeste');

const Contacts = new Schema({
    name: String,
    address: String
}, {
    collection: 'contacts'
});

const CleaningGroups = new Schema({
    groupId: String,
    name: String,
}, {
    collection: 'cleaningGroups'
});

const Configs = new Schema({
    key: String,
    value: String
}, {
    collection: 'configs'
});

const Cache = new Schema({
    dayWeekBegins: String,
    dayWeekEnds: String,
    loggedUser: String,
    weekend: Schema.Types.Mixed,
    ministry: Schema.Types.Mixed,
    cleaning: Schema.Types.Mixed,
    week: Schema.Types.Mixed,
}, {
    collection: 'cache'
});

const ContactGroups = new Schema({
    name: String,
    contacts: [Schema.Types.ObjectId]
}, {
    collection: 'contactGroups'
});

module.exports = {
    Contacts: db.model('Contacts', Contacts),
    CleaningGroups: db.model('CleaningGroups', CleaningGroups),
    Configs: db.model('Configs', Configs),
    Cache: db.model('Cache', Cache),
    ContactGroups: db.model('ContactGroups', ContactGroups),
};
