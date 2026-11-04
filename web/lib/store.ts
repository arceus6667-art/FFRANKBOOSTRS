import { env } from 'cloudflare:workers';
import { Problem, type Row } from './domain';
export function db() {if(!env.DB)throw new Problem(503,'The platform database is temporarily unavailable.');return env.DB;}
export function statement(sql:string,values:unknown[]=[]) {return db().prepare(sql).bind(...values);}
export async function all<T=Row>(sql:string,values:unknown[]=[]):Promise<T[]> {return (await statement(sql,values).all<T>()).results;}
export async function one<T=Row>(sql:string,values:unknown[]=[]):Promise<T|null> {return statement(sql,values).first<T>();}
export async function run(sql:string,values:unknown[]=[]) {return statement(sql,values).run();}
export const uid=()=>crypto.randomUUID();
export function auditStatement(actor:string,action:string,subject:string) {return statement('INSERT INTO audit (id,actor,action,subject,created) VALUES (?,?,?,?,?)',[uid(),actor,action,subject,Date.now()]);}
export function notifyStatement(player:string,message:string) {return statement('INSERT INTO notifications (id,player,message,created) VALUES (?,?,?,?)',[uid(),player,message,Date.now()]);}
export function config() {return env as unknown as Record<string,string|undefined>;}
