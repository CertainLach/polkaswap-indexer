import React from "react"
import Link from "next/link";
import { Section, Sections } from "../../components/sections";
import { Button } from "@material-ui/core";

export default () => {
    return <Sections>
        <Section>
            <Link href="/top/balance"><Button>By balance</Button></Link>
            <Link href="/top/swaps"><Button>By swaps count</Button></Link>
        </Section>
    </Sections>
}