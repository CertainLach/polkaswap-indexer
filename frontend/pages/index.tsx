import React from "react"
import Link from "next/link";
import { Section, Sections } from "../components/sections";
import { Button } from "@material-ui/core";

export default () => {
    return <Sections>
        <Section>
            <Link href="/top"><Button>Tops</Button></Link>
            <Link href="/user"><Button>User info</Button></Link>
        </Section>
    </Sections>
}