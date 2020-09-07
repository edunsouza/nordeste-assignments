import React, { useState } from 'react';
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
    Button
} from '@material-ui/core';

import { requiredFormValidation, submitReactFormHook, emailIfValid } from '../common/utils';
import PopupModal from '../components/PopupModal';
import { useRootContext } from '../components/RootContext';

export default function ParticipantsTab() {
    const { dispatch } = useRootContext().assignments;
    const form = useForm();
    const { errors, setValue, trigger, register } = form;
    const [contactAddress, setContactAddress] = useState('');
    const [isModalOpen, setModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState(false);
    const [modalTitle, setModalTitle] = useState('Aviso');

    const idNameField = 'name';

    const addContact = async () => {
        const formValues = submitReactFormHook(form);

        if (formValues) {
            const contact = {
                name: formValues.name,
                address: emailIfValid(contactAddress)
            }

            try {
                const { data } = await axios.post(`${process.env.REACT_APP_ROOT}/api/v1/contacts`, contact);
                setModalTitle('Sucesso');
                setModalOpen(true);
                setModalContent("Contato adicionado com sucesso!");
                dispatch({ type: 'ADD_CONTACT', data: data.contact });
                setContactAddress('');
                setValue(idNameField, '');
            } catch (error) {
                console.log(error);
                setModalTitle('Erro');
                setModalOpen(true);
                setModalContent(error.error || 'Erro ao adicionar contato');
            }
        }
    }

    const theme = useTheme();
    const classes = makeStyles({
        fullWidth: {
            width: '100%',
        },
        labelFix: {
            left: '15px',
            top: '-5px'
        },
        customGrid: {
            display: 'grid',
            columnGap: '15px',
            gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
            justifyContent: 'center',
            alignItems: 'flex-start',
            margin: theme.spacing(1),
            marginTop: theme.spacing(3),
            padding: theme.spacing(2),
            [theme.breakpoints.down('xs')]: {
                gridTemplateColumns: '1fr',
                gridGap: '10px 0',
                margin: theme.spacing(1),
                marginTop: theme.spacing(1),
                padding: theme.spacing(1),
            }
        },
        fullGrid: {
            [theme.breakpoints.up('sm')]: {
                gridColumn: 'span 5'
            }
        },
        centerGrid: {
            [theme.breakpoints.up('sm')]: {
                gridColumnStart: '2'
            }
        },
        actionButton: {
            paddingTop: '10px',
            [theme.breakpoints.down('xs')]: {
                paddingTop: 0,
                '& button': {
                    width: '100%'
                }
            }
        }
    })();

    return (
        <Paper elevation={1} style={{ minHeight: '200px' }}>
            <PopupModal isOpen={isModalOpen} title={modalTitle} content={modalContent} onClose={() => setModalOpen(false)} confirmOnly={true} />

            <Box p={2} mt={3}>
                <Typography align="center" color="primary" variant="h5">Adicionar novo contato</Typography>
            </Box>

            <Box className={classes.customGrid}>
                <Box className={classes.centerGrid}>
                    <FormControl className={classes.fullWidth} error={Boolean(errors[idNameField])}>
                        <InputLabel className={classes.labelFix}>Nome do contato</InputLabel>
                        <OutlinedInput
                            autoComplete="off"
                            autoFocus={true}
                            defaultValue=""
                            label="Nome do contato"
                            inputRef={ref => {
                                if (ref) {
                                    ref.name = idNameField;
                                    register(ref, requiredFormValidation);
                                }
                            }}
                            onChange={x => {
                                if (setValue && trigger) {
                                    setValue(idNameField, x.target.value);
                                    trigger(idNameField);
                                }
                            }}
                        />
                        <FormHelperText>{errors[idNameField] && errors[idNameField].message}</FormHelperText>
                    </FormControl>
                </Box>

                <Box>
                    <FormControl className={classes.fullWidth}>
                        <InputLabel className={classes.labelFix}>Email do contato</InputLabel>
                        <OutlinedInput label="Email do contato" value={contactAddress} onChange={({ target }) => setContactAddress(target.value)} />
                    </FormControl>
                </Box>

                <Box className={classes.actionButton}>
                    <Button onClick={addContact} color="primary" variant="contained">Adicionar contato</Button>
                </Box>
            </Box>
        </Paper >
    );
}