// Minimal stub declarations for @nozbe/watermelondb so the mobile gantt
// WatermelonDB layer compiles before the dependency is npm-installed.
// Once the real package is installed (via `pnpm i` after merging the
// package.json change in this PR) these stubs are shadowed by the actual
// types — TypeScript prefers node_modules over .d.ts in src/.

declare module '@nozbe/watermelondb' {
  export class Model {
    id: string;
    [key: string]: unknown
  }
  export class Database {
    constructor(opts: { adapter: unknown; modelClasses: unknown[] })
    write<T>(action: () => Promise<T>): Promise<T>
    get<T extends Model>(table: string): Collection<T>
  }
  export class Collection<T extends Model = Model> {
    query(...args: unknown[]): Query<T>
    find(id: string): Promise<T>
    create(updater: (rec: T) => void): Promise<T>
  }
  export class Query<T extends Model = Model> {
    fetch(): Promise<T[]>
    fetchCount(): Promise<number>
    observe(): { subscribe(cb: (v: T[]) => void): { unsubscribe(): void } }
  }
  export const Q: {
    where: (...args: unknown[]) => unknown
    eq: (v: unknown) => unknown
    notEq: (v: unknown) => unknown
  }
}

declare module '@nozbe/watermelondb/Schema' {
  export interface ColumnSchema {
    name: string
    type: 'string' | 'number' | 'boolean'
    isOptional?: boolean
    isIndexed?: boolean
  }
  export interface TableSchema {
    name: string
    columns: ColumnSchema[]
  }
  export interface AppSchema {
    version: number
    tables: Record<string, TableSchema>
  }
  export function appSchema(opts: { version: number; tables: TableSchema[] }): AppSchema
  export function tableSchema(opts: TableSchema): TableSchema
}

declare module '@nozbe/watermelondb/adapters/sqlite' {
  export default class SQLiteAdapter {
    constructor(opts: { schema: import('@nozbe/watermelondb/Schema').AppSchema; dbName?: string; jsi?: boolean })
  }
}

declare module '@nozbe/watermelondb/decorators' {
  export const field: (name: string) => PropertyDecorator
  export const date: (name: string) => PropertyDecorator
  export const text: (name: string) => PropertyDecorator
  export const json: (name: string, sanitizer: (raw: unknown) => unknown) => PropertyDecorator
  export const readonly: PropertyDecorator
  export const action: MethodDecorator
}
