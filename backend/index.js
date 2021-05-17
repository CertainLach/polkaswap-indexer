const { ApiPromise, WsProvider } = require('@polkadot/api');
const express = require('express');
const { buildSchema } = require('graphql');
const { graphqlHTTP } = require('express-graphql');
const pg = require('pg');
let port = 8080;

let schema = buildSchema(`
    type Query {
        exchanges(caller: String!, offset: Int, limit: Int): Exchanges!,
        asset(id: String!): Asset,
    }
    
    type Exchanges {
        count: Int!,
        exchanges: [Exchange!],
    }

    type Exchange {
        id: String!,
        blockId: Int!,
        extrinsicIndex: Int!,
        source: String!,
        sourceAsset: Asset!,
        sourceAmount: String!,
        sourceAmountWithPrecision: String!,
        target: String!,
        targetAsset: Asset!,
        targetAmount: String!,
        targetAmountWithPrecision: String!,
    }

    type Asset {
        name: String!,
        precision: Int!,
    }
`);

function formatPrecision(num, precision) {
    num = num.padStart(precision + 1, '0');

    return num.slice(0, -precision) + '.' + num.slice(-precision);
}

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
    async sourceAsset() {
        return await Asset.load(this.api, this.source);
    }
    async sourceAmountWithPrecision() {
        return formatPrecision(this.sourceAmount, (await this.sourceAsset()).precision);
    }
    async targetAsset() {
        return await Asset.load(this.api, this.target);
    }
    async targetAmountWithPrecision() {
        return formatPrecision(this.targetAmount, (await this.targetAsset()).precision);
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
    });

    const app = express();
    app.use('/', graphqlHTTP({
        schema: schema,
        rootValue: new SchemaRoot(pool, api),
        graphiql: true,
    }));

    app.listen(port);
}

main().catch(console.error);