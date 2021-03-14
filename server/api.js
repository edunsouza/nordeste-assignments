const path = require('path');
const pug = require('pug');
const { get, set } = require('lodash');

const { Cache, Contacts, CleaningGroups, ContactGroups, Metrics, Workbook } = require('./models');
const { encrypt, decrypt, random, capitalize, getProperText } = require('./utils');
const { getWeekSpan, scrapeWorkbook, sendEmail, sendGmail, getGoogleAuth, getSession, clearSession } = require('./helpers');

const findOrScrape = async (skippable, date) => {
    try {
        const { dayWeekBegins, dayWeekEnds } = getWeekSpan(true, date);
        const week = `${dayWeekBegins}-${dayWeekEnds}`;
        const success = true;

        let workbook = await Workbook.findOne({ week }, { _id: 0, __v: 0 }).lean();

        if (workbook) {
            return { success, workbook };
        }

        const sections = await scrapeWorkbook({ skippable, date });

        if (!sections) {
            return {
                success: false,
                error: `workbook not found for week ${week}`
            };
        }

        const wb = new Workbook({ week, sections });
        await wb.save();

        workbook = wb.toJSON();
        delete workbook._id;
        delete workbook.__v;

        return { success, workbook };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports = router => {
    router.get('/workbook/:date', async (req, res) => {
        try {
            const { success, workbook, error } = await findOrScrape(false, req.params.date);
            if (success) {
                res.status(200).json({ workbook });
            } else {
                res.status(400).json({ error });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: error.message || error });
        }
    });

    router.get('/workbook', async (req, res) => {
        try {
            const { success, workbook, error } = await findOrScrape(true, req.params.date);
            if (success) {
                res.status(200).json(workbook.sections);
            } else {
                res.status(400).json({ error });
            }
        } catch (error) {
            console.log(error)
            console.error(JSON.stringify(error, null, 4));
            res.status(500).json({ error: 'Apostila não encontrada!' });
        }
    });

    router.post('/assignments', async (req, res) => {
        try {
            const { sessionId } = req.cookies;
            const { groups = [] } = req.body;

            if (!Array.isArray(groups) || !groups.length) {
                return res.status(400).json({ message: 'Grupos não informados' });
            }

            const groupsIn = { $in: groups.map(decrypt) };
            const groupList = await ContactGroups.find({ _id: groupsIn }).lean();

            const contactsIn = { $in: groupList.reduce((list, { contacts }) => [...list, ...contacts], []) };
            const contactList = await Contacts.find({ _id: contactsIn }, { name: 1, address: 1 }).lean();

            const { dayWeekBegins, dayWeekEnds } = getWeekSpan();
            const templatePath = path.join(__dirname, 'assignments.pug');
            const preview = await Cache.findOne({ dayWeekBegins }).lean();

            const to = contactList.map(t => t.address);
            const subject = `DESIGNAÇÕES DA SEMANA (${dayWeekBegins} - ${dayWeekEnds})`;
            const content = pug.renderFile(templatePath, { ...preview, isMobile: false });

            const auth = await getGoogleAuth();
            const session = await getSession(sessionId);
            auth.setCredentials(session);

            if (!session || !auth) {
                return res.status(500).json({ message: 'Sessão inválida! Designações não enviadas' });
            }

            // send
            const success = await sendGmail(auth, to, subject, content).catch(async err => {
                if (get(err, 'response.data.error') === 'invalid_grant') {
                    console.log('session must be expired. Clearing old credentials');
                    await clearSession(sessionId);
                    return false;
                }

                // fallback
                console.log('using alternative emailing service. Gmail failed with:', err);
                return await sendEmail(to, subject, content);
            });

            if (!success) {
                res.status(500).json({ message: 'Não foi possível enviar as designações. Tente novamente' });
            } else {
                res.status(200).json({ message: 'Designações enviadas por email' });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Não foi possível enviar as designações' });
        }
    });

    router.post('/assignments/preview', async (req, res) => {
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

            const templatePath = path.join(__dirname, 'assignments.pug');
            const html = pug.renderFile(templatePath, previewData);

            res.status(200).send(html);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Erro ao gerar designações da semana' });
        }
    });

    router.post('/attendance', async (req, res) => {
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

    router.get('/contacts', async (_, res) => {
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

    router.post('/contacts', async (req, res) => {
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

    router.delete('/contacts/:id', async (req, res) => {
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

    router.get('/contact-groups', async (_, res) => {
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

    router.post('/contact-groups', async (req, res) => {
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

    router.delete('/contact-groups/:id', async (req, res) => {
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

    router.get('/cleaning-groups', async (_, res) => {
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

    router.post('/cleaning-groups', async (req, res) => {
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

    return router;
};