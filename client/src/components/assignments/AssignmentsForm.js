import React, { useEffect, useCallback, useState } from 'react';
import axios from 'axios';
import clsx from 'clsx';
import { makeStyles, useTheme } from '@material-ui/styles';
import {
    Hidden,
    Paper,
    Box,
    Typography,
    CircularProgress,
    Button
} from '@material-ui/core';

import { useRootContext } from '../RootContext';
import ControlledSelect from '../ControlledSelect';
import PopupModal from '../PopupModal';

export default function AssignmentsForm({ form }) {
    const { store, dispatch } = useRootContext().assignments;
    const { parts, contacts, cleaningGroups, ministryFieldsCache } = store;
    const { ministry, weekend, week, cleaning } = store.assignedParts;

    const [isModalOpen, setModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('Alerta');
    const [modalContent, setModalContent] = useState('Alerta está vazio');
    const [modalOnConfirm, setModalOnConfirm] = useState(null);
    const [customModalProps, setCustomModalProps] = useState({});

    const fetchParts = useCallback(async () => {
        try {
            const { data } = await axios.get(`${process.env.REACT_APP_ROOT}/api/v1/workbook`);
            dispatch({ type: 'SET_PARTS', data });
        } catch {
            openModal({
                title: 'Erro',
                content: <Typography>Não foi possível obter as partes automaticamente!</Typography>
            });
        }
    }, [dispatch]);

    const fetchContacts = useCallback(async () => {
        try {
            const { data } = await axios.get(`${process.env.REACT_APP_ROOT}/api/v1/contacts`);
            if (Array.isArray(data) && data.length) {
                dispatch({
                    type: 'SET_CONTACTS',
                    data: data.map(c => ({ id: c.id, value: c.address, text: c.name }))
                });
            }
        } catch {
            openModal({
                title: 'Erro',
                content: <Typography>Não foi possível obter os contatos!</Typography>
            });
        }
    }, [dispatch]);

    const fetchCleaningGroups = useCallback(async () => {
        try {
            const { data } = await axios.get(`${process.env.REACT_APP_ROOT}/api/v1/cleaning-groups`);
            dispatch({
                type: 'SET_CLEANING_GROUPS',
                data: data.map(group => ({ value: group.id, text: group.name }))
            });
        } catch {
            openModal({
                title: 'Erro',
                content: <Typography>Não foi possível obter os grupos de limpeza!</Typography>
            });
        }
    }, [dispatch]);

    const openModal = ({ title, content, onConfirm, custom = {} }) => {
        setModalTitle(title);
        setModalContent(content);
        setCustomModalProps(custom);
        setModalOnConfirm(() => text => {
            const canClose = onConfirm && onConfirm(text);
            if (!onConfirm || canClose) {
                setModalOpen(false);
            }
        });
        setModalOpen(true);
    };

    const validateFieldDescription = text => {
        const isEmpty = !text || !String(text).replace(/\s+/, '').trim();
        const isDuplicated = Object
            .values(ministryFieldsCache)
            .some(mf => (mf.text).toLowerCase() === String(text).toLowerCase().trim());

        if (!isEmpty && !isDuplicated) {
            createNewMinistryField(text.trim());
            return true;
        } else {
            openModal({
                title: 'Erro',
                content: isDuplicated
                    ? 'Este arranjo já foi informado.'
                    : 'Arranjo de campo não foi informado.'
            });
            setModalOnConfirm(null);
            return false;
        }
    };

    const createNewMinistryField = text => {
        const prefix = 'field_service_conductor_';
        const newId = prefix.concat(
            (Object.keys(ministryFieldsCache).sort().pop() || '0').replace(prefix, '')
            * 1
            + 1
        );
        dispatch({
            type: 'ADD_MINISTRY_FIELD_CACHE',
            data: {
                [newId]: { id: newId, text, value: '' }
            }
        });
    };

    const addMinistryFieldCache = () => {
        openModal({
            title: 'Nova designação',
            onConfirm: modalInputText => validateFieldDescription(modalInputText),
            custom: {
                inputLabel: 'Saída de campo',
                hasInput: true,
            }
        });
    };

    const removeMinistryFieldCache = (id) => {
        dispatch({ type: 'SET_PREVIEW_OUTDATED' });
        dispatch({ type: 'REMOVE_MINISTRY_FIELD_CACHE', data: id });
        dispatch({ type: 'UNASSIGN_FROM_MINISTRY', data: id });
    };

    const TYPE_WEEKEND = 'ASSIGN_TO_WEEKEND';
    const TYPE_WEEK = 'ASSIGN_TO_WEEK';
    const TYPE_CLEANING = 'ASSIGN_TO_CLEANING';
    const TYPE_MINISTRY = 'ASSIGN_TO_MINISTRY';

    const assign = (type, id, data) => {
        dispatch({ type: 'SET_PREVIEW_OUTDATED' });
        dispatch({ type, data: { [id]: data } });
    };

    const weekendMeeting = [
        { description: 'Presidente', label: 'Presidente', id: 'chairman_1' },
        { description: 'Leitor', label: 'Leitor', id: 'reader_2' },
    ];

    const mainCongregation = 'nordeste';
    const selectedCongregation = (cleaning.cleaning_1 || {}).value;

    const congregations = [
        { text: 'Nordeste', value: mainCongregation },
        { text: 'Sarandi', value: 'sarandi' },
        { text: 'Espanhola', value: 'espanhola' },
    ];

    useEffect(() => { !parts.length && fetchParts() }, [parts, fetchParts]);
    useEffect(() => { !contacts.length && fetchContacts() }, [contacts, fetchContacts]);
    useEffect(() => {
        if (!cleaningGroups.length && selectedCongregation === mainCongregation) {
            fetchCleaningGroups();
        }
    }, [cleaningGroups, selectedCongregation, fetchCleaningGroups]);

    const theme = useTheme();
    const classes = makeStyles({
        primaryBackground: {
            backgroundColor: theme.palette.primary.main,
            color: theme.palette.primary.contrastText,
            justifyContent: 'center'
        },
        hoverPrimary: {
            '&.MuiFormControl-root:hover .MuiInputLabel-outlined': {
                color: theme.palette.primary.main
            },
            '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                borderWidth: '2px',
                borderColor: theme.palette.primary.main
            },
        },
        borderPrimary: {
            '& .Mui-disabled, .MuiFormLabel-root': {
                color: theme.palette.primary.main,
                fontStyle: 'italic'
            },
            '& .MuiOutlinedInput-root': {
                '&.Mui-disabled fieldset': {
                    borderColor: theme.palette.primary.main,
                    borderWidth: '2px',
                },
            },
        },
        loadingCenter: {
            marginRight: 'auto',
            marginLeft: 'auto',
        },
        sectionTitle: {
            minHeight: theme.spacing(5),
            alignItems: 'center',
            display: 'flex',
            paddingLeft: theme.spacing(1),
            paddingRight: theme.spacing(1),
            margin: '20px 0px',
            '& span': {
                [theme.breakpoints.up('sm')]: {
                    fontSize: '22px',
                }
            }
        },
        customLi: {
            display: 'grid',
            gridTemplateColumns: '6fr 3fr 3fr',
            gridGap: '10px',
            alignItems: 'flex-start',
            marginTop: theme.spacing(1),
            [theme.breakpoints.down('xs')]: {
                gridTemplateColumns: '1fr',
                marginBottom: theme.spacing(4),
                gridGap: 0,
            },
        },
        listItem: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            height: '100%',
            '& > *': {
                padding: theme.spacing(1),
                marginRight: theme.spacing(1),
                [theme.breakpoints.down('xs')]: {
                    margin: 0,
                    padding: 0,
                    fontSize: theme.spacing(1.8),
                }
            },
        },
        itemBullets: {
            fontSize: theme.spacing(4)
        },
        noBullets: {
            listStyleType: 'none',
            margin: 0,
            padding: 0,
            paddingLeft: theme.spacing(1),
            [theme.breakpoints.down('xs')]: {
                paddingLeft: 0
            }
        },
        spaceBellow: {
            gridColumnStart: 3,
            justifyContent: 'center',
            [theme.breakpoints.down('xs')]: {
                gridColumnStart: 'unset',
                marginTop: theme.spacing(1)
            }
        },
        doubleInput: {
            '& > *': {
                gridColumnStart: 'unset'
            }
        },
        addRow: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            margin: '20px 0',
            [theme.breakpoints.down('xs')]: {
                justifyContent: 'center',
                '& > button': {
                    width: '100%'
                }
            }
        },
        removeRow: {
            margin: 'auto 0 auto auto',
            [theme.breakpoints.down('xs')]: {
                margin: '0 auto'
            }
        },
        chairmanSelect: {
            '& svg': {
                display: 'none'
            }
        }
    })();

    return (
        <>
            <PopupModal
                isOpen={isModalOpen}
                title={modalTitle}
                content={modalContent}
                onConfirm={modalOnConfirm}
                onClose={() => setModalOpen(false)}
                {...customModalProps}
            />

            <Paper elevation={2}>
                <Box m={1} mt={3} p={1} pb={5}>
                    <Box className={clsx(classes.sectionTitle, classes.primaryBackground)}>
                        <Typography variant="button">Domingo</Typography>
                    </Box>

                    <ul className={classes.noBullets}>
                        {weekendMeeting.map(({ id, label, description }) => (
                            <li key={`weekend-meeting-${id}`} className={clsx(classes.customLi)}>
                                <div className={classes.listItem}>
                                    <Hidden xsDown>
                                        <Typography variant="h5" color="primary" className={classes.itemBullets}>•</Typography>
                                    </Hidden>
                                    <Typography variant="body1" color="primary">{description}</Typography>
                                </div>
                                <ControlledSelect
                                    onChange={x => assign(TYPE_WEEKEND, id, {
                                        id,
                                        text: description,
                                        value: x.target.value
                                    })}
                                    id={id}
                                    label={label}
                                    form={form}
                                    cache={weekend}
                                    options={contacts}
                                    classes={clsx(classes.spaceBellow, classes.hoverPrimary)}
                                />
                            </li>
                        ))}
                    </ul>
                </Box>
            </Paper>

            <Paper elevation={2}>
                <Box m={1} mt={3} p={1} pb={5}>
                    <Box className={clsx(classes.sectionTitle, classes.primaryBackground)}>
                        <Typography variant="button">Quinta-feira</Typography>
                    </Box>

                    <ul className={classes.noBullets}>
                        <li className={clsx(classes.customLi)}>
                            <div className={classes.listItem}>
                                <Hidden xsDown>
                                    <Typography variant="h5" color="primary" className={classes.itemBullets}>•</Typography>
                                </Hidden>
                                <Typography variant="body1" color="primary">Presidente</Typography>
                            </div>
                            <ControlledSelect
                                onChange={x => {
                                    const found = contacts.length ? contacts.find(c => c.value === x.target.value) : null;
                                    if (found) {
                                        assign(TYPE_WEEK, 'chairman', {
                                            id: 'chairman',
                                            text: 'Presidente',
                                            value: found.value,
                                            section: 'chairman'
                                        })
                                    }

                                }}
                                id="chairman"
                                label="Presidente"
                                form={form}
                                cache={week}
                                options={contacts}
                                classes={clsx(classes.spaceBellow, classes.hoverPrimary)}
                            />
                        </li>
                    </ul>

                    {parts.map(({ id: sectionId, color, tone: backgroundColor, items, itemsTone, title }, index) =>
                        <Box key={`header-item-${sectionId}-${index}`}>
                            <Box className={classes.sectionTitle} style={{ color, backgroundColor }}>
                                <Typography variant="button">{title}</Typography>
                            </Box>
                            <ul className={classes.noBullets}>
                                {items.map((item, index) =>
                                    <li className={clsx(classes.customLi, item.hasPair && classes.doubleInput)} key={`assignment-item-${index}`}>
                                        <div className={classes.listItem}>
                                            <Hidden xsDown>
                                                <Typography variant="h5" className={classes.itemBullets} style={{ color: itemsTone }}>
                                                    •
                                                </Typography>
                                            </Hidden>
                                            <Typography variant="body1">
                                                {item.text}
                                            </Typography>
                                        </div>
                                        {
                                            item.isAssignable && item.chairmanAssigned &&
                                            <ControlledSelect
                                                onChange={x => assign(TYPE_WEEK, item.id, {
                                                    id: item.id,
                                                    text: item.text,
                                                    value: x.target.value,
                                                    section: sectionId
                                                })}
                                                id="chairman_autoassign"
                                                label="Designação automática"
                                                form={form}
                                                cache={{ 'chairman_autoassign': { ...(week.chairman || { value: 'unset' }) } }}
                                                options={[...contacts, { text: 'Feita pelo presidente', value: 'unset' }]}
                                                classes={clsx(classes.spaceBellow, classes.hoverPrimary, classes.borderPrimary, classes.chairmanSelect)}
                                                disabled={true}
                                            />
                                        }
                                        {
                                            item.isAssignable && !item.chairmanAssigned &&
                                            <ControlledSelect
                                                onChange={x => assign(TYPE_WEEK, item.id, {
                                                    id: item.id,
                                                    text: item.text,
                                                    value: x.target.value,
                                                    section: sectionId
                                                })}
                                                id={item.id}
                                                label={sectionId === 'living' && item.hasPair ? 'Dirigente' : 'Designado'}
                                                form={form}
                                                cache={week}
                                                options={contacts}
                                                classes={clsx(classes.spaceBellow, classes.hoverPrimary)}
                                            />
                                        }
                                        {
                                            item.hasPair &&
                                            <ControlledSelect
                                                onChange={x => assign(TYPE_WEEK, `${item.id}-pair`, {
                                                    id: `${item.id}-pair`,
                                                    text: item.text,
                                                    value: x.target.value,
                                                    section: sectionId
                                                })}
                                                id={`${item.id}-pair`}
                                                label={sectionId === 'living' ? 'Leitor' : 'Ajudante'}
                                                form={form}
                                                cache={week}
                                                options={contacts}
                                                classes={clsx(classes.spaceBellow, classes.hoverPrimary)}
                                            />
                                        }
                                    </li>
                                )}
                            </ul>
                        </Box>
                    )}
                </Box>
            </Paper>

            <Paper elevation={2}>
                <Box m={1} mt={3} p={1} pb={5}>
                    <Box className={clsx(classes.sectionTitle, classes.primaryBackground)}>
                        <Typography variant="button">Arranjo de limpeza</Typography>
                    </Box>

                    <ul className={classes.noBullets}>
                        <li className={clsx(classes.customLi)}>
                            <div className={classes.listItem}>
                                <Hidden xsDown>
                                    <Typography variant="h5" color="primary" className={classes.itemBullets}>•</Typography>
                                </Hidden>
                                <Typography variant="body1" color="primary">Congregação responsável da semana</Typography>
                            </div>
                            <ControlledSelect
                                onChange={({ target: { value } }) => {
                                    assign(TYPE_CLEANING, 'cleaning_1', {
                                        id: 'cleaning_1',
                                        text: 'Congregação responsável da semana',
                                        value
                                    })
                                    if (value !== mainCongregation) {
                                        assign(TYPE_CLEANING, 'cleaning_group_2', { id: 'cleaning_group_2', value: '' })
                                    }
                                }}
                                id="cleaning_1"
                                label="Congregação"
                                form={form}
                                cache={cleaning}
                                options={congregations}
                                classes={clsx(classes.spaceBellow, classes.hoverPrimary)}
                            />
                        </li>
                        {selectedCongregation === mainCongregation && <li className={clsx(classes.customLi)}>
                            <div className={classes.listItem}>
                                <Hidden xsDown>
                                    <Typography variant="h5" color="primary" className={classes.itemBullets}>•</Typography>
                                </Hidden>
                                <Typography variant="body1" color="primary">
                                    {cleaningGroups.length ? 'Grupo responsável pela limpeza' : 'Carregando grupos...'}
                                </Typography>
                            </div>
                            {
                                cleaningGroups.length === 0
                                    ? <CircularProgress size={48} className={clsx(classes.spaceBellow, classes.loadingCenter)} />
                                    : <ControlledSelect
                                        onChange={x => {
                                            assign(TYPE_CLEANING, 'cleaning_group_2', {
                                                id: 'cleaning_group_2',
                                                text: 'Grupo responsável pela limpeza',
                                                value: x.target.value
                                            })
                                        }}
                                        id="cleaning_group_2"
                                        label="Grupo"
                                        form={form}
                                        cache={cleaning}
                                        options={cleaningGroups}
                                        classes={clsx(classes.spaceBellow, classes.hoverPrimary)}
                                    />
                            }
                        </li>}
                    </ul>
                </Box>
            </Paper>

            <Paper elevation={2}>
                <Box m={1} mt={3} p={1} pb={5}>
                    <Box className={clsx(classes.sectionTitle, classes.primaryBackground)}>
                        <Typography variant="button">Dirigentes - Ministério</Typography>
                    </Box>

                    <ul className={classes.noBullets}>
                        <li className={classes.addRow}>
                            <Button variant="outlined" color="primary" onClick={addMinistryFieldCache}>
                                Nova designação
                        </Button>
                        </li>

                        {(ministry.length ? ministry : Object.values(ministryFieldsCache)).map(({ id, text }) => (
                            <li key={`field-service-${id}`} className={clsx(classes.customLi)}>
                                <div className={classes.listItem}>
                                    <Hidden xsDown>
                                        <Typography variant="h5" color="primary" className={classes.itemBullets}>•</Typography>
                                    </Hidden>
                                    <Typography variant="body1" color="primary">{text}</Typography>
                                </div>
                                <Button variant="contained" color="secondary" onClick={() => removeMinistryFieldCache(id)} className={classes.removeRow}>
                                    Remover
                            </Button>
                                <ControlledSelect
                                    onChange={x => assign(TYPE_MINISTRY, id, { id, text, value: x.target.value })}
                                    id={id}
                                    label="Dirigente"
                                    form={form}
                                    cache={ministry}
                                    options={contacts}
                                    classes={clsx(classes.spaceBellow, classes.hoverPrimary)}
                                />
                            </li>
                        ))}
                    </ul>
                </Box>
            </Paper>
        </>
    );
}
