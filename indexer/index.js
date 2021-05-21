const { ApiPromise, WsProvider } = require('@polkadot/api');
const pg = require('pg');

const SORA_ASSET_ID = '0x0200000000000000000000000000000000000000000000000000000000000000';

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

        CREATE TABLE IF NOT EXISTS transactions (
            block_id BIGINT NOT NULL,
            extrinsic_index BIGINT NOT NULL,
            event_index BIGINT NOT NULL,

            sender TEXT NOT NULL,
            receiver TEXT NOT NULL,
            asset TEXT NOT NULL,
            amount NUMERIC NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS transaction_location ON transactions (block_id, extrinsic_index, event_index);
        CREATE INDEX IF NOT EXISTS sender ON transactions (sender);
        CREATE INDEX IF NOT EXISTS receiver ON transactions (receiver);

        CREATE TABLE IF NOT EXISTS balances (
            holder TEXT NOT NULL,
            asset TEXT NOT NULL,
            amount NUMERIC NOT NULL,

            CONSTRAINT balance UNIQUE (holder, asset)
        );
        CREATE INDEX IF NOT EXISTS holder ON balances (holder);

        CREATE OR REPLACE FUNCTION balance_update() RETURNS TRIGGER
        SECURITY DEFINER
        LANGUAGE plpgsql
        AS $$
        BEGIN
            INSERT INTO balances (holder, asset, amount) VALUES (NEW.sender, NEW.asset, -NEW.amount)
            ON CONFLICT ON CONSTRAINT balance DO UPDATE SET amount = balances.amount - NEW.amount;
            INSERT INTO balances (holder, asset, amount) VALUES (NEW.receiver, NEW.asset, NEW.amount)
            ON CONFLICT ON CONSTRAINT balance DO UPDATE SET amount = balances.amount + NEW.amount;
            RETURN NEW;
        END;
        $$;
       
        BEGIN;
            DROP TRIGGER IF EXISTS balances_update ON transactions;
            CREATE TRIGGER balances_update AFTER INSERT ON transactions
            FOR EACH ROW
            EXECUTE PROCEDURE balance_update();
        COMMIT;

        CREATE TABLE IF NOT EXISTS block_timestamps (
            block_id BIGINT NOT NULL,
            block_ts TIMESTAMP NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS block_id ON block_timestamps (block_id);
        CREATE INDEX IF NOT EXISTS block_ts ON block_timestamps (block_ts);

        CREATE TABLE IF NOT EXISTS meta (
            dummy INT,
            last_block BIGINT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS dummy ON meta (dummy);
        INSERT INTO meta(dummy, last_block) VALUES (0, 0) ON CONFLICT DO NOTHING;
    `);
    console.log('Migrations done');

    if (process.env.RESET) {
        await client.query('UPDATE meta SET last_block = 0');
        console.log('Indexing reset done');
    }

    const meta = (await client.query('SELECT last_block FROM meta')).rows[0];

    let lastBlock = meta.last_block;
    while (true) {
        let blockHash;
        let signedBlock;
        let blockEvents;
        try {
            blockHash = await api.rpc.chain.getBlockHash(lastBlock);
            signedBlock = await api.rpc.chain.getBlock(blockHash);
            blockEvents = await api.query.system.events.at(signedBlock.block.header.hash);
        } catch (e) {
            console.log(`Block ${lastBlock} is not ready yet, waiting`);
            await new Promise(res => setTimeout(res, 6000));
            continue;
        }

        const extrinsics = signedBlock.block.extrinsics.toArray();
        for (let extrinsicIndex in extrinsics) {
            const extrinsic = extrinsics[extrinsicIndex];
            if (extrinsic && extrinsic.method.section === 'timestamp' && extrinsic.method.method === 'set') {
                await client.query(
                    'INSERT INTO block_timestamps(block_id, block_ts) VALUES ($1, to_timestamp($2::BIGINT / 1000)) ON CONFLICT DO NOTHING',
                    [
                        lastBlock,
                        extrinsic.method.args[0],
                    ].map(v => v.toString()),
                );
            }

            const events = blockEvents.filter(({ phase }) =>
                phase.isApplyExtrinsic &&
                phase.asApplyExtrinsic.eq(extrinsicIndex),
            );
            for (let eventIndex in events) {
                const event = events[eventIndex];
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
                } else if (event.event.section === 'currencies' && event.event.method === 'Transferred') {
                    const data = event.event.data;
                    await client.query(
                        'INSERT INTO transactions(block_id, extrinsic_index, event_index, asset, sender, receiver, amount) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING',
                        [
                            lastBlock,
                            extrinsicIndex,
                            eventIndex,

                            data[0],
                            data[1],
                            data[2],
                            data[3],
                        ].map(v => v.toString()),
                    )
                } else if (event.event.section === 'currencies' && event.event.method === 'Withdrawn') {
                    const data = event.event.data;
                    await client.query(
                        'INSERT INTO transactions(block_id, extrinsic_index, event_index, asset, sender, receiver, amount) VALUES ($1, $2, $3, $4, $5, \'TECH_WITHDRAW\', $6) ON CONFLICT DO NOTHING',
                        [
                            lastBlock,
                            extrinsicIndex,
                            eventIndex,

                            data[0],
                            data[1],
                            data[2],
                        ].map(v => v.toString()),
                    )
                } else if (event.event.section === 'currencies' && event.event.method === 'Deposited') {
                    const data = event.event.data;
                    await client.query(
                        'INSERT INTO transactions(block_id, extrinsic_index, event_index, asset, sender, receiver, amount) VALUES ($1, $2, $3, $4, \'TECH_DEPOSIT\', $5, $6) ON CONFLICT DO NOTHING',
                        [
                            lastBlock,
                            extrinsicIndex,
                            eventIndex,

                            data[0],
                            data[1],
                            data[2],
                        ].map(v => v.toString()),
                    )
                } else if (event.event.section === 'xorFee' && event.event.method === 'FeeWithdrawn') {
                    const data = event.event.data;
                    await client.query(
                        'INSERT INTO transactions(block_id, extrinsic_index, event_index, asset, sender, receiver, amount) VALUES ($1, $2, $3, $4, $5, \'FEE\', $6) ON CONFLICT DO NOTHING',
                        [
                            lastBlock,
                            extrinsicIndex,
                            eventIndex,

                            SORA_ASSET_ID,
                            data[0],
                            data[1],
                        ].map(v => v.toString()),
                    )
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