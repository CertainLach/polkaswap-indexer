import { gql, useQuery } from "@apollo/react-hooks";
import { TextField } from "@material-ui/core";
import { Autocomplete } from '@material-ui/lab';
import React from "react";

const GET_ASSETS = gql`
    query GetAssets {
        assets {
            id,
            name,
        }
    }
`;

export function AssetSelector(props: { selected: string, setSelected: (selected: string) => void }) {
    let { data, error, loading } = useQuery(GET_ASSETS);

    if (loading) return <>Loading asset list...</>;
    if (error) return <>Error loading asset list: {error.message}</>;

    return <Autocomplete
        options={data.assets}
        value={data.assets.find((asset: any) => asset.id === props.selected)}
        onChange={(_e, v) => props.setSelected(v.id)}
        getOptionLabel={(option: any) => option.name}
        getOptionSelected={(option, selected) => {
            return option.id === selected.id;
        }}
        style={{ width: 300 }}
        renderInput={(params) => <TextField {...params} label="Asset" variant="outlined" />}
    />;
}