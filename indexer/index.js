const { ApiPromise, WsProvider } = require('@polkadot/api');
const pg = require('pg');

async function main() {
    const provider = new WsProvider(process.env.SUBSTRATE);

    const api = await ApiPromise.create({
        provider,
        types: require('@sora-substrate/type-definitions').types,
    });

    const [chain, nodeName, nodeVersion] = await Promise.all([
        api.rpc.system.chain(),
        api.rpc.system.name(),
        api.rpc.system.version()
    ]);

    console.log(`You are connected to chain ${chain} using ${nodeName} v${nodeVersion}`);

    const client = new pg.Client({
        connectionString: process.env.POSTGRES,
    });
    await client.connect();
    console.log('Connected to DB');

    await client.query(`
        CREATE TABLE IF NOT EXISTS exchanges (
            block_id BIGINT NOT NULL,
            extrinsic_index BIGINT NOT NULL,

            caller TEXT NOT NULL,
            source TEXT NOT NULL,
            source_amount NUMERIC NOT NULL,
            target TEXT NOT NULL,
            target_amount NUMERIC NOT NULL,
            fee NUMERIC NOT NULL
        );
        CREATE INDEX IF NOT EXISTS block_id ON exchanges (block_id);
        CREATE UNIQUE INDEX IF NOT EXISTS exchange_location ON exchanges (block_id, extrinsic_index);
        CREATE INDEX IF NOT EXISTS caller ON exchanges (caller);

        CREATE TABLE IF NOT EXISTS meta (
            dummy INT,
            last_block BIGINT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS dummy ON meta (dummy);
        INSERT INTO meta(dummy, last_block) VALUES (0, 0) ON CONFLICT DO NOTHING;
    `);
    console.log('Migrations done');

    const meta = (await client.query('SELECT last_block FROM meta')).rows[0];

    let lastBlock = meta.last_block;
    while (true) {
        const blockHash = await api.rpc.chain.getBlockHash(lastBlock);
        const signedBlock = await api.rpc.chain.getBlock(blockHash);
        const blockEvents = await api.query.system.events.at(signedBlock.block.header.hash);

        for (let extrinsicIndex in signedBlock.block.extrinsics) {
            const events = blockEvents.filter(({ phase }) =>
                phase.isApplyExtrinsic &&
                phase.asApplyExtrinsic.eq(extrinsicIndex),
            );
            for (let event of events) {
                if (event.event.section === 'liquidityProxy' && event.event.method === 'Exchange') {
                    const data = event.event.data;
                    await client.query(
                        'INSERT INTO exchanges(block_id, extrinsic_index, caller, source, source_amount, target, target_amount, fee) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING',
                        [
                            lastBlock,
                            extrinsicIndex,

                            data[0],
                            data[2],
                            data[4],
                            data[3],
                            data[5],
                            data[6],
                        ].map(v => v.toString()),
                    );
                }
            }
        }

        lastBlock++;
        if (lastBlock % 1000 == 0) {
            console.log(`Saving meta on ${lastBlock}`);
            await client.query('UPDATE meta SET last_block = $1', [lastBlock]);
        }
    }
}

main().catch(console.error).finally(() => process.exit());