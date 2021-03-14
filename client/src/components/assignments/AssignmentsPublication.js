import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    Paper,
    Box,
    Typography,
    FormControlLabel,
    Checkbox,
    ListItemIcon,
    ListItem,
    List
} from '@material-ui/core';
import { makeStyles, useTheme } from '@material-ui/styles';

import { useRootContext } from '../RootContext';
import FabLoadingProgress from '../FabLoadingProgress';
import PopupModal from '../PopupModal';

export default function AssignmentsPublication() {
    const { store, dispatch } = useRootContext().assignments;
    const { contactGroups } = store;
    const [success, setSuccess] = useState(false);
    const [modalMessage, setModalMessage] = useState(false);
    const [modalCallback, setModalCallback] = useState(Function);
    const [loading, setLoading] = useState(false);
    const [loadingGroups, setLoadingGroups] = useState(false);
    const [checkboxes, setCheckbox] = useState([]);

    // ---- BASIC ACTIONS

    const handleLogin = async () => {
        const { data: { redirectUrl } } = await axios.get(`${process.env.REACT_APP_ROOT}/auth`);

        if (redirectUrl) {
            setModalMessage(<>
                <Typography variant="button" color="primary">Login necessário!</Typography>
                <Typography variant="body1">
                    Uma nova janela será aberta.
                    Realize o login com sua conta do Google e tente enviar as designações novamente.
                </Typography>
            </>);

            setModalCallback(() => function () {
                window.open(redirectUrl);
            });
        } else {
            setModalCallback(() => Function);
            send();
        }
    };

    const send = async () => {
        try {
            setLoading(true);

            const { data } = await axios.post(`${process.env.REACT_APP_ROOT}/api/v1/assignments`, { groups: checkboxes });

            setLoading(false);

            if (!data) {
                return setModalMessage(
                    <Typography variant="button" color="primary">Erro desconhecido. Designações não enviadas!</Typography>
                );
            }

            setSuccess(true);
            dispatch({ type: 'SET_EMAIL_SENT', data: true });
            setModalMessage(<>
                <Typography variant="button" color="primary">Email enviado para o(s) grupo(s):</Typography>
                {checkboxes.map(groupdId => {
                    const { id, name } = contactGroups.find(cg => cg.id === groupdId) || {};
                    return (<Typography variant="body1" key={id}>{name}</Typography>);
                })}
            </>);
        } catch (error) {
            setLoading(false);
            setSuccess(false);
        }
    };

    const onModalClose = () => {
        setModalMessage(false);
        modalCallback();
    };

    // ---- EFFECTS

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

    useEffect(() => {
        if (!contactGroups || !contactGroups.length) {
            getGroups();
        }
    }, [contactGroups, getGroups]);

    // login handler
    useEffect(() => {
        const onMessage = message => {
            if (new URL(message.origin).hostname === document.location.hostname && message.data.source === 'auth_callback') {
                setModalMessage(false);
                setLoading(false);
            }
        };
        window.addEventListener('message', onMessage);
        return () => {
            window.removeEventListener('message', onMessage);
        }
    });

    // ---- UI

    const theme = useTheme();
    const classes = makeStyles({
        groupsBox: {
            margin: theme.spacing(1),
            marginTop: theme.spacing(3),
            padding: theme.spacing(1),
            paddingBottom: theme.spacing(5),
            paddingTop: theme.spacing(5),
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column',
        },
        checkboxLabel: {
            '& .MuiTypography-root': {
                [theme.breakpoints.down('sm')]: {
                    'maxWidth': '200px',
                    'wordBreak': 'break-word',
                }
            }
        }
    })();

    return (
        <Paper elevation={2}>
            <PopupModal
                isOpen={Boolean(modalMessage)}
                content={modalMessage}
                confirmOnly={true}
                onClose={onModalClose}
                onConfirm={onModalClose}
            />

            <Box className={classes.groupsBox}>
                <Typography color="primary" variant="h6">Selecione o grupo de contatos para enviar o email:</Typography>
                <List>
                    {!loadingGroups && contactGroups.length > 0 && contactGroups.map(({ id, name, contacts }, index) => (
                        <ListItem key={`${id}-${index}`} dense>
                            <ListItemIcon>
                                <FormControlLabel
                                    className={classes.checkboxLabel}
                                    control={<Checkbox color="primary" name={id} />}
                                    label={`${name} (${contacts.length} membros)`}
                                    onChange={e => {
                                        if (e.target.checked) {
                                            setCheckbox([...checkboxes, id]);
                                        }
                                    }}
                                />
                            </ListItemIcon>
                        </ListItem>
                    ))}
                </List>
                <FabLoadingProgress success={success} loading={loading} onClick={handleLogin} />
            </Box>
        </Paper >
    );
}