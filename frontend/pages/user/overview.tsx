import { gql, useQuery } from '@apollo/client';
import { Button, Card, CardActions, CardContent, Checkbox, FormControlLabel, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField } from '@material-ui/core';
import React, { useState } from 'react';
import { useStringQuery } from '../../config/useQuery';
import { Asset, AssetCount } from '../../components/asset';
import { LoadingSection, Section, Sections } from '../../components/sections';

const GET_BALANCES = gql`
  query Exchanges($caller: String!){
    balances(caller: $caller) {
      asset,
      amount,
      convertedAmount(target: "0x0200000000000000000000000000000000000000000000000000000000000000"),
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

export default function Home() {
  const [showOriginal, setShowOriginal] = useState(false);
  const [user, _] = useStringQuery('user', '');

  let { error, data, loading } = useQuery(GET_BALANCES, {
    variables: {
      caller: user,
    }
  });
  if (error) {
    loading = true;
  }

  if (data?.balances) {
    data.balances.sort((a, b) => {
      if (a.convertedAmount === null) return 1;
      if (b.convertedAmount === null) return -1;
      a = BigInt(a.convertedAmount);
      b = BigInt(b.convertedAmount);
      if (a > b)
        return -1;
      else if (b > a)
        return 1;
      return 0;
    });
  }

  const total = (data?.balances || []).map(b => b.convertedAmount).filter(a => a != null).map(a => BigInt(a)).reduce((a, b) => a + b, 0n).toString();

  const body = (data?.balances || []).map(b => <TableRow key={b.asset}>
    <TableCell>
      <Asset id={b.asset}></Asset>
    </TableCell>
    <TableCell>
      {b.convertedAmount && !showOriginal ? <AssetCount id={'0x0200000000000000000000000000000000000000000000000000000000000000'} amount={b.convertedAmount} /> : <AssetCount id={b.asset} amount={b.amount} />}
    </TableCell>
  </TableRow>)
  return <Sections>

    <HomeSettings />
    <Section>
      <FormControlLabel
        control={<Checkbox value={showOriginal} onChange={e=>setShowOriginal(e.target.checked)}/>}
        label="Skip conversion"
      />
    </Section>
    {loading ? <LoadingSection /> : <>
      <Section>
        Total balance: <AssetCount id={'0x0200000000000000000000000000000000000000000000000000000000000000'} amount={total} />
      </Section>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                Asset
              </TableCell>
              <TableCell>
                Balance
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {body}
          </TableBody>
        </Table>
      </TableContainer>
    </>}
  </Sections>;
}
