import { gql, useQuery } from '@apollo/client';
import { Button, Card, CardContent, CircularProgress, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField } from '@material-ui/core';
import React, { useState } from 'react';
import { useNumberQuery, useStringQuery } from '../../config/useQuery';
import { AssetCount } from '../../components/asset';
import { LoadingSection, Section, Sections } from '../../components/sections';

const GET_EXCHANGES = gql`
  query Exchanges($caller: String!, $limit: Int, $offset: Int){
    exchanges(caller: $caller, limit: $limit, offset: $offset) {
      count
      exchanges {
        id
        source
        sourceAmount

        target
        targetAmount
      }
    }
  }
`;

function HomeSettings() {
  const [user, setUser] = useStringQuery('user', '');
  const [userField, setUserField] = useState(user);

  return <Card>
    <TextField placeholder="User" value={userField} onChange={e => setUserField(e.target.value)}></TextField>
    <CardContent>
      <Button size="small" onClick={() => {
        setUser(userField);
      }}>Goto</Button>
    </CardContent>
  </Card>
}

export default function Home() {
  const [user, _] = useStringQuery('user', '');
  const [pageSize, setPageSize] = useNumberQuery('pageSize', 100);
  const [page, setPage] = useNumberQuery('page', 1);

  let { error, data, loading } = useQuery(GET_EXCHANGES, {
    variables: {
      caller: user,
      limit: pageSize,
      offset: pageSize * (page - 1),
    }
  });
  if (error) {
    loading = true;
  }

  const body = (data?.exchanges.exchanges ?? []).map(row => <TableRow key={row.id}>
    <TableCell>
      {row.id}
    </TableCell>
    <TableCell>
      <AssetCount id={row.source} amount={row.sourceAmount} />
    </TableCell>
    <TableCell>
      <AssetCount id={row.target} amount={row.targetAmount} />
    </TableCell>
  </TableRow>);
  const totalPages = Math.ceil(data?.exchanges.count / pageSize);

  return <Sections>
    <HomeSettings />
    {loading ? <LoadingSection /> : <>
      <Section>
        {(loading) && <CircularProgress /> || <>
          <div>Found: {data?.exchanges.count}</div>
          <div>
            <Button onClick={() => setPage(Math.max(page - 1, 1))}>{'<'}</Button>
          Page: {page}/{totalPages}
            <Button onClick={() => setPage(Math.min(page + 1, totalPages))}>{'>'}</Button>
          </div>
        </>}
      </Section>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                ID
          </TableCell>
              <TableCell>
                From
          </TableCell>
              <TableCell>
                To
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
