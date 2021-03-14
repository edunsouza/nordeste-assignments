const mongoose = require('mongoose');
const { Schema, connection } = mongoose;
const db = connection.useDb('nordeste');

const Contacts = new Schema({
    name: String,
    address: String
});

const ContactGroups = new Schema({
    name: String,
    contacts: [Schema.Types.ObjectId]
});

const CleaningGroups = new Schema({
    groupId: String,
    name: String,
});

const Configs = new Schema({
    key: String,
    value: String
});

const Cache = new Schema({
    dayWeekBegins: String,
    dayWeekEnds: String,
    loggedUser: String,
    weekend: Schema.Types.Mixed,
    ministry: Schema.Types.Mixed,
    cleaning: Schema.Types.Mixed,
    week: Schema.Types.Mixed,
});

const Metrics = new Schema({
    name: String,
    value: Schema.Types.Mixed,
    reference: { type: Date, default: Date.now }
});

const Workbook = new Schema({
    week: String,
    year: String,
    sections: [
        new Schema({
            id: String,
            color: String,
            tone: String,
            itemsTone: String,
            items: [
                new Schema({
                    id: String,
                    text: String,
                    hasPair: Boolean,
                    isAssignable: Boolean,
                    chairmanAssigned: Boolean,
                    position: Number
                }, { _id: false })
            ],
            position: Number,
            title: String,
        }, { _id: false })
    ],
    createdAt: { type: Date, default: Date.now }
});

module.exports = {
    Contacts: db.model('Contacts', Contacts, 'contacts'),
    ContactGroups: db.model('ContactGroups', ContactGroups, 'contactGroups'),
    CleaningGroups: db.model('CleaningGroups', CleaningGroups, 'cleaningGroups'),
    Configs: db.model('Configs', Configs, 'configs'),
    Cache: db.model('Cache', Cache, 'cache'),
    Metrics: db.model('Metrics', Metrics, 'metrics'),
    Workbook: db.model('Workbook', Workbook, 'workbook'),
};
