const axios = require('axios');
const cheerio = require('cheerio');
const pug = require('pug');

const { Contacts, CleaningGroups, Cache, ContactGroups } = require('./models');
const {
    encrypt,
    decrypt,
    getWeekSpan,
    generateRandomStringSized,
    capitalize,
    getDynamicUrls,
    getWorkbookSkeleton,
    toWorkbookItem,
    sendEmail,
} = require('./helpers');

module.exports = app => {
    app.post('/assignments', async (req, res) => {
        try {
            const { groups = [] } = req.body;
            const { start: dayWeekBegins, end: dayWeekEnds } = getWeekSpan();
            const preview = await Cache.find({ dayWeekBegins }).lean().catch(e => false);
            const subject = `DESIGNAÇÕES DA SEMANA (${dayWeekBegins} - ${dayWeekEnds})`;

            if (!preview || !preview.length) {
                return res.status(400).json({ message: 'Não foi possível enviar as designações' });
            }

            preview.isMobile = false;
            const html = pug.renderFile(__dirname + '/assignments.pug', preview[0]);

            const foundGroups = await ContactGroups.find({
                _id: {
                    $in: groups.map(g => decrypt(g))
                }
            }).lean();

            const foundContacts = await Contacts.find(
                {
                    _id:
                    {
                        $in: foundGroups.reduce((list, cg) => {
                            list = [...list, ...cg.contacts];
                            return list;
                        }, [])
                    }
                },
                { name: 1, address: 1 }
            ).lean();

            const emailList = foundContacts.map(({ name, address }) => ({ name, email: address }));

            const success = process.env.NODE_ENV !== 'PROD'
                ? true
                : await sendEmail(emailList, subject, html);

            if (!success) {
                res.status(400).json({ message: 'Não foi possível enviar as designações' });
            } else {
                res.status(200).json({ message: 'Designações enviadas por email' });
            }
        } catch (error) {
            console.log(error);
            res.status(400).json({ message: 'Não foi possível enviar as designações' });
        }
    });

    app.post('/assignments/preview', async (req, res) => {
        try {
            const { weekend, ministry, week, cleaning } = req.body;
            const contacts = await Contacts.find().lean();
            // parse weekend
            weekend.chairman_1.value = (contacts.find(c => c.address === weekend.chairman_1.value) || { name: '' }).name.toLowerCase();
            weekend.reader_2.value = (contacts.find(c => c.address === weekend.reader_2.value) || { name: '' }).name.toLowerCase();
            // parse cleaning groups
            if (cleaning.cleaning_group_2) {
                const cg = await CleaningGroups.find().lean();
                cleaning.cleaning_group_2.value = (cg.find(c => c.groupId === cleaning.cleaning_group_2.value) || { name: '' }).name.toLowerCase();
            }
            // parse ministry conductors
            for (let m in ministry) {
                ministry[m].text = String(ministry[m].text).toLowerCase();
                ministry[m].value = (contacts.find(c => c.address === ministry[m].value) || { name: '' }).name.toLowerCase();
            }

            const { start: dayWeekBegins, end: dayWeekEnds } = getWeekSpan();
            const previewData = {
                dayWeekBegins,
                dayWeekEnds,
                weekend,
                ministry,
                cleaning,
                loggedUser: 'Guilherme Cerva',
                week: week.reduce((workbook, section) => {

                    if (section.id == 'chairman') {
                        workbook.chairman = (contacts.find(c => c.address === section.value) || { name: '' }).name.toLowerCase();
                    } else {
                        section.items = (section.items || []).map(i => {
                            i.assignee = (contacts.find(c => c.address === i.assignee) || { name: '' }).name.toLowerCase();
                            if (i.hasPair) {
                                i.pair = (contacts.find(c => c.address === i.pair) || { name: '' }).name.toLowerCase();
                            }
                            return i;
                        });

                        workbook[section.id] = section;
                    }

                    return workbook;
                }, {})
            };

            // adjust sizes
            previewData.isMobile = JSON.parse(req.query.isMobile);

            // new preview cache
            const previewCache = { ...previewData };
            delete previewCache.isMobile;

            // clear other previews (async)
            await Cache.deleteMany({ dayWeekBegins: { $nin: [dayWeekBegins] } });

            // store or update cache
            const hasCache = await Cache.find({ dayWeekBegins }).catch(e => false);
            if (!hasCache || !hasCache.length) {
                await Cache.create(previewCache);
            } else {
                const newPreview = hasCache[0];
                newPreview.weekend = previewCache.weekend;
                newPreview.ministry = previewCache.ministry;
                newPreview.cleaning = previewCache.cleaning;
                newPreview.week = previewCache.week;
                newPreview.loggedUser = previewCache.loggedUser;
                newPreview.save();
            }

            const html = pug.renderFile(__dirname + '/assignments.pug', previewData);
            res.status(200).send(html);
        } catch (error) {
            console.log(error);
            res.status(400).json({ message: 'Erro ao gerar designações da semana' });
        }
    });

    app.get('/contacts', async (_, res) => {
        try {
            const contacts = await Contacts.find().lean();
            res.status(200).json(contacts.map(({ _id, name, address }) => ({
                id: encrypt(_id),
                name,
                address
            })));
        } catch (error) {
            console.log(error);
            res.status(400).json({ error: 'Não foi possível obter os contatos' });
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
            newContact.address = address || generateRandomStringSized(10);

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
                return res.status(200).json({ message: 'Contato criado!', contact });
            }

            res.status(200).json({ message: 'Contato já existente!' });
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: 'Não foi possível adicionar o contato' });
        }
    });

    app.delete('/contacts/:id', async (req, res) => {
        try {
            const { id } = req.params;

            if (!id) {
                console.log('No contact was found with id: ', id);
                return res.status(400).json({ error: 'Não foi possível excluir o contato' });
            }

            const deleted = await Contacts.findByIdAndDelete({ _id: decrypt(id) });

            if (deleted) {
                console.log('Deleted contact: ', JSON.stringify(deleted.toJSON(), null, 4));
            }

            res.status(200).json({ message: 'Contato excluído com sucesso!' });
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: 'Não foi possível excluir o contato' });
        }
    });

    app.get('/contact-groups', async (_, res) => {
        try {
            let groups = await ContactGroups.find().lean();
            if (groups.length) {
                groups = groups.map(({ _id, name, contacts }) => ({
                    id: encrypt(_id),
                    name,
                    contacts
                }));
            }
            return res.status(200).json(groups);
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: 'Não foi possível buscar os grupos de contatos' });
        }
    });

    app.post('/contact-groups', async (req, res) => {
        try {
            const { name, contacts } = req.body;

            if (!name || !Array.isArray(contacts) || !contacts.length) {
                return res.status(500).json({ error: !name ? 'Nome não informado' : 'Membros do grupo não informados' });
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
            console.log(error);
            res.status(500).json({ error: 'Não foi possível buscar os grupos de contatos' });
        }
    });

    app.delete('/contact-groups/:id', async (req, res) => {
        try {
            const { id } = req.params;

            if (!id) {
                console.log('No contact group was found with id: ', id);
                return res.status(400).json({ error: 'Não foi possível excluir o grupo de contatos' });
            }

            const deleted = await ContactGroups.findByIdAndDelete({ _id: decrypt(id) });

            if (deleted) {
                console.log('Deleted contact group: ', JSON.stringify(deleted.toJSON(), null, 4));
            }

            res.status(200).json({ message: 'Grupo de contatos excluído com sucesso!' });
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: 'Não foi possível excluir o grupo de contatos' });
        }
    });

    app.get('/cleaning-groups', async (_, res) => {
        try {
            const groups = await CleaningGroups.find().lean();
            res.status(200).json(groups.map(({ name, groupId: id }) => ({ name, id })));
        } catch (error) {
            console.log(error);
            res.status(400).json({ error: 'Não foi possível obter os grupos de limpeza' });
        }
    });

    app.post('/cleaning-groups', async (req, res) => {
        if (!req.body.name) {
            return res.status(400).json({ error: 'Nome do grupo de limpeza não informado!' });
        }
        try {
            await CleaningGroups.create({
                groupId: generateRandomStringSized(15),
                name: req.body.name,
            });
            res.status(200).json({ message: 'Grupo criado com sucesso!' });
        } catch (error) {
            console.log(error);
            res.status(400).json({ error: 'Não foi possível criar o grupo de limpeza' });
        }
    });

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
            console.error(error);
            res.status(500).json({ error: 'Apostila não encontrada!' });
        }
    });

    return app;
};