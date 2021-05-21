const { ApiPromise, WsProvider } = require('@polkadot/api');
const express = require('express');
const { buildSchema } = require('graphql');
const { graphqlHTTP } = require('express-graphql');
const BN = require('bignumber.js');
const pg = require('pg');
let port = 8080;

let schema = buildSchema(`
    type Query {
        exchanges(caller: String!, offset: Int, limit: Int): Exchanges!,
        balances(caller: String!): [Balance!]!,
        balanceDelta(from: Int!, to: Int!, caller: String!): [BalanceDelta!]!,
        asset(id: String!): Asset,
        dateToBlock(date: String!): Int!,
    }

    type BalanceDelta {
        asset: String!
        txDeposited: Int!,
        deposited: String!,
        convertedDeposited(target: String!): String,
        txWithdrawn: Int!,
        withdrawn: String!,
        convertedWithdrawn(target: String!): String,
        profit: String!,
        convertedProfit(target: String!): String,
    }
    
    type Exchanges {
        count: Int!,
        exchanges: [Exchange!]!,
    }

    type Balance {
        asset: String!,
        amount: String!,
        conversionPath(target: String!): [String!],
        convertedAmount(target: String!): String,
    }

    type Exchange {
        id: String!,
        blockId: Int!,
        extrinsicIndex: Int!,
        source: String!,
        sourceAmount: String!,
        target: String!,
        targetAmount: String!,
    }

    type Asset {
        name: String!,
        precision: Int!,
    }
`);

class Exchange {
    constructor(api, data) {
        this.api = api;
        this.blockId = data.block_id;
        this.extrinsicIndex = data.extrinsic_index;
        this.source = data.source;
        this.sourceAmount = data.source_amount;
        this.target = data.target;
        this.targetAmount = data.target_amount;
    }
    get id() {
        return `#${this.blockId}/${this.extrinsicIndex}`
    }
}

class Asset {
    static CACHE = {};
    constructor(data) {
        this.name = Buffer.from(data[1].slice(2), 'hex').toString('utf-8');
        this.precision = parseInt(data[2]);
    }
    static async load(api, id) {
        if (Asset.CACHE[id]) return Asset.CACHE[id];
        const asset = new Asset((await api.query.assets.assetInfos(id)).toJSON());
        return Asset.CACHE[id] = asset;
    }
}

class Balance {
    constructor(api, data) {
        this.api = api;
        this.asset = data.asset;
        this.amount = data.amount;
    }
    conversionPath(args) {
        return Conversions.findPathFromTo(this.asset, args.target);
    }
    async convertedAmount(args) {
        if (this.amount === '')
            return '0';
        if (this.asset === args.target)
            return this.amount;
        return Conversions.convertPrice(this.asset, args.target, this.amount);
    }
}

class BalanceDelta {
    constructor(data) {
        this.asset = data.asset;
        this.deposited = data.deposited;
        this.withdrawn = data.withdrawn;
        this.txWithdrawn = data.tx_withdrawn;
        this.txDeposited = data.tx_deposited;
    }

    get profit() {
        return (BigInt(this.deposited) - BigInt(this.withdrawn)).toString();
    }

    convertedProfit(args) {
        return Conversions.convertPrice(this.asset, args.target, this.profit);
    }

    convertedDeposited(args) {
        return Conversions.convertPrice(this.asset, args.target, this.deposited);
    }

    convertedWithdrawn(args) {
        return Conversions.convertPrice(this.asset, args.target, this.withdrawn);
    }
}

function formatPrecision(num, decimals) {
    let minus = num.startsWith('-');
    if (minus) num = num.slice(1);
    num = num.padStart(decimals + 1, '0');

    num = num.slice(0, -decimals) + '.' + num.slice(-decimals);
    if (minus) num = '-' + num;
    return num;
}

