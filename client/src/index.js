import React from 'react';
import ReactDOM from 'react-dom';
import { createMuiTheme, ThemeProvider } from '@material-ui/core/styles';

import { RootContextProvider } from './components/RootContext';
import SegmentedHeader from './components/SegmentedHeader';

import './index.css';

function App() {
    const theme = createMuiTheme({
        palette: {
            primary: {
                main: '#582b7b',
                dark: '#4c246c',
                light: '#6f5fbf',
            },
            secondary: {
                main: '#e3e3e3',
                light: '#f2f2f2',
                dark: '#9b9b9b',
            },
            success: {
                main: '#2cbd32',
            }
        },
    });
    theme.palette.primary.contrastText = theme.palette.secondary.light;
    theme.palette.secondary.contrastText = theme.palette.primary.main;

    // overrides
    theme.overrides = {
        MuiAppBar: {
            colorPrimary: {
                backgroundColor: '#42215d',
            }
        },
        MuiTab: {
            textColorSecondary: {
                color: '#bcace0',
                '&$selected': {
                    backgroundColor: theme.palette.primary.dark
                },
                [theme.breakpoints.down('xs')]: {
                    fontSize: theme.spacing(1.4)
                },
            }
        },
        MuiTabs: {
            root: {
                backgroundColor: theme.palette.primary.main,
            }
        },
        MuiStep: {
            horizontal: {
                [theme.breakpoints.down('xs')]: {
                    padding: 0,
                },
            }
        },
        MuiStepLabel: {
            label: {
                '&$alternativeLabel *': {
                    color: theme.palette.secondary.dark,
                    fill: theme.palette.secondary.dark,
                    borderColor: theme.palette.secondary.dark,
                    [theme.breakpoints.down('xs')]: {
                        fontSize: theme.spacing(1.4),
                    },
                },
                '&$active *': {
                    color: theme.palette.primary.contrastText,
                    fill: theme.palette.primary.contrastText,
                    borderColor: theme.palette.primary.dark,
                    [theme.breakpoints.down('xs')]: {
                        color: theme.palette.secondary.contrastText
                    },
                },
                '&$active div': {
                    backgroundColor: theme.palette.primary.dark,
                },
                '&$completed *': {
                    color: theme.palette.success.main,
                    fill: theme.palette.success.main,
                    borderColor: theme.palette.success.main
                },
            },
        },
        MuiStepIcon: {
            root: {
                fill: theme.palette.secondary.dark,
                '&$completed': {
                    fill: theme.palette.success.main
                },
                '&$active': {
                    fill: theme.palette.primary.dark
                },
            }
        },
        MuiStepConnector: {
            root: {
                [theme.breakpoints.down('xs')]: {
                    display: 'none'
                }
            }
        },
        MuiStepper: {
            root: {
                [theme.breakpoints.down('xs')]: {
                    padding: 0,
                    paddingTop: theme.spacing(1)
                }
            }
        },
        MuiOutlinedInput: {
            input: {
                [theme.breakpoints.down('xs')]: {
                    padding: theme.spacing(2)
                }
            },
            root: {
                '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme.palette.primary.main,
                    borderWidth: '2px'
                }
            },
        },
        MuiSelect: {
            select: {
                [theme.breakpoints.down('xs')]: {
                    padding: theme.spacing(2)
                }
            },
        }
    };

    return (
        <ThemeProvider theme={theme}>
            <RootContextProvider>
                <SegmentedHeader />
            </RootContextProvider>
        </ThemeProvider>
    );
}

ReactDOM.render(<App />, document.getElementById('root'));
