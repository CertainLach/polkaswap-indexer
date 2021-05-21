import { gql, useQuery } from '@apollo/client';
import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@material-ui/core';
import React from 'react';
import { LoadingSection, Section, Sections } from '../../components/sections';

const GET_TOP = gql`
  query Exchanges {
    exchangeTop {
      caller,
      count,
    }
  }
`;

export default function Home() {
    let { error, data, loading } = useQuery(GET_TOP);
    if (loading) return <LoadingSection />;
    if (error) return <Section>
        Error: {error.message}
    </Section>;

    const body = (data.exchangeTop).map((row, i) => <TableRow key={i}>
        <TableCell>
            {i + 1}.
        </TableCell>
        <TableCell>
            {row.caller}
        </TableCell>
        <TableCell>
            {row.count}
        </TableCell>
    </TableRow>);

    return <Sections>
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
                            Swaps
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
