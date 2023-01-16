import fs from 'node:fs'

export const PATH = {
  CONFIG: process.env.CONFIG_PATH || './data/config.json',
  LAST_PAGE: process.env.LAST_PAGE_PATH || './data/last_page.txt',
  CREATE_SQLS: process.env.CREATE_SQLS_PATH || './data/createSQLs.sql',
  INSERT_SQLS_DIR: process.env.INSERT_SQLS_DIR || './data/insertSQLs/',
}

export interface Config {
  mysql: {
    host: string
    port: number
    user: string
    password: string
    database: string
  }
}

export function getConfig(): Config {
  if (!fs.existsSync(PATH.CONFIG)) {
    throw new Error('Config file not found')
  }
  return JSON.parse(fs.readFileSync(PATH.CONFIG, 'utf8'))
}
