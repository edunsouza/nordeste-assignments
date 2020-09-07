import React, { useState } from 'react';
import SwipeableViews from 'react-swipeable-views';
import { useTheme } from '@material-ui/core/styles';
import { Container, AppBar, Toolbar, Tabs, Tab, Box, Typography } from '@material-ui/core';

import AssignmentsTab from './assignments/AssignmentsTab';
import ParticipantsTab from './ParticipantsTab';
import MetricsTab from './MetricsTab';

function SegmentedContent({ children, value, index }) {
	return (
		<Container hidden={value !== index} style={{ minHeight: '250px' }} >
			{value === index && children}
		</Container>
	);
}

export default function SegmentedHeader() {
	const [value, setValue] = useState(0);
	const theme = useTheme();
	const styleGrowMarginRight = { flexGrow: 1, marginRight: theme.spacing(2) };
	const handleChange = (_, newValue) => setValue(newValue);
	const handleChangeIndex = (index) => setValue(index);

	return (
		<Container disableGutters={true} maxWidth={false}>
			<AppBar elevation={3} position="static" color="primary">
				<Toolbar>
					<Box mb={2} mt={1} flexShrink={1}>
						<Typography color="secondary" align="center" variant="h6">JW.ORG</Typography>
						<Typography color="secondary" align="center" variant="body2">Designações</Typography>
					</Box>
					<Typography color="secondary" align="right" variant="subtitle2" style={styleGrowMarginRight}>
						Você não está logado!
					</Typography>
				</Toolbar>
				<Tabs variant="fullWidth" value={value} onChange={handleChange} textColor="secondary">
					<Tab label="Designações" />
					<Tab label="Participantes" />
					<Tab label="Métricas" />
				</Tabs>
			</AppBar>
			<SwipeableViews axis={theme.direction === 'rtl' ? 'x-reverse' : 'x'} index={value} onChangeIndex={handleChangeIndex}>
				<SegmentedContent value={value} index={0}><AssignmentsTab /></SegmentedContent>
				<SegmentedContent value={value} index={1}><ParticipantsTab /></SegmentedContent>
				<SegmentedContent value={value} index={2}><MetricsTab /></SegmentedContent>
			</SwipeableViews>
		</Container>
	);
}