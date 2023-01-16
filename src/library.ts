import mysql, { RowDataPacket } from 'mysql2/promise'
import { CPBlockLogResult } from './model/co-block'
import { CPMaterialResult } from './model/co-material-map'
import { CPUserResult } from './model/co-user'

export async function getUsers(database: mysql.Connection): Promise<CPUserResult> {
  const [rows] = (await database.query('SELECT * FROM co_user')) as RowDataPacket[][]
  return rows as CPUserResult
}

export async function getMaterials(
  database: mysql.Connection
): Promise<CPMaterialResult> {
  const [rows] = (await database.query(
    'SELECT * FROM co_material_map'
  )) as RowDataPacket[][]
  return rows as CPMaterialResult
}

export async function getBlockLogs(
  database: mysql.Connection,
  startId: number,
  endId: number
): Promise<CPBlockLogResult> {
  const [rows] = (await database.query(
    'SELECT * FROM co_block WHERE rowid BETWEEN ? AND ?',
    [startId, endId]
  )) as RowDataPacket[][]
  return rows as CPBlockLogResult
}

export async function getBlockLogCount(database: mysql.Connection): Promise<number> {
  // 最後のrowidを取得
  const [rows] = (await database.query(
    'SELECT MAX(rowid) AS max FROM co_block'
  )) as RowDataPacket[][]
  return rows[0].max as number
}
