const { ApiPromise, WsProvider } = require('@polkadot/api');
const express = require('express');
const { buildSchema } = require('graphql');
const { graphqlHTTP } = require('express-graphql');
const pg = require('pg');
let port = 8080;

let schema = buildSchema(`
    type Query {
        exchanges(caller: String!, offset: Int, limit: Int): Exchanges!,
        balances(caller: String!): [Balance!]!,
        asset(id: String!): Asset,
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
        return await quote(this.api, this.asset, args.target, this.amount.toString());
    }
}

class Conversions {
    static PAIRS = {};
    static async enablePair(from, to) {
        if (!(from in Conversions.PAIRS)) Conversions.PAIRS[from] = new Set();
        Conversions.PAIRS[from].add(to);
    }
    static async loadPairs(api) {
        const pairs = await api.query.tradingPair.enabledSources.entries(0);
        const fromTo = pairs.map(p => p[0].args[1].toJSON());
        for (let entry of fromTo) {
            this.enablePair(entry.base_asset_id, entry.target_asset_id);
            this.enablePair(entry.target_asset_id, entry.base_asset_id);
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
        if (Conversions.PAIRS[from].has(to)) {
            out.push(to);
            return out;
        }
        const possibleResults = [];
        for (let target of Conversions.PAIRS[from]) {
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