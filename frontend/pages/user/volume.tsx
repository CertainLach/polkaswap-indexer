import { gql, useQuery } from '@apollo/client';
import { Button, Card, CardActions, CardContent, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField } from '@material-ui/core';
import React, { useState } from 'react';
import { useNumberQuery, useStringQuery } from '../../config/useQuery';
import { Asset, AssetCount } from '../../components/asset';
import { LoadingSection, Section, Sections } from '../../components/sections';
import styled from 'styled-components';
import { BlockInput } from '../../components/blockInput';

const GET_DELTA = gql`
  query Exchanges($from: Int!, $to: Int!, $caller: String!){
    balanceDelta(from: $from, to: $to, caller: $caller) {
      asset,
      txDeposited,
      deposited,
      convertedDeposited(target: "0x0200000000000000000000000000000000000000000000000000000000000000"),
      txWithdrawn,
      withdrawn,
      convertedWithdrawn(target: "0x0200000000000000000000000000000000000000000000000000000000000000"),
      profit,
      convertedProfit(target: "0x0200000000000000000000000000000000000000000000000000000000000000"),
    }
  }
`;

function HomeSettings() {
  const [user, setUser] = useStringQuery('user', '');
  const [userField, setUserField] = useState(user);

  return <Card>
    <CardContent>
      <TextField placeholder="User" value={userField} onChange={e => setUserField(e.target.value)}></TextField>
    </CardContent>
    <CardActions>
      <Button size="small" onClick={() => {
        setUser(userField);
      }}>Load</Button>
    </CardActions>
  </Card>
}

const ReceivedCell = styled(TableCell)`
  background: green;
`;

export default function Home() {
  const [user, _] = useStringQuery('user', '');
  const [fromBlock, setFromBlock] = useNumberQuery('from', 0, v => v >= 0);
  const [toBlock, setToBlock] = useNumberQuery('to', 600000, v => v >= 0);

  let { error, data, loading } = useQuery(GET_DELTA, {
    variables: {
      caller: user,
      from: fromBlock,
      to: toBlock,
    }
  });
  if (error) {
    loading = true;
  }

  if (data?.balanceDelta) {
    data.balanceDelta.sort((a, b) => {
      if (a.convertedProfit === null) return 1;
      if (b.convertedProfit === null) return -1;
      a = BigInt(a.convertedProfit);
      b = BigInt(b.convertedProfit);
      if (a > b)
        return -1;
      else if (b > a)
        return 1;
      return 0;
    });
  }

  const body = (data?.balanceDelta || []).map(b => {
    return <TableRow key={b.asset}>
      <TableCell>
        <Asset id={b.asset}></Asset>
      </TableCell>
      <TableCell>
        {b.convertedDeposited ? <AssetCount id={'0x0200000000000000000000000000000000000000000000000000000000000000'} amount={b.convertedDeposited} /> : <AssetCount id={b.asset} amount={b.deposited} />} / {b.txDeposited} txs
      </TableCell>
      <TableCell>
        {b.convertedWithdrawn ? <AssetCount id={'0x0200000000000000000000000000000000000000000000000000000000000000'} amount={b.convertedWithdrawn} /> : <AssetCount id={b.asset} amount={b.withdrawn} />} / {b.txWithdrawn} txs
      </TableCell>
      <TableCell>
        {b.convertedProfit ? <AssetCount id={'0x0200000000000000000000000000000000000000000000000000000000000000'} amount={b.convertedProfit} /> : <AssetCount id={b.asset} amount={b.profit} />} / {b.txDeposited + b.txWithdrawn} txs
      </TableCell>
    </TableRow>
  });

  const totalDeposited = (data?.balanceDelta || []).map(b => b.convertedDeposited).filter(a => a != null).map(a => BigInt(a)).reduce((a, b) => a + b, 0n).toString();
  const totalTxDeposited = (data?.balanceDelta || []).map(b => b.txDeposited).reduce((a, b) => a + b, 0);
  const totalWithdrawn = (data?.balanceDelta || []).map(b => b.convertedWithdrawn).filter(a => a != null).map(a => BigInt(a)).reduce((a, b) => a + b, 0n).toString();
  const totalTxWithdrawn = (data?.balanceDelta || []).map(b => b.txWithdrawn).reduce((a, b) => a + b, 0);
  const total = (data?.balanceDelta || []).map(b => b.convertedProfit).filter(a => a != null).map(a => BigInt(a)).reduce((a, b) => a + b, 0n).toString();
  const totalTx = totalTxDeposited + totalTxWithdrawn;

  const totalRow = <TableRow>
    <TableCell>
      Total
      </TableCell>
    <TableCell>
      <AssetCount id={'0x0200000000000000000000000000000000000000000000000000000000000000'} amount={totalDeposited} /> / {totalTxDeposited} txs
      </TableCell>
    <TableCell>
      <AssetCount id={'0x0200000000000000000000000000000000000000000000000000000000000000'} amount={totalWithdrawn} /> / {totalTxWithdrawn} txs
      </TableCell>
    <TableCell>
      <AssetCount id={'0x0200000000000000000000000000000000000000000000000000000000000000'} amount={total} /> / {totalTx} txs
      </TableCell>
  </TableRow>;

  return <Sections>

    <HomeSettings />
    <Section>
      <BlockInput name="from" label="Start block" value={fromBlock} setValue={setFromBlock}></BlockInput>
      <BlockInput name="to" label="End block" value={toBlock} setValue={setToBlock}></BlockInput>
    </Section>
    {loading ? <LoadingSection /> : <>
      <Section>
        Total volume: <AssetCount id={'0x0200000000000000000000000000000000000000000000000000000000000000'} amount={total} />
      </Section>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                Asset
              </TableCell>
              <TableCell>
                Deposited
              </TableCell>
              <TableCell>
                Withdrawn
              </TableCell>
              <TableCell>
                Volume
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {body}
            {totalRow}
          </TableBody>
        </Table>
      </TableContainer>
    </>}
  </Sections>;
}
