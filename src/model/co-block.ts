export interface CPBlockLog {
  rowid: string
  time: number
  user: number
  wid: number
  x: number
  y: number
  z: number
  type: number
  data: number
  meta: unknown
  blockdata: Buffer
  action: number
  rolled_back: number
}

export type CPBlockLogResult = CPBlockLog[]
