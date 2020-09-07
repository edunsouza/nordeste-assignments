export const normalizeText = text => {
    text = text || '';
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
};

export const generateElementId = (value, dashed) => {
    return normalizeText(value).replace(/\s/g, dashed ? '-' : '_').replace(/["()]/g, '');
};

export const scrollToElement = (element, position = 'center') => {
    element.scrollIntoView({ behavior: 'smooth', block: position });
};

export const submitReactFormHook = (form = {}) => {
    const control = form.control && form.control.fieldsRef && form.control.fieldsRef.current;
    if (!control) {
        return false;
    }

    Object.values(control).forEach(input => {
        const error = input.validate && input.validate(input.ref.value);
        if (typeof error == 'string') {
            form.setError(input.ref.name, { type: 'validation', message: error });
        }
    });

    // scroll to first invalid input or callback with form values
    const firstInvalidInput = Object.values(form.errors)[0];
    if (firstInvalidInput) {
        scrollToElement(firstInvalidInput.ref);
        return false;
    }

    return form.getValues();
}

export const requiredFormValidation = {
    validate: value => (
        (
            value !== undefined
            && value !== null
            && String(value).trim().length !== 0
        )
        || 'Este campo é obrigatório'
    )
};

export const emailIfValid = email => {
    if (typeof email === 'string' && /(.+)@(.+){2,}\.(.+){2,}/.test(email)) {
        return email;
    }
};