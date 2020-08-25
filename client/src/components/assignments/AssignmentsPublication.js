import React, { useState } from 'react';
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

import { useRootContext } from '../RootContext';
import FabLoadingProgress from '../FabLoadingProgress';
import PopupModal from '../PopupModal';

export default function AssignmentsPublication() {
    const { store, dispatch } = useRootContext().assignments;
    const { contacts } = store;
    const [success, setSuccess] = useState(false);
    const [modalMessage, setModalMessage] = useState(false);
    const [loading, setLoading] = useState(false);
    const [checkboxes, setCheckbox] = useState({});

    const send = async () => {
        try {
            setLoading(true);
            const emailsList = Object.keys(checkboxes).filter(k => checkboxes[k]).map(t => {
                const foundContact = contacts.find(c => c.value === t);
                return {
                    email: foundContact.value,
                    name: foundContact.text,
                }
            });
            const { data } = await axios.post(`${process.env.REACT_APP_ROOT}/api/v1/assignments`, { to: emailsList });

            if (data) {
                setSuccess(true);
                setLoading(false);
                dispatch({ type: 'SET_EMAIL_SENT', data: true });
                setModalMessage(<>
                    <Typography variant="button" color="primary">Email enviado para:</Typography>
                    {Object.keys(checkboxes).filter(k => checkboxes[k]).map(contact => (
                        <Typography variant="body1" key={contact}>
                            {contact}
                        </Typography>
                    ))}
                </>);
            }
        } catch (error) {
            setSuccess(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Paper elevation={2}>
            <PopupModal
                isOpen={Boolean(modalMessage)}
                content={modalMessage}
                confirmOnly={true}
                onClose={() => setModalMessage(false)}
                onConfirm={() => setModalMessage(false)}
            />

            <Box m={1} mt={3} p={1} pb={5} display="flex" justifyContent="center" alignItems="center" flexDirection="column">
                <Typography variant="subtitle1">Selecione os contatos que deseja incluir no email:</Typography>
                <List>
                    {contacts && contacts.map(({ text: name, value: address }, index) => (
                        <ListItem key={`${address}-${index}`} dense>
                            <ListItemIcon>
                                <FormControlLabel
                                    control={<Checkbox color="primary" name={address} />}
                                    label={`${name} (${address})`}
                                    onChange={e => setCheckbox({ ...checkboxes, [address]: e.target.checked })}
                                />
                            </ListItemIcon>
                        </ListItem>
                    ))}
                </List>
                <FabLoadingProgress success={success} loading={loading} onClick={send} />
            </Box>
        </Paper >
    );
}