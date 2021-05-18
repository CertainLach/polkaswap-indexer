import { gql, useQuery } from "@apollo/react-hooks";
import { Avatar } from "@material-ui/core";
import React from "react";
import styled from "styled-components";

const AssetContainer = styled.div`
	display: inline;
	height: 26px;
	background: #aaa;
	border-radius: 13px;
	padding: 4px 8px;;
`;

function LoadedAsset(props: { id: string, name: string, decimals: number }) {
	return <AssetContainer title={`${props.id}, decimals: ${props.decimals}`}>
		{props.name}
	</AssetContainer>
}
function LoadingAsset(props: { id: string }) {
	return <AssetContainer title={`${props.id}`}>
		??? {props.id.slice(0, 5)}...
	</AssetContainer>
}

const LOAD_ASSET = gql`
    query Asset($id: String!) {
        asset(id: $id) {
            name,
            precision
        }
    }
`;

function formatPrecision(num: string, decimals: number) {
	let minus = num.startsWith('-');
	if (minus) num = num.slice(1);
	num = num.padStart(decimals + 1, '0');

	num = num.slice(0, -decimals) + '.' + num.slice(-decimals);
	if (minus) num = '-' + num;
	return num;
}

export function Asset(props: { id: string }) {
	let { data, loading, error } = useQuery(LOAD_ASSET, {
		variables: {
			id: props.id
		}
	});
	data = data?.asset;
	if (error) loading = true;
	if (error) {
		return <div>Error: {error.message}</div>
	} else if (loading) {
		return <LoadingAsset id={props.id} />
	} else {
		return <LoadedAsset id={props.id} name={data.name} decimals={data.precision} />
	}
}

export function AssetCount(props: { id: string, amount: string }) {
	let { data, loading, error } = useQuery(LOAD_ASSET, {
		variables: {
			id: props.id
		}
	});
	data = data?.asset;
	if (error) loading = true;
	if (error) {
		return <>Error: {error.message}</>
	} else if (loading) {
		return <>{props.amount} <LoadingAsset id={props.id} /></>
	} else {
		return <>{formatPrecision(props.amount, data.precision)} <LoadedAsset id={props.id} name={data.name} decimals={data.precision} /></>
	}
}

const PathSeparator = styled.div`
	display: inline;
`;

export function AssetPath(props: { ids: string[] }) {
	const out = [];
	props.ids.forEach((a, i) => {
		if (i !== 0)
			out.push(<PathSeparator key={i * 2}>{' => '}</PathSeparator>);
		out.push(<Asset key={i * 2 + 1} id={a} />);
	});
	return <>{out}</>;
}