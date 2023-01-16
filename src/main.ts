import { getConfig, PATH } from './config'
import {
  getBlockLogCount,
  getBlockLogs,
  getMaterials,
  getUsers,
} from './library'
import { getDBConnection } from './mysql'
import mysql from 'mysql2/promise'
import fs from 'node:fs'
import cliProgress from 'cli-progress'
import { join } from 'node:path'

type Users = {
  [key: number]: {
    username: string
    uuid: string
  }
}

async function fetchUsers(database: mysql.Connection): Promise<Users> {
  const users = await getUsers(database)
  const result: Users = {}
  for (const user of users) {
    result[user.rowid] = {
      username: user.user,
      uuid: user.uuid,
    }
  }
  return result
}

type Materials = {
  [key: number]: string
}

async function fetchMaterials(database: mysql.Connection): Promise<Materials> {
  const materials = await getMaterials(database)
  const result: Materials = {}
  for (const material of materials) {
    result[material.rowid] = material.material
  }
  return result
}

function formatDateTime(date: Date) {
  // YYYY-MM-DD HH:MM:SS
  return [
    date.getFullYear(),
    '/',
    ('0' + (date.getMonth() + 1)).slice(-2),
    '/',
    ('0' + date.getDate()).slice(-2),
    ' ',
    ('0' + date.getHours()).slice(-2),
    ':',
    ('0' + date.getMinutes()).slice(-2),
    ':',
    ('0' + date.getSeconds()).slice(-2),
  ].join('')
}

function getCreateSql(databaseName: string, tableName: string) {
  return `CREATE TABLE IF NOT EXISTS \`${databaseName}.${tableName}\` (
      \`rowid\` INT NOT NULL AUTO_INCREMENT,
      \`time\` INT(10) NOT NULL,
      \`username\` VARCHAR(16) NOT NULL,
      \`uuid\` VARCHAR(36) NOT NULL,
      \`x\` INT(8) NOT NULL,
      \`y\` INT(3) NOT NULL,
      \`z\` INT(8) NOT NULL,
      \`block\` TEXT NOT NULL,
      \`data\` INT(8) NOT NULL,
      \`action\` INT(2) NOT NULL,
      \`rolled_back\` BOOLEAN NOT NULL,
      PRIMARY KEY (\`rowid\`),
      INDEX (\`time\`),
      INDEX (\`uuid\`),
      INDEX (\`x\`),
      INDEX (\`z\`)
  ) ENGINE = InnoDB;`
}

function getInsertSql(
  databaseName: string,
  tableName: string,
  log: {
    time: number
    username: string
    uuid: string
    x: number
    y: number
    z: number
    block: string
    data: number
    action: number
    rolledBack: boolean
  }
) {
  return `INSERT INTO \`${databaseName}.${tableName}\` (
    \`time\`,
    \`username\`,
    \`uuid\`,
    \`x\`,
    \`y\`,
    \`z\`,
    \`block\`,
    \`data\`,
    \`action\`,
    \`rolled_back\`
  ) VALUES (
    '${log.time}',
    '${log.username}',
    '${log.uuid}',
    '${log.x}',
    '${log.y}',
    '${log.z}',
    '${log.block}',
    '${log.data}',
    '${log.action}',
    '${log.rolledBack}'
  )`
}

async function main() {
  const config = getConfig()
  const database = await getDBConnection(config)
  if (!database) {
    throw new Error('DB connection failed')
  }

  if (!fs.existsSync(PATH.INSERT_SQLS_DIR)) {
    fs.mkdirSync(PATH.INSERT_SQLS_DIR)
  }

  try {
    const users = await fetchUsers(database)
    const materials = await fetchMaterials(database)

    const pagePerRow = 100_000

    let page = 0

    // リジューム処理: /data/last_page.txt に最後に処理したページ番号が記録されている
    if (fs.existsSync(PATH.LAST_PAGE)) {
      page = Number.parseInt(fs.readFileSync(PATH.LAST_PAGE, 'utf8'))
      const startId = page * pagePerRow
      const endId = startId + pagePerRow
      console.log(`Resuming from page ${page} (${startId} - ${endId})`)
    }

    const multibar = new cliProgress.MultiBar(
      {
        clearOnComplete: false,
        hideCursor: true,
        format:
          '{bar} {percentage}% | ETA: {eta_formatted} | {value}/{total} ({datetime})',
        formatTime: (time) => {
          const seconds = Math.floor(time / 1000)
          const minutes = Math.floor(seconds / 60)
          const hours = Math.floor(minutes / 60)
          return `${hours}h ${minutes % 60}m ${seconds % 60}s`
        },
      },
      cliProgress.Presets.shades_classic
    )

    const blockLogCount = await getBlockLogCount(database)
    const mainBar = multibar.create(blockLogCount, 0)

    const creates: string[] = []
    while (true) {
      multibar.log(`Processing page ${page}`)
      mainBar.updateETA()

      const startId = page * pagePerRow
      const endId = startId + pagePerRow

      const blockLogs = await getBlockLogs(database, startId, endId)

      let isFirst = true
      const createSqls = []
      const insertSqls = []

      let newTableName
      for (const blockLog of blockLogs) {
        const {
          // rowid,
          time,
          user: userId,
          wid,
          x,
          y,
          z,
          type: typeId,
          data,
          action,
          rolled_back: rolledBackNumber,
          rowid,
        } = blockLog

        const date = new Date(time * 1000)
        const datetime = formatDateTime(date)
        try {
          isFirst = false

          const user = users[userId]
          if (user === undefined) {
            throw new Error(`User not found: ${userId}`)
          }
          const username = user.username
          const uuid = user.uuid
          const material = (materials[typeId] ?? typeId.toString()).replace(
            /^minecraft:/,
            ''
          )
          // 設置と破壊以外は無視
          if (action !== 0 && action !== 1) {
            continue
          }
          // const actionName = action === 1 ? 'placed' : 'destroyed'
          const rolledBack = rolledBackNumber === 1

          if (wid !== 1) {
            continue
          }

          const month = Math.floor((date.getMonth() - 1) / 3) * 3 + 1
          newTableName = `${date.getFullYear()}${String(month).padStart(
            2,
            '0'
          )}`
          const createSql = getCreateSql('CoreProtect_MainOLD', newTableName)
          if (!creates.includes(newTableName)) {
            creates.push(newTableName)
            createSqls.push(createSql)
          }

          const insertSql = getInsertSql('CoreProtect_MainOLD', newTableName, {
            time,
            username,
            uuid,
            x,
            y,
            z,
            block: material,
            data,
            action,
            rolledBack,
          })
          insertSqls.push(insertSql)
        } catch (error) {
          multibar.log(`Error: ${(error as Error).message}`)
        } finally {
          mainBar.update(Number.parseInt(rowid, 10), {
            datetime,
          })
        }
      }

      if (newTableName === null || isFirst) {
        break
      }

      if (createSqls.length > 0) {
        fs.appendFileSync(PATH.CREATE_SQLS, createSqls.join('\n') + '\n')
      }
      if (insertSqls.length > 0) {
        fs.appendFileSync(
          join(PATH.INSERT_SQLS_DIR, `insertSQL_${newTableName}.sql`),
          insertSqls.join('\n') + '\n'
        )
      }
      fs.writeFileSync(PATH.LAST_PAGE, page.toString())

      page++
    }
  } catch (error) {
    console.error(error)
  }

  database.destroy()
}

;(async () => {
  await main()
})()
