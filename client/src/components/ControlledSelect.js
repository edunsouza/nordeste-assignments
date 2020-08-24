import React from 'react';
import {
    FormControl,
    MenuItem,
    InputLabel,
    Select,
    OutlinedInput,
    FormHelperText,
} from '@material-ui/core';
import { requiredFormValidation } from '../common/utils';

export default function ControlledSelect(props) {
    const {
        id,
        label,
        onChange = () => { },
        form = {
            errors: {},
            setValue: () => { },
            trigger: () => { },
            register: () => { },
        },
        cache = {},
        validations,
        options = [],
        style = { width: '100%' },
        classes,
        ...otherProps
    } = props;
    return (
        <FormControl style={style} error={Boolean(form.errors[id])} className={classes} variant="outlined">
            <InputLabel id={`${id}-label`}>{label}</InputLabel>
            <Select
                {...otherProps}
                onChange={x => {
                    onChange(x);
                    if (form) {
                        form.setValue(id, x.target.value);
                        form.trigger(id);
                    }
                }}
                value={(cache[id] || {}).value || ''}
                input={
                    <OutlinedInput
                        defaultValue=""
                        label={label}
                        inputRef={ref => {
                            if (ref) {
                                ref.node.name = id;
                                form.register(ref.node, validations || requiredFormValidation);
                            }
                        }}
                    />
                }
            >
                {
                    options.map(({ value, text }) => <MenuItem key={`option-${value}`} value={value}>{text}</MenuItem>)
                }
            </Select>
            <FormHelperText>{form.errors[id] && form.errors[id].message}</FormHelperText>
        </FormControl>
    );
}