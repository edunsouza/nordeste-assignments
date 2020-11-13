import React, { useReducer, useContext, createContext } from 'react';

const RootContext = createContext({});

const assignmentsInitialState = {
    emailSent: false,
    parts: [],
    contacts: [],
    contactGroups: [],
    cleaningGroups: [],
    ministryFieldsCache: {},
    preview: {
        html: '',
        shouldRefresh: false
    },
    assignedParts: {
        weekend: {},
        week: {},
        cleaning: {},
        ministry: {},
    }
};
const participantsInitialState = {};
const metricsInitialState = {};

const assignmentsReducer = (oldState, { type, data }) => {
    switch (type) {
        case 'SET_EMAIL_SENT':
            return { ...oldState, emailSent: Boolean(data) };
        case 'SET_PARTS':
            return { ...oldState, parts: data };
        case 'SET_CONTACTS':
            return {
                ...oldState,
                contacts: (data || []).sort((a, b) => a.text.toUpperCase() > b.text.toUpperCase() ? 1 : -1)
            };
        case 'ADD_CONTACT':
            const newContact = { id: data.id, text: data.name, value: data.address };
            return {
                ...oldState,
                contacts: [
                    ...oldState.contacts,
                    newContact
                ].sort((a, b) => a.text.toUpperCase() > b.text.toUpperCase() ? 1 : -1)
            };
        case 'REMOVE_CONTACT':
            return { ...oldState, contacts: [...oldState.contacts].filter(c => c.id !== data) };
        case 'SET_CONTACT_GROUPS':
            return { ...oldState, contactGroups: data || [] };
        case 'ADD_CONTACT_GROUP':
            const newContactGroup = { id: data.id, name: data.name, contacts: data.contacts };
            return {
                ...oldState,
                contactGroups: [
                    ...oldState.contactGroups,
                    newContactGroup
                ].sort((a, b) => a.name.toUpperCase() > b.name.toUpperCase() ? 1 : -1)
            };
        case 'REMOVE_CONTACT_GROUP':
            return { ...oldState, contactGroups: [...oldState.contactGroups].filter(cg => cg.id !== data) };
        case 'SET_CLEANING_GROUPS':
            return { ...oldState, cleaningGroups: data };
        case 'ADD_MINISTRY_FIELD_CACHE':
            return { ...oldState, ministryFieldsCache: { ...oldState.ministryFieldsCache, ...data } };
        case 'REMOVE_MINISTRY_FIELD_CACHE':
            delete oldState.ministryFieldsCache[data];
            return { ...oldState };
        case 'ASSIGN_TO_WEEKEND':
            oldState.assignedParts.weekend = { ...oldState.assignedParts.weekend, ...data };
            return { ...oldState };
        case 'ASSIGN_TO_WEEK':
            oldState.assignedParts.week = { ...oldState.assignedParts.week, ...data };
            return { ...oldState };
        case 'ASSIGN_TO_CLEANING':
            oldState.assignedParts.cleaning = { ...oldState.assignedParts.cleaning, ...data };
            return { ...oldState };
        case 'ASSIGN_TO_MINISTRY':
            oldState.assignedParts.ministry = { ...oldState.assignedParts.ministry, ...data };
            return { ...oldState };
        case 'UNASSIGN_FROM_MINISTRY':
            delete oldState.assignedParts.ministry[data];
            return { ...oldState };
        case 'SET_PREVIEW_CONTENT':
            return { ...oldState, preview: { html: data, shouldRefresh: false } };
        case 'SET_PREVIEW_OUTDATED':
            oldState.preview.shouldRefresh = true;
            return { ...oldState };
        default:
            console.log('Dispatched action was not found:', type);
            return oldState;
    }
}

// TODO
const participantsReducer = (oldState, { type, data }) => { };

// TODO
const metricsReducer = (oldState, { type, data }) => { };

export const RootContextProvider = ({ children }) => {
    const [aState, aDispatcher] = useReducer(assignmentsReducer, assignmentsInitialState);
    const [pState, pDispatcher] = useReducer(participantsReducer, participantsInitialState);
    const [mState, mDispatcher] = useReducer(metricsReducer, metricsInitialState);
    return (
        <RootContext.Provider value={{
            assignments: {
                store: aState,
                dispatch: aDispatcher,
            },
            participants: {
                store: pState,
                dispatch: pDispatcher,
            },
            metrics: {
                store: mState,
                dispatch: mDispatcher,
            }
        }}>
            {children}
        </RootContext.Provider>
    );
};

export const useRootContext = () => useContext(RootContext);