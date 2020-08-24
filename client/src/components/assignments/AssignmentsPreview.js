import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { makeStyles, useTheme } from '@material-ui/styles';
import { Paper, Box, Typography, CircularProgress } from '@material-ui/core';

import { useRootContext } from '../RootContext';
import PopupModal from '../PopupModal';

export default function AssignmentsPreview() {
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setModalOpen] = useState();
    const { store, dispatch } = useRootContext().assignments;
    const { parts, preview, assignedParts: { cleaning, week, weekend, ministry } } = store;
    const theme = useTheme();
    const [isMobile] = useState(window.screen.width <= theme.breakpoints.values.md);

    const fetchPreview = useCallback(async () => {
        const _cleaning = { ...cleaning };

        if (_cleaning.cleaning_group_2 && !_cleaning.cleaning_group_2.value) {
            delete _cleaning.cleaning_group_2;
        }

        const weekAsArray = Object.values(week);

        const _week = weekAsArray.reduce((wp, part) => {
            if (part.id.includes('-pair') || part.section === 'chairman') {
                return wp;
            }

            wp.find(p => part.section === p.id).items.forEach(i => {
                if (!i.isAssignable) return;
                if (i.id !== part.id && !i.chairmanAssigned) return;
                if (i.hasPair) {
                    i.pair = (weekAsArray.find(pair => pair.id === `${i.id}-pair`) || {}).value;
                }
                i.assignee = i.chairmanAssigned ? week.chairman.value : part.value;
            });

            return wp;
        }, [...parts]);

        try {
            setLoading(true);

            const body = {
                weekend: weekend,
                ministry: ministry,
                week: [..._week, week.chairman],
                cleaning: _cleaning
            };

            const query = {
                params: { isMobile }
            };

            const { data } = await axios.post(`${process.env.REACT_APP_ROOT}/api/v1/assignments/preview`, body, query);

            dispatch({ type: 'SET_PREVIEW_CONTENT', data });
        } catch (error) {
            console.error('Preview failed:', error);
        } finally {
            setLoading(false);
        }
    }, [dispatch, cleaning, ministry, parts, week, weekend, isMobile]);

    useEffect(() => {
        if (!preview.html || preview.shouldRefresh) {
            fetchPreview();
        } else {
            setModalOpen(isMobile);
        }
    }, [preview, fetchPreview, isMobile]);

    const classes = makeStyles({
        loadingPreview: {
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            margin: theme.spacing(1),
            marginTop: theme.spacing(3),
            padding: theme.spacing(5),
            paddingBottom: theme.spacing(5),
            '& .MuiCircularProgress-root': {
                marginBottom: '30px'
            }
        },
        preview: {
            [theme.breakpoints.up('sm')]: {
                margin: theme.spacing(2),
                padding: theme.spacing(1),
            }
        }
    })();

    return (
        <Paper>
            <PopupModal
                content={'Seu dispositivo possui uma tela estreita. Vire-o na horizontal para visualizar melhor o conteúdo abaixo!'}
                isOpen={isModalOpen}
                onClose={() => setModalOpen(false)}
                onConfirm={() => setModalOpen(false)}
            />

            {loading && <Box className={classes.loadingPreview}>
                <CircularProgress />
                <Typography color="primary">
                    Carregando exibição...
                </Typography>
            </Box>}

            {!loading && <Box className={classes.preview}>
                <div dangerouslySetInnerHTML={{ __html: preview.html }} />
            </Box>}
        </Paper>
    );
}