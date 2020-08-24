import React from 'react';
import axios from 'axios';

export default function AssignmentsPreview() {

    const send = async () => {
        const { data } = await axios.post(`${process.env.REACT_APP_ROOT}/api/v1/assignments`, {
            to: [
                { email: 'name@example.com', name: 'Name Example' },
            ]
        });

        if (data) {
            alert('teste foi enviado!');
        }
    };

    return (
        <div>
            <p>CLIQUE PARA ENVIAR</p>
            <button onClick={send}>ENVIAR EMAIL DE TESTE</button>
        </div>
    );
}