class Conversions {
    static PAIRS = {};
    static async enablePair(api, from, to) {
        if (!(from in Conversions.PAIRS)) Conversions.PAIRS[from] = {};
        const fromAsset = await Asset.load(api, from);
        const toAsset = await Asset.load(api, to);
        const amount = 10n ** BigInt(fromAsset.precision);
        const price = await quote(api, from, to, amount.toString());
        Conversions.PAIRS[from][to] = formatPrecision(price, toAsset.precision);
    }
    static async loadPairs(api) {
        const pairs = await api.query.tradingPair.enabledSources.entries(0);
        const fromTo = pairs.map(p => p[0].args[1].toJSON()).map(e => [e.base_asset_id, e.target_asset_id]);
        for (let [a, b] of fromTo) {
            this.enablePair(api, a, b);
            this.enablePair(api, b, a);
        }
    }
    static findPathFromTo(from, to, visited = new Set()) {
        const out = [];
        out.push(from);
        if (from === to) {
            return out;
        }
        if (!Conversions.PAIRS[from]) {
            return null;
        }
        if (Conversions.PAIRS[from][to]) {
            out.push(to);
            return out;
        }
        const possibleResults = [];
        for (let target in Conversions.PAIRS[from]) {
            if (visited.has(target)) {
                continue;
            }
            visited.add(target);
            const result = Conversions.findPathFromTo(target, to, new Set([...visited]));
            if (result !== null) {
                possibleResults.push(result);
            }
        }
        if (possibleResults.length === 0)
            return null;
        const bestResult = possibleResults.sort((a, b) => a.length - b.length)[0];
        out.push(...bestResult);
        return out;
    }
    static convertPrice(from, to, value) {
        const path = this.findPathFromTo(from, to);
        if (path === null) {
            return null;
        }
        value = new BN(value);
        for (let i = 0; i < path.length - 1; i++) {
            const mult = new BN(this.PAIRS[path[i]]?.[path[i + 1]]);
            value = value.times(mult);
        }
        const out = value.toFixed(0);
        return out;
    }
}

async function quote(api, from, to, amount) {
    amount = amount.toString();
    let minus = amount.startsWith('-');
    if (minus) amount = amount.slice(1);
    const result = await api.rpc.liquidityProxy.quote(0, from, to, amount.toString(), 'WithDesiredInput', [], 'Disabled');
    if (result.isNone) return null;
    amount = result.unwrap().amount.toString();
    if (minus) amount = '-' + amount;
    return amount;
}

class SchemaRoot {
    constructor(pool, api) {
        this.pool = pool;
        this.api = api;
    }

    async exchanges(args) {
        const [total, result] = await Promise.all([
            this.pool.query('SELECT COUNT(*) FROM exchanges WHERE caller = $1', [args.caller]),
            this.pool.query(`
                SELECT block_id, extrinsic_index, source, source_amount, target, target_amount
                FROM exchanges
                WHERE caller = $1
                ORDER BY (block_id, extrinsic_index) DESC
                LIMIT $2
                OFFSET $3
            `, [args.caller, Math.min(args.limit || 100, 100), args.offset || 0]),
        ]);
        return {
            count: total.rows[0].count,
            exchanges: result.rows.map(r => new Exchange(this.api, r)),
        };
    }
    async balances(args) {
        const result = await this.pool.query('SELECT asset, amount FROM balances WHERE holder = $1', [args.caller]);
        return result.rows.map(r => new Balance(this.api, r));
    }
    async asset(args) {
        return await Asset.load(this.api, args.id);
    }
    async balanceDelta({ from, to, caller }) {
        const result = await this.pool.query(`
            SELECT asset, SUM(withdrawn) AS withdrawn, SUM(deposited) AS deposited, SUM(tx_withdrawn) AS tx_withdrawn, SUM(tx_deposited) AS tx_deposited
            FROM (
                SELECT asset, SUM(amount) AS withdrawn, 0 AS deposited, COUNT(*) AS tx_withdrawn, 0 AS tx_deposited
                FROM transactions
                WHERE block_id > $1 AND block_id < $2
                AND sender = $3
                AND receiver != 'FEE'
                GROUP BY asset
            UNION
                SELECT asset, 0 as withdrawn, SUM(amount) AS deposited, 0 AS tx_withdrawn, COUNT(*) AS tx_deposited
                FROM transactions
                WHERE block_id > $1 AND block_id < $2
                AND receiver = $3
                GROUP BY asset
            ) AS temp GROUP BY asset;
        `, [
            from, to, caller
        ]);
        return result.rows.map(r => new BalanceDelta(r));
    }
    async dateToBlock({ date }) {
        const result = await this.pool.query(
            'SELECT block_id FROM block_timestamps WHERE block_ts <= $1::TIMESTAMP ORDER BY block_id DESC LIMIT 1',
            [date],
        );
        const blockId = result.rows[0]?.block_id ?? 0;
        return blockId;
    }
};

async function main() {
    const pool = new pg.Pool({
        connectionString: process.env.POSTGRES,
    });

    const provider = new WsProvider(process.env.SUBSTRATE);
    const api = await ApiPromise.create({
        provider,
        types: require('@sora-substrate/type-definitions').types,
        rpc: require('@sora-substrate/type-definitions').rpc,
    });

    const app = express();
    app.use('/', graphqlHTTP({
        schema: schema,
        rootValue: new SchemaRoot(pool, api),
        graphiql: true,
    }));

    await Conversions.loadPairs(api);

    app.listen(port);
}

main().catch(console.error);