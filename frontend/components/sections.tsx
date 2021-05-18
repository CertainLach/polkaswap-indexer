import { Card, CircularProgress, Container, Paper } from "@material-ui/core";
import { GridLoadingOverlay } from "@material-ui/data-grid";
import styled from "styled-components";

export const Sections = styled(Container)`
    display: flex !important;
    flex-direction: column;
    gap: 20px;
    padding-top: 20px;
    padding-bottom: 20px;
`;

export const Section = styled(Paper)`
    padding: 20px;
`;

const LoadingSectionContainer = styled(Paper)`
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 40px;
`;

export const LoadingSection = () => {
    return <LoadingSectionContainer>
        <CircularProgress />
    </LoadingSectionContainer>
}