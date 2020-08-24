import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { Check, Mail } from '@material-ui/icons';
import { Fab, CircularProgress } from '@material-ui/core';

export default function FabLoadingProgress({ icon, color, onClick, success, loading, ...props }) {
    const classes = makeStyles(theme => ({
        wrapper: {
            position: 'relative',
            marginLeft: theme.spacing(1),
            marginRight: theme.spacing(1),
        },
        fabProgress: {
            color: theme.palette.success.main,
            position: 'absolute',
            top: -4,
            left: -4,
            zIndex: 1,
        }
    }))();

    return (
        <div className={classes.wrapper}>
            <Fab disabled={success} size="small" color={color || 'primary'} onClick={onClick} {...props}>
                {
                    success ? <Check /> : (icon || <Mail />)
                }
            </Fab>
            {loading && <CircularProgress size={48} className={classes.fabProgress} />}
        </div>
    )
}
