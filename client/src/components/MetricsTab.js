import React from 'react';
import { Paper, Box, Typography } from '@material-ui/core';

export default function MetricsTab() {
    return (
        <Paper elevation={1}>
            <Box m={1} mt={3} p={1} height="60px">
                <Typography variant="h5">Métricas - em obras</Typography>
            </Box>
        </Paper>
    );
}