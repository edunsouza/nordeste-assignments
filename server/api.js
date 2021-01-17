const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const pug = require('pug');
const { get, set } = require('lodash');

const { Contacts, CleaningGroups, Cache, ContactGroups, Metrics } = require('./models');
const {
    encrypt,
    decrypt,
    sendEmail,
    random,
    capitalize,
    getProperText,
    getWeekSpan,
    getDynamicUrls,
    getWorkbookSkeleton,
    toWorkbookItem,
} = require('./helpers');

module.exports = app => {
    app.get('/meeting-workbook', async (_, res) => {
        try {
            const [workbookUrl, fallback] = getDynamicUrls();
            const { data } = await axios.get(workbookUrl).catch(async () => await axios.get(fallback));
            const $ = cheerio.load(data);
            let sectionPosition = 1;
            const meetingWorkbook = getWorkbookSkeleton().map(section => {
                section.title = section.getTitle($);
                section.position = sectionPosition++;
                let itemPosition = 0;

                $(section.itemsSelector).remove('.noMarker').each((_, e) => {
                    const fullText = $(e).text();
                    const item = toWorkbookItem(fullText.replace(/\n/g, '').trim());

                    item.isAssignable = section.isAssignable(item.text);
                    item.chairmanAssigned = section.chairmanAssigned(fullText);
                    item.id += `_${++itemPosition}`;
                    item.position = itemPosition;
                    section.items.push(item);
                });

                delete section.itemsSelector;
                return section;
            });

            res.status(200).json(meetingWorkbook);
        } catch (error) {
            console.error(JSON.stringify(error, null, 4));
            res.status(500).json({ error: 'Apostila não encontrada!' });
        }
    });

    app.post('/attendance', async (req, res) => {
        try {
            const { id, attendance } = req.body;

            if (!id || !attendance) {
                return res.status(400).json({ message: 'Métricas não informadas' });
            }

            await Metrics.create({
                name: `meeting-attendance-${getProperText(id)}`,
                value: attendance,
                reference: new Date().toISOString(),
            });

            res.status(200).json({ message: `Assistência de ${attendance} registrada com sucesso` });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Não foi possível enviar as designações' });
        }
    });

    app.post('/assignments', async (req, res) => {
        try {
            const { groups = [] } = req.body;

            if (!Array.isArray(groups) || !groups.length) {
                return res.status(400).json({ message: 'Grupos não informados' });
            }

            const { dayWeekBegins, dayWeekEnds } = getWeekSpan();
            const emailSubject = `DESIGNAÇÕES DA SEMANA (${dayWeekBegins} - ${dayWeekEnds})`;

            const preview = await Cache.findOne({ dayWeekBegins }).lean();
            const emailBody = pug.renderFile(
                path.join(__dirname, 'assignments.pug'),
                {
                    ...preview,
                    isMobile: false
                }
            );

            const $in = (await ContactGroups
                .find({ _id: { $in: groups.map(g => decrypt(g)) } })
                .lean()
            ).reduce((list, cg) => [...list, ...cg.contacts], []);

            const emailList = (await Contacts
                .find({ _id: { $in } }, { name: 1, address: 1 })
                .lean()
            ).map(e => ({
                name: e.name,
                email: e.address
            }));

            const success = process.env.NODE_ENV !== 'PROD'
                ? true
                : await sendEmail(emailList, emailSubject, emailBody);

            if (!success) {
                res.status(500).json({ message: 'Não foi possível enviar as designações' });
            } else {
                res.status(200).json({ message: 'Designações enviadas por email' });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Não foi possível enviar as designações' });
        }
    });

    app.post('/assignments/preview', async (req, res) => {
        try {
            const { weekend = {}, ministry = {}, week: weekArray = [], cleaning = {} } = req.body;

            const contacts = await Contacts.find().lean();

            const ministryFields = Object.keys(ministry || {});
            const week = {};

            // from - to
            contacts.forEach(({ address, name }) => {
                name = name.toLowerCase();

                // weekend chairman
                if (address === get(weekend, 'chairman_1.value')) {
                    set(weekend, 'chairman_1.value', name);
                }

                // weekend reader
                if (address === get(weekend, 'reader_2.value')) {
                    set(weekend, 'reader_2.value', name);
                }

                // week assignments
                weekArray.forEach(section => {
                    if (address === section.value && section.id === 'chairman') {
                        week.chairman = name;
                    } else {
                        get(section, 'items', []).forEach(it => {
                            if (address === it.assignee) {
                                it.assignee = name;
                            }

                            if (address === it.pair) {
                                it.pair = name;
                            }
                        });

                        if (section.id !== 'chairman') {
                            week[section.id] = section;
                        }
                    }
                });

                // ministry conductors
                ministryFields.forEach(m => {
                    if (address === ministry[m].value) {
                        ministry[m].text = ministry[m].text.toLowerCase();
                        ministry[m].value = name;
                    }
                });
            });

            // parse cleaning groups
            if (cleaning.cleaning_group_2) {
                const group = await CleaningGroups.findOne({ groupId: cleaning.cleaning_group_2.value }).lean();
                cleaning.cleaning_group_2.value = group.name;
            }

            const { dayWeekBegins, dayWeekEnds } = getWeekSpan();
            const currentCache = await Cache.findOne({ dayWeekBegins }).catch(console.error);
            const previewData = {
                dayWeekBegins,
                dayWeekEnds,
                week,
                weekend,
                ministry,
                cleaning,
                loggedUser: 'Guilherme Cerva',
                isMobile: JSON.parse(req.query.isMobile)
            };

            // create or update preview cache
            if (!currentCache) {
                await Cache.create(previewData);
            } else {
                currentCache.weekend = previewData.weekend;
                currentCache.ministry = previewData.ministry;
                currentCache.cleaning = previewData.cleaning;
                currentCache.week = previewData.week;
                currentCache.loggedUser = previewData.loggedUser;

                await currentCache.save();
            }

            // clear other previews
            await Cache.deleteMany({ dayWeekBegins: { $nin: [dayWeekBegins] } });

            const html = pug.renderFile(__dirname + '/assignments.pug', previewData);

            res.status(200).send(html);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Erro ao gerar designações da semana' });
        }
    });

    app.get('/contacts', async (_, res) => {
        try {
            const contactList = await Contacts.find().lean();

            const contacts = contactList.map(({ _id, name, address }) => ({
                id: encrypt(_id),
                name,
                address
            }))

            res.status(200).json(contacts);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Não foi possível obter os contatos' });
        }
    });

    app.post('/contacts', async (req, res) => {
        try {
            const { name, address } = req.body;

            if (!name) {
                return res.status(400).json({ error: 'Não é possível criar contatos sem nome' });
            }

            const newContact = new Contacts();
            newContact.name = capitalize(name);
            newContact.address = address || random(10);

            const duplicates = await Contacts.find({
                $or: [
                    { name: newContact.name },
                    { address: newContact.address }
                ]
            });

            if (!duplicates.length) {
                await newContact.save();

                const contact = newContact.toJSON();
                contact.id = encrypt(contact._id);
                delete contact._id;

                return res.status(200).json(contact);
            }

            res.status(400).json({ message: 'Contato já existente!' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Não foi possível adicionar o contato' });
        }
    });

    app.delete('/contacts/:id', async (req, res) => {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({ error: 'Contato não informado' });
            }

            const deleted = await Contacts.findByIdAndDelete({ _id: decrypt(id) });

            if (deleted) {
                console.log('Deleted contact: ', JSON.stringify(deleted.toJSON(), null, 4));
            }

            res.status(200).json({ message: 'Contato excluído com sucesso!' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Não foi possível excluir o contato' });
        }
    });

    app.get('/contact-groups', async (_, res) => {
        try {
            const contactGroups = await ContactGroups.find().lean();

            const groups = contactGroups.map(({ _id, name, contacts }) => ({
                id: encrypt(_id),
                name,
                contacts
            }));

            res.status(200).json(groups);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Não foi possível buscar os grupos de contatos' });
        }
    });

    app.post('/contact-groups', async (req, res) => {
        try {
            const { name, contacts } = req.body;

            if (!name) {
                return res.status(400).json({ error: 'Nome não informado' });
            }

            if (!Array.isArray(contacts) || !contacts.length) {
                return res.status(400).json({ error: 'Membros do grupo não informados' });
            }

            const newGroup = new ContactGroups();
            newGroup.name = name;
            newGroup.contacts = contacts.map(cid => decrypt(cid));
            await newGroup.save();

            const group = newGroup.toJSON();
            group.contacts = group.contacts.map(cid => encrypt(cid));
            group.id = encrypt(group._id);
            delete group._id;

            return res.status(200).json(group);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Não foi possível buscar os grupos de contatos' });
        }
    });

    app.delete('/contact-groups/:id', async (req, res) => {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({ error: 'Grupo de contatos não informado' });
            }

            const deleted = await ContactGroups.findByIdAndDelete({ _id: decrypt(id) });

            if (deleted) {
                console.log('Deleted contact group: ', JSON.stringify(deleted.toJSON(), null, 4));
            }

            res.status(200).json({ message: 'Grupo de contatos excluído com sucesso!' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Não foi possível excluir o grupo de contatos' });
        }
    });

    app.get('/cleaning-groups', async (_, res) => {
        try {
            const cleaningGroups = await CleaningGroups.find().lean();

            const groups = cleaningGroups.map(({ name, groupId: id }) => ({
                id,
                name
            }));

            res.status(200).json(groups);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Não foi possível obter os grupos de limpeza' });
        }
    });

    app.post('/cleaning-groups', async (req, res) => {
        try {
            if (!req.body.name) {
                return res.status(400).json({ error: 'Nome do grupo de limpeza não informado!' });
            }

            await CleaningGroups.create({
                groupId: random(15),
                name: req.body.name,
            });

            res.status(200).json({ message: 'Grupo criado com sucesso!' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Não foi possível criar o grupo de limpeza' });
        }
    });

    return app;
};