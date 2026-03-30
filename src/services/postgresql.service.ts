import { Pool, PoolConfig, QueryResult } from 'pg';
import { logger } from '../utils/logger';

const CMD_ACCESS_TABLE = 'cmd_access_table';
const QUERY_CMD_ACCESS = `SELECT * FROM ${CMD_ACCESS_TABLE}`;

export interface CmdData {
    cmd: string;
    params: string;
    user_id: number;
    group_id: number;
    received_time?: Date;
    response_time?: Date;
    elapse_time: number;
}

export class PostgreSQLService {
    static inst: PostgreSQLService;
    private pool: Pool;

    constructor() {
        const config: PoolConfig = {
            host: process.env.PG_HOST,
            port: process.env.PG_PORT ? parseInt(process.env.PG_PORT) : 5432,
            database: process.env.PG_DB,
            user: process.env.PG_USER,
            password: process.env.PG_PASSWORD,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
            statement_timeout: 10000,
        };

        this.pool = new Pool(config);

        this.pool.on('error', (err) => {
            logger.error('Unexpected error on PostgreSQL client', err);
        });

        this.pool.on('connect', () => {
            logger.info('PostgreSQL pool connected');
        });

        logger.info('PostgreSQL connection pool initialized');
    }

    async query<T extends Record<string, any> = any>(
        sql: string,
        params?: any[],
    ): Promise<QueryResult<T>> {
        return this.pool.query<T>(sql, params);
    }

    async queryCmd(sql?: string): Promise<any[]> {
        logger.info('queryCmd', sql);
        const queryRes = await this.pool.query(sql ?? QUERY_CMD_ACCESS);
        logger.info('queryCmd OK', queryRes.rows);
        return queryRes.rows;
    }

    async insertCmdData(data: CmdData) {
        logger.info('insertCmdData', data);

        const query = `
            INSERT INTO ${CMD_ACCESS_TABLE}
            (cmd, params, user_id, group_id, received_time, response_time, elapse_time)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;

        const res = await this.pool.query(query, [
            data.cmd,
            data.params,
            data.user_id,
            data.group_id,
            data.received_time || new Date(),
            data.response_time || new Date(),
            data.elapse_time,
        ]);

        logger.info('insertCmdData OK');
        return res;
    }

    static getInst(): PostgreSQLService {
        if (!PostgreSQLService.inst) {
            PostgreSQLService.inst = new PostgreSQLService();
        }
        return PostgreSQLService.inst;
    }

    async close(): Promise<void> {
        logger.info('Closing PostgreSQL connection pool...');
        await this.pool.end();
        logger.info('PostgreSQL connection pool closed');
    }
}
