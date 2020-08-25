import React, { useState } from 'react';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import { Check, ChevronRight } from '@material-ui/icons';
import {
    Hidden,
    Stepper,
    Step,
    StepLabel,
    Paper,
    Box,
    Button,
    Chip,
    Typography
} from '@material-ui/core';

import { useRootContext } from './RootContext';

export default function StepByStep({ steps = [], feedback, conclusionStep, onConclude, onBack, onNext, onReset }) {
    const { store, dispatch } = useRootContext().assignments;
    const [activeStep, setActiveStep] = useState(0);

    const isFirst = activeStep === 0;
    const hasNext = activeStep < steps.length - 1;
    const hasCompleted = activeStep === steps.length;

    const getStepHint = () => steps[activeStep] ? steps[activeStep].hint : '';

    const handleBack = () => {
        onBack && onBack(activeStep - 1);
        setActiveStep(prevActiveStep => prevActiveStep - 1);
    }
    const handleNext = async () => {
        if (!steps[activeStep].callback || await steps[activeStep].callback()) {
            if (hasCompleted) {
                onConclude && onConclude();
            } else {
                onNext && onNext(activeStep + 1);
            }
            setActiveStep(prevActiveStep => prevActiveStep + 1);
        }
    }
    const handleReset = () => {
        dispatch({ type: 'SET_EMAIL_SENT', data: false });
        onReset();
        setActiveStep(0);
    };

    const theme = useTheme();
    const classes = makeStyles(() => ({
        instructions: {
            display: 'flex',
            justifyContent: 'center',
            userSelect: 'none',
            marginTop: theme.spacing(2),
            marginBottom: theme.spacing(2),
        },
        spacing: {
            marginLeft: theme.spacing(1),
            marginRight: theme.spacing(1)
        }
    }))();

    return (
        <div>
            <Paper elevation={2}>
                <Box m={1} mt={3} p={1} pb={5}>
                    <Stepper activeStep={activeStep} alternativeLabel>
                        {
                            steps.length && steps.map((step, index) => (
                                <Step key={step.label}>
                                    <StepLabel>
                                        <Hidden smUp>
                                            <p>{step.label}</p>
                                        </Hidden>
                                        <Hidden xsDown>
                                            <Chip
                                                label={step.label}
                                                icon={index >= activeStep ? <ChevronRight /> : <Check />}
                                                variant="outlined"
                                                size="small"
                                            /></Hidden>
                                    </StepLabel>
                                </Step>
                            ))
                        }
                    </Stepper>
                    <Hidden xsDown>
                        <Typography variant="h5" color="primary" className={classes.instructions}>
                            {hasCompleted ? feedback : getStepHint()}
                        </Typography>
                    </Hidden>
                    <Hidden smUp>
                        <Typography variant="subtitle2" color="primary" className={classes.instructions}>
                            {hasCompleted ? feedback : getStepHint()}
                        </Typography>
                    </Hidden>
                    <Box display="flex" flexDirection="row" height={theme.spacing(5)} mr="auto" ml="auto" justifyContent="center">
                        {!hasCompleted && !store.emailSent && <Button className={classes.spacing} disabled={isFirst} color="primary" onClick={handleBack}>Anterior</Button>}
                        {hasNext && <Button className={classes.spacing} variant="contained" color="primary" onClick={handleNext}>Próximo</Button>}
                        {store.emailSent && <Button variant="contained" color="secondary" onClick={handleReset}>Preciso refazer</Button>}
                    </Box>
                </Box>
            </Paper>

            {hasCompleted ? conclusionStep : (steps[activeStep] || {}).content}
        </div>
    );
}
