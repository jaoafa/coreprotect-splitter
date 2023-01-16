import mysql from 'mysql2/promise'
import { Config } from './config'

export async function getDBConnection(
  config: Config
): Promise<mysql.Connection | undefined> {
  try {
    const connection = await mysql.createConnection({
      host: config.mysql.host,
      port: config.mysql.port,
      user: config.mysql.user,
      password: config.mysql.password,
      database: config.mysql.database,
      timezone: '+09:00',
      supportBigNumbers: true,
      bigNumberStrings: true,
    })
    await connection.beginTransaction()

    return connection
  } catch (error) {
    console.error(error)
    return undefined
  }
}
