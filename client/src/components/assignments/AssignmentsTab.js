import React, { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { makeStyles } from '@material-ui/styles';
import { Navigation as NavigationIcon } from '@material-ui/icons';
import { Box, Fab } from '@material-ui/core';

import AssignmentsForm from './AssignmentsForm';
import AssignmentsPreview from './AssignmentsPreview';
import AssignmentsPublication from './AssignmentsPublication';

import { submitReactFormHook, scrollToElement } from '../../common/utils';

import StepByStep from '../StepByStep';

export default function AssignmentsTab() {
    const pageTop = useRef();
    const form = useForm();

    const steps = [
        {
            callback: () => {
                return submitReactFormHook(form);
            },
            label: 'Preencher designados',
            hint: 'Informe os designados desta semana e siga para visualização',
            content: (<AssignmentsForm form={form} />)
        },
        {
            callback: () => true,
            label: 'Visualizar mensagem',
            hint: 'Confira se está tudo certo antes de enviar as designações',
            content: (<AssignmentsPreview />)
        },
        {
            callback: () => console.log('===================== Enviar ====================='),
            label: 'Enviar designações',
            hint: 'Se está tudo certo, selecione o botão com ícone de envelope para enviar',
            content: (<AssignmentsPublication />)
        },
    ];

    const classes = makeStyles({
        goTopFab: {
            display: 'flex',
            margin: '30px auto',
        }
    })();

    return (
        <>
            <Box ref={pageTop}>
                <StepByStep
                    steps={steps}
                    feedback={'As designações dessa semana foram enviadas!'}
                    conclusionStep={<h1>FIM!</h1>}
                />
            </Box>

            <Fab
                variant="extended"
                color="primary"
                className={classes.goTopFab}
                onClick={() => scrollToElement(pageTop.current, 'start')}
            >
                <NavigationIcon /> Topo
            </Fab>
        </>
    );
}
