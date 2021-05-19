import { DateTimePicker, LocalizationProvider } from "@material-ui/pickers";
import React, { useEffect, useState } from "react";
import DateFnsUtils from '@material-ui/pickers/adapter/date-fns';
import { TextField } from "@material-ui/core";
import { gql, useLazyQuery } from "@apollo/react-hooks";

const DATE_TO_BLOCK = gql`
    query DateToBlock($date: String!) {
	    dateToBlock(date: $date)
    }
`;

export function BlockInput(props: { name: string, label: string, value: number, setValue: (number) => void }) {
    const [date, setDate] = useState(new Date());

    const [fetch, { data, loading }] = useLazyQuery(DATE_TO_BLOCK);

    useEffect(() => {
        if (data?.dateToBlock !== undefined) {
            props.setValue(data?.dateToBlock);
        }
    }, [data?.dateToBlock]);

    return <div>
        <TextField label={props.label} hiddenLabel={false} value={props.value} defaultValue={props.value} type="number" onChange={e => props.setValue(+e.target.value)}></TextField>
        <LocalizationProvider dateAdapter={DateFnsUtils}>
            <DateTimePicker
                renderInput={(params) => <TextField {...params} label={'Date/time'} helperText={undefined} />}
                label="DateTimePicker"
                value={date}
                onChange={d => {
                    setDate(d);
                    fetch({
                        variables: {
                            date: d.toISOString(),
                        }
                    });
                }}
            />
        </LocalizationProvider>
        {loading && 'Converting...'}
    </div>
}