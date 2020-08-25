import React, { forwardRef, useEffect, useState } from 'react';
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Slide,
    FormControl,
    InputLabel,
    OutlinedInput,
    Typography,
    Box
} from '@material-ui/core';

export default function PopupModal({ isOpen, onClose, title, content, onConfirm, hasInput, inputLabel, confirmOnly = false }) {
    const [text, setText] = useState('');
    const close = () => {
        document.body.style.overflow = 'auto';
        onClose && onClose();
    };

    const confirm = () => {
        if (hasInput) {
            onConfirm && onConfirm(text);
        } else {
            close();
        }
    };

    useEffect(() => {
        const backdrop = document.querySelector('.MuiBackdrop-root');
        if (isOpen && backdrop) {
            document.body.style.overflow = 'hidden';
            backdrop.parentElement.style.visibility = 'visible';
        } else if (backdrop) {
            backdrop.parentElement.style.visibility = 'hidden';
        }
    }, [isOpen]);

    const Transition = forwardRef(function Transition(props, ref) {
        return <Slide direction="up" ref={ref} {...props} />;
    });

    const TransitionComponent = hasInput ? {} : { 'TransitionComponent': Transition };

    return (
        <Dialog open={Boolean(isOpen)} onClose={close} {...TransitionComponent} fullWidth={true} maxWidth="xs">
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                {typeof content === 'string'
                    ? <Typography>{content}</Typography>
                    : <Box>{content}</Box>
                }

                {hasInput && <FormControl style={{ width: '100%' }}>
                    <InputLabel style={{ left: '15px', top: '-5px' }}>{inputLabel}</InputLabel>
                    <OutlinedInput
                        label={inputLabel}
                        value={text}
                        autoFocus={true}
                        onChange={x => setText(x.target.value)} />
                </FormControl>}

            </DialogContent>
            <DialogActions>
                {!confirmOnly && <Button color="primary" onClick={close}>Cancelar</Button>}
                <Button color="primary" onClick={confirm}>OK</Button>
            </DialogActions>
        </Dialog >
    );
}