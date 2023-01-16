export interface CPUser {
  rowid: number
  user: string
  uuid: string
  time: number
}

export type CPUserResult = CPUser[]
