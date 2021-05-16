import { Container, TextField, Box, Button, Paper, TableContainer, Table, TableCell, TableHead, TableBody, TableRow, CircularProgress } from '@material-ui/core';
import { DataGrid } from '@material-ui/data-grid';
import { useState, useEffect } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { gql, useQuery } from '@apollo/client';
import { useRouter } from 'next/router';
import Link from 'next/link'
import * as styles from '../styles/Home.module.css';

const GET_EXCHANGES = gql`
  query Exchanges($caller: String!, $limit: Int, $offset: Int){
    exchanges(caller: $caller, limit: $limit, offset: $offset) {
      count
      exchanges {
        id
        sourceAsset {
          name
        }
        sourceAmountWithPrecision

        targetAsset {
          name
        }
        targetAmountWithPrecision
      }
    }
  }
`;

function HomeSettings() {
  const router = useRouter();
  const [userId, setUserId] = useState(router.query.user || '');

  return <Paper className={styles.settings}>
    <TextField placeholder="User" value={userId} onChange={e => setUserId(e.target.value)}></TextField>
    <Link href={{ query: { user: userId, page: 1 } }}>
      <Button>Goto</Button>
    </Link>
  </Paper>
}

export default function Home() {
  const router = useRouter();
  const user = router.query.user || '';
  const pageSize = router.query.pageSize || 100;
  const page = +router.query.page || 1;

  const { error, data, loading } = useQuery(GET_EXCHANGES, {
    variables: {
      caller: user,
      limit: pageSize,
      offset: pageSize * (page - 1),
    }
  });
  if (error) {
    throw error;
  }
  console.log(data?.exchanges.exchanges ?? [])

  const body = (data?.exchanges.exchanges ?? []).map(row => <TableRow key={row.id}>
    <TableCell>
      {row.id}
    </TableCell>
    <TableCell>
      {parseFloat(row.sourceAmountWithPrecision)}
      &nbsp;
      {row.sourceAsset.name}
    </TableCell>
    <TableCell>
      {parseFloat(row.targetAmountWithPrecision)}
      &nbsp;
      {row.targetAsset.name}
    </TableCell>
  </TableRow>);
  const totalPages = Math.ceil(data?.exchanges.count / pageSize);

  return <Container>

    <HomeSettings />
    <Paper className={`${styles.status} ${loading && styles.loading || ''}`}>
      {(loading) && <CircularProgress /> || <>
        <div>Found: {data?.exchanges.count}</div>
        <div>
          <Link href={{ query: { user, page: Math.max(page - 1, 1) } }} disabled={page === 0}>
            <Button>{'<'}</Button>
          </Link>
          Page: {page}/{totalPages}
          <Link href={{ query: { user, page: Math.min(page + 1, totalPages) } }}>
            <Button>{'>'}</Button>
          </Link>
        </div>
      </>}
    </Paper>
    <TableContainer className={styles.table} component={Paper}>
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
  </Container>;
}
