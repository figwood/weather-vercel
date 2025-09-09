declare module '@vercel/kv' {
  // Minimal type surface needed for this project
  export const kv: {
    get<T = any>(key: string): Promise<T | null>;
    set(key: string, value: any, opts?: { ex?: number; px?: number; nx?: boolean; xx?: boolean }): Promise<any>;
    del(key: string): Promise<any>;
    sadd(key: string, ...members: string[]): Promise<number>;
    smembers<T = string>(key: string): Promise<T[]>;
    mget<T = any>(...keys: string[]): Promise<(T | null)[]>;
  };
}
