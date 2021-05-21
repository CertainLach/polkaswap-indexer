import React from "react"
import Link from "next/link";
import { Section, Sections } from "../../components/sections";
import { Button } from "@material-ui/core";

export default () => {
    return <Sections>
        <Section>
            <Link href="/user/overview"><Button>Balance</Button></Link>
            <Link href="/user/swaps"><Button>Swaps</Button></Link>
            <Link href="/user/volume"><Button>Volume</Button></Link>
        </Section>
    </Sections>
}