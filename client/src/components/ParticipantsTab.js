import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { makeStyles, useTheme } from '@material-ui/styles';
import {
    Paper,
    Box,
    Typography,
    FormControl,
    FormHelperText,
    InputLabel,
    OutlinedInput,
    TextField,
    Button,
    Select,
    MenuItem,
    CircularProgress,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Checkbox
} from '@material-ui/core';

import { requiredFormValidation, submitReactFormHook, emailIfValid } from '../common/utils';
import PopupModal from './PopupModal';
import { useRootContext } from './RootContext';

export default function ParticipantsTab() {
    const { store, dispatch } = useRootContext().assignments;
    const form = useForm();
    const { errors, setValue, trigger, register } = form;
    const [isLoadingContacts, setLoadingContacts] = useState(false);
    const [isLoadingGroups, setLoadingGroups] = useState(false);
    const [contactAddress, setContactAddress] = useState('');

    const [isModalOpen, setModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState(false);
    const [modalTitle, setModalTitle] = useState('Aviso');
    const [modalOnConfirm, setModalOnConfirm] = useState(null);

    const addContactFieldId = 'name';
    const [contactToDelete, setContactToDelete] = useState('');
    const [groupToDelete, setGroupToDelete] = useState('');
    const [newContactGroup, setNewContactGroup] = useState([]);
    const [newContactGroupName, setNewContactGroupName] = useState('');

    const getContacts = useCallback(async () => {
        try {
            setLoadingContacts(true);
            const { data } = await axios.get(`${process.env.REACT_APP_ROOT}/api/v1/contacts`);
            if (Array.isArray(data) && data.length) {
                dispatch({
                    type: 'SET_CONTACTS',
                    data: data.map(c => ({ id: c.id, value: c.address, text: c.name }))
                });
            }
            setLoadingContacts(false);
        } catch (error) {
            console.error(error);
            setLoadingContacts(false);
        }
    }, [dispatch]);

    const getGroups = useCallback(async () => {
        try {
            setLoadingGroups(true);
            const { data } = await axios.get(`${process.env.REACT_APP_ROOT}/api/v1/contact-groups`);
            if (Array.isArray(data) && data.length) {
                dispatch({ type: 'SET_CONTACT_GROUPS', data });
            }
            setLoadingGroups(false);
        } catch (error) {
            console.error(error);
            setLoadingGroups(false);
        }
    }, [dispatch]);

    const addContact = async () => {
        const formValues = submitReactFormHook(form);

        if (formValues) {
            const contact = {
                name: formValues.name,
                address: emailIfValid(contactAddress)
            }

            try {
                const { data } = await axios.post(`${process.env.REACT_APP_ROOT}/api/v1/contacts`, contact);
                if (data) {
                    dispatch({ type: 'ADD_CONTACT', data });
                }
                setModalTitle('Sucesso');
                setModalContent("Contato adicionado com sucesso!");
                setModalOpen(true);
                setModalOnConfirm(null);
                setContactAddress('');
                setValue(addContactFieldId, '');
            } catch (error) {
                setModalTitle('Erro');
                setModalOpen(true);
                setModalContent(error.message || 'Erro ao adicionar contato');
            }
        }
    };

    const addGroup = async () => {
        try {
            if (!newContactGroupName || !newContactGroup || !newContactGroup.length) {
                setModalTitle('Erro');
                setModalContent(!newContactGroupName ? 'Informe o nome do novo grupo' : 'Selecione os membros do grupo');
                setModalOnConfirm(null);
                setModalOpen(true);
                return;
            }

            const { data } = await axios.post(`${process.env.REACT_APP_ROOT}/api/v1/contact-groups`, {
                name: newContactGroupName,
                contacts: newContactGroup
            });

            dispatch({ type: 'ADD_CONTACT_GROUP', data });
            setModalTitle('Criar grupo');
            setModalContent((<Typography>Grupo <b>{newContactGroupName}</b> criado com sucesso!</Typography>));
            setModalOnConfirm(null);
            setModalOpen(true);
        } catch (error) {
            setModalTitle('Erro');
            setModalContent(error.message || 'Erro ao criar grupo');
            setModalOnConfirm(null);
            setModalOpen(true);
        }
    };

    const deleteContact = async toDelete => {
        try {
            setModalContent('Excluindo contato...');
            await axios.delete(`${process.env.REACT_APP_ROOT}/api/v1/contacts/${toDelete}`);
            setNewContactGroup(newContactGroup.filter(ncg => ncg !== toDelete));
            setModalContent('Contato excluído com sucesso!');
            setModalTitle('Sucesso');
            setModalOnConfirm(null);
            dispatch({ type: 'REMOVE_CONTACT', data: toDelete });
        } catch (error) {
            setModalContent('Não foi possível excluir este contato. Tente novamente.');
            setModalTitle('Erro');
            setModalOnConfirm(null);
        }
    };

    const deleteGroup = async toDelete => {
        try {
            setModalContent('Excluindo grupo...');
            await axios.delete(`${process.env.REACT_APP_ROOT}/api/v1/contact-groups/${toDelete}`);
            setModalContent('Grupo excluído com sucesso!');
            setModalTitle('Sucesso');
            setModalOnConfirm(null);
            dispatch({ type: 'REMOVE_CONTACT_GROUP', data: toDelete });
        } catch (error) {
            setModalContent('Não foi possível excluir este grupo. Tente novamente.');
            setModalTitle('Erro');
            setModalOnConfirm(null);
        }
    };

    const onDeleteContact = () => {
        setModalTitle('Erro');
        setModalOpen(true);
        let modalMessage = 'Selecione um contato';
        const contactFound = contactToDelete && store.contacts.find(({ value: id }) => id === contactToDelete);
        if (contactFound) {
            modalMessage = (<Typography>Tem certeza que deseja excluir o contato <b>{contactFound.text}</b>?</Typography>);
            setModalTitle('Excluir contato');
            setModalOnConfirm(() => () => deleteContact(contactFound.id));
        }
        setModalContent(modalMessage);
    };

    const onDeleteGroup = () => {
        setModalTitle('Erro');
        setModalOpen(true);
        let modalMessage = 'Selecione um grupo de contatos';
        const groupFound = groupToDelete && store.contactGroups.find(c => c.id === groupToDelete);
        if (groupFound) {
            modalMessage = (<Typography>Tem certeza que deseja excluir o grupo <b>{groupFound.name}</b>?</Typography>);
            setModalTitle('Excluir grupo de contatos');
            setModalOnConfirm(() => () => deleteGroup(groupFound.id));
        }
        setModalContent(modalMessage);
    };

    const onCheckContact = contact => {
        if (!contact || !contact.id) {
            return;
        }
        setNewContactGroup(group => group.includes(contact.id)
            ? group.filter(id => id !== contact.id)
            : [...group, contact.id]
        );
    };

    const closeModal = () => setModalOpen(false);

    useEffect(() => {
        if (!store.contacts.length) {
            getContacts();
        }
    }, [store.contacts, getContacts]);

    useEffect(() => {
        if (!store.contactGroups.length) {
            getGroups();
        }
    }, [store.contactGroups, getGroups]);

    const theme = useTheme();
    const classes = makeStyles({
        fullWidth: {
            width: '100%',
        },
        labelFix: {
            left: '15px',
            top: '-5px'
        },
        cardSpacing: {
            marginBottom: theme.spacing(3),
            '& > div:first-child': {
                padding: theme.spacing(2)
            }
        },
        customGrid: {
            display: 'flex',
            justifyContent: 'center',
            padding: theme.spacing(2),
            paddingBottom: theme.spacing(3),
            '& > div': {
                paddingRight: theme.spacing(2)
            },
            [theme.breakpoints.down('xs')]: {
                flexDirection: 'column',
                '& > div': {
                    paddingBottom: theme.spacing(1),
                    paddingRight: 0
                }
            },
        },
        actionButton: {
            paddingTop: theme.spacing(1),
            [theme.breakpoints.down('xs')]: {
                paddingTop: 0,
                '& button': {
                    width: '100%'
                }
            }
        },
        singleInputForm: {
            width: '30%',
            [theme.breakpoints.down('xs')]: {
                width: '100%',
            }
        },
        checkList: {
            '& > .MuiList-root': {
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                margin: 'auto 10%',
                maxHeight: '200px',
                overflowY: 'scroll',
                overflowX: 'hidden',
                border: `1px solid ${theme.palette.secondary.main}`,
                borderRadius: '4px',
                '&::-webkit-scrollbar': {
                    borderTopRightRadius: '4px',
                    borderBottomRightRadius: '4px',
                    width: '15px'
                },
                '&::-webkit-scrollbar-track': {
                    borderTopRightRadius: '4px',
                    borderBottomRightRadius: '4px',
                    backgroundColor: theme.palette.secondary.light,
                },
                '&::-webkit-scrollbar-thumb': {
                    borderTopRightRadius: '4px',
                    borderBottomRightRadius: '4px',
                    backgroundColor: theme.palette.primary.main,
                }
            }
        },
        actionsRow: {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: theme.spacing(2),
            '& > *': {
                marginLeft: theme.spacing(2)
            },
            '&> .MuiFormControl-root': {
                width: '30%'
            }
        },
        spinner: {
            padding: theme.spacing(2),
            position: 'relative',
            left: 'calc(50% - 24px)'
        },
    })();

    return (
        <>
            <PopupModal
                isOpen={isModalOpen}
                title={modalTitle}
                content={modalContent}
                onClose={closeModal}
                onConfirm={modalOnConfirm}
            />

            <Paper className={classes.cardSpacing} elevation={1}>
                <Box>
                    <Typography align="center" color="primary" variant="h5">Adicionar contato</Typography>
                </Box>
                <Box className={classes.customGrid}>
                    <Box>
                        <FormControl className={classes.fullWidth} error={Boolean(errors[addContactFieldId])}>
                            <InputLabel className={classes.labelFix}>Nome do contato</InputLabel>
                            <OutlinedInput
                                autoComplete="off"
                                defaultValue=""
                                label="Nome do contato"
                                inputRef={ref => {
                                    if (ref) {
                                        ref.name = addContactFieldId;
                                        register(ref, requiredFormValidation);
                                    }
                                }}
                                onChange={x => {
                                    if (setValue && trigger) {
                                        setValue(addContactFieldId, x.target.value);
                                        trigger(addContactFieldId);
                                    }
                                }}
                            />
                            <FormHelperText>{errors[addContactFieldId] && errors[addContactFieldId].message}</FormHelperText>
                        </FormControl>
                    </Box>
                    <Box>
                        <FormControl className={classes.fullWidth}>
                            <InputLabel className={classes.labelFix}>Email do contato</InputLabel>
                            <OutlinedInput value={contactAddress} label="Email do contato" onChange={({ target }) => setContactAddress(target.value)} />
                        </FormControl>
                    </Box>
                    <Box className={classes.actionButton}>
                        <Button onClick={addContact} color="primary" variant="contained">Adicionar</Button>
                    </Box>
                </Box>
            </Paper>

            <Paper className={classes.cardSpacing} elevation={1}>
                <Box>
                    <Typography align="center" color="primary" variant="h5">Excluir contato</Typography>
                </Box>
                {isLoadingContacts
                    ? <CircularProgress size={48} className={classes.spinner} />
                    : <Box className={classes.customGrid}>
                        <FormControl className={classes.singleInputForm} variant="outlined">
                            <InputLabel id="remove-contact">Contato</InputLabel>
                            <Select value={contactToDelete} onChange={x => setContactToDelete(x.target.value)} input={<OutlinedInput label="Contato" />}>
                                {store.contacts.map(({ value, text }, index) => (
                                    <MenuItem key={`option-${index}`} value={value}>{text}</MenuItem>)
                                )}
                            </Select>
                        </FormControl>
                        <Box className={classes.actionButton}>
                            <Button onClick={onDeleteContact} color="primary" variant="contained">Excluir</Button>
                        </Box>
                    </Box>}
            </Paper>

            <Paper className={classes.cardSpacing} elevation={1}>
                <Box>
                    <Typography align="center" color="primary" variant="h5">Criar grupo de contatos</Typography>
                    <Typography align="center" color="textSecondary" variant="subtitle1">
                        Marque os contatos que deseja e depois selecione CRIAR GRUPO.
                    </Typography>
                </Box>
                {isLoadingGroups
                    ? <CircularProgress size={48} className={classes.spinner} />
                    : <Box pb={4}>
                        <Box className={classes.actionsRow}>
                            <Button color="secondary" variant="contained" onClick={() => setNewContactGroup([])}>Desmarcar todos</Button>
                            <TextField label="Nome do grupo" defaultValue={newContactGroupName} variant="outlined" onBlur={({ target }) => setNewContactGroupName(target.value)} />
                            <Button color="primary" variant="contained" onClick={addGroup}>Criar Grupo</Button>
                        </Box>
                        <Box className={classes.checkList}>
                            <List>
                                {store.contacts.map((contact, index) => {
                                    const label = contact.value.includes('@') ? `(${contact.value})` : '* SEM E-MAIL';
                                    return <ListItem key={`list-item-${index}`} button onClick={() => onCheckContact(contact)}>
                                        <ListItemIcon>
                                            <Checkbox checked={newContactGroup.includes(contact.id)} color="primary" />
                                        </ListItemIcon>
                                        <ListItemText primary={`${contact.text} ${label}`} />
                                    </ListItem>;
                                })}
                            </List>
                        </Box>
                    </Box>}
            </Paper>

            <Paper className={classes.cardSpacing} elevation={1}>
                <Box>
                    <Typography align="center" color="primary" variant="h5">Excluir grupo de contatos</Typography>
                </Box>
                {isLoadingGroups
                    ? <CircularProgress size={48} className={classes.spinner} />
                    : <Box>
                        <Box className={classes.actionsRow}>
                            <FormControl className={classes.singleInputForm} variant="outlined">
                                <InputLabel id="remove-contact">Grupo</InputLabel>
                                <Select value={groupToDelete} onChange={x => setGroupToDelete(x.target.value)} input={<OutlinedInput label="Grupo" />}>
                                    {(store.contactGroups.length ? store.contactGroups : [{ name: 'Lista vazia' }]).map(({ name, id }, index) => (
                                        <MenuItem key={`group-option-${index}`} value={id}>{name}</MenuItem>)
                                    )}
                                </Select>
                            </FormControl>
                            <Button color="primary" variant="contained" onClick={onDeleteGroup}>Excluir Grupo</Button>
                        </Box>
                    </Box>}
            </Paper>
        </>
    );
}