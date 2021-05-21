import { gql, useQuery } from '@apollo/client';
import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@material-ui/core';
import React from 'react';
import { AssetCount } from '../components/asset';
import { AssetSelector } from '../components/assetSelector';
import { LoadingSection, Section, Sections } from '../components/sections';
import { useStringQuery } from '../config/useQuery';
import { DEFAULT_ASSET_ID } from '../config/xor';

const GET_TOP = gql`
  query Exchanges($asset: String!){
    balanceTop(asset: $asset) {
      holder, amount
    }
  }
`;

export default function Home() {
    const [asset, setAsset] = useStringQuery('asset', DEFAULT_ASSET_ID);

    let { error, data, loading } = useQuery(GET_TOP, {
        variables: {
            asset
        }
    });
    if (loading) return <LoadingSection />;
    if (error) return <Section>
        Error: {error.message}
    </Section>;

    const body = (data.balanceTop).map((row, i) => <TableRow key={i}>
        <TableCell>
            {i + 1}.
        </TableCell>
        <TableCell>
            {row.holder}
        </TableCell>
        <TableCell>
            <AssetCount id={asset} amount={row.amount}></AssetCount>
        </TableCell>
    </TableRow>);

    return <Sections>
        <Section>
            <AssetSelector selected={asset} setSelected={a => setAsset(a)}></AssetSelector>
        </Section>
        <TableContainer component={Paper}>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell>
                            Row
                    </TableCell>
                        <TableCell>
                            Holder
                    </TableCell>
                        <TableCell>
                            Amount
                    </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {body}
                </TableBody>
            </Table>
        </TableContainer>
    </Sections>;
}
