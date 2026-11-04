export const games = [
  {id:'ffmax',name:'Free Fire MAX',short:'FF MAX',tag:'FAST. FEARLESS. COMPETITIVE.',color:'#ff7a36',description:'Clash Squad. Big plays. Your next rivalry starts here.',modes:['clash_squad']},
  {id:'bgmi',name:'Battlegrounds Mobile India',short:'BGMI',tag:'DROP IN. SQUAD UP. RISE.',color:'#dfb654',description:'Every rotation matters. Take your squad to the final circle.',modes:['battle_royale']},
  {id:'codm',name:'Call of Duty: Mobile',short:'COD MOBILE',tag:'PRECISION MEETS TEAMWORK.',color:'#94bd91',description:'Build your five. Make every round count.',modes:['team_deathmatch','search_destroy','hardpoint','control','battle_royale']},
] as const;
export const label = (value:string) => value.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
export const gameName = (id:string) => games.find(g=>g.id===id)?.name ?? id;
export const states:Record<string,string[]> = {draft:['registration_open','cancelled'],registration_open:['registration_closed','cancelled'],registration_closed:['upcoming','cancelled'],upcoming:['live','cancelled'],live:['completed','cancelled'],completed:[],cancelled:[]};
export type Row = Record<string, string|number|null>;
export class Problem extends Error { constructor(public status:number,message:string) {super(message);} }
export function expect(value:unknown,message:string,status=400):asserts value { if(!value) throw new Problem(status,message); }
export function str(value:unknown, min=1,max=200) {expect(typeof value==='string','Please enter valid text.');const s=value.trim();expect(s.length>=min&&s.length<=max,`Enter between ${min} and ${max} characters.`);return s;}
export function int(value:unknown,min=0,max=10000) {const n=Number(value);expect(Number.isInteger(n)&&n>=min&&n<=max,`Enter a whole number between ${min} and ${max}.`);return n;}
export function date(value:unknown) {const d=typeof value==='number'?value:Date.parse(String(value));expect(Number.isFinite(d)&&d>0,'Enter a valid date and time.');return d;}
export function validateEvent(e:Record<string,unknown>) {
  const game=str(e.game),mode=str(e.mode),size=int(e.size,1,5),format=str(e.format);
  const spec=games.find(g=>g.id===game); expect(spec&&spec.modes.some(m=>m===mode),'This game mode is not enabled.');
  const br=mode==='battle_royale';const sizes=game==='ffmax'?[1,2,4]:game==='bgmi'?[1,2,4]:br?[4]:[5];
  expect(sizes.includes(size),'This team size is not supported for the selected mode.');
  expect((br?['single','multi_match']:['single','knockout']).includes(format),'Unsupported event format.');
  const opens=date(e.opens),closes=date(e.closes),checkin=date(e.checkin),starts=date(e.starts);
  expect(opens<closes&&closes<=checkin&&checkin<=starts,'Times must follow: registration opens, closes, check-in deadline, match start.');
  return {game,mode,size,format,opens,closes,checkin,starts,capacity:int(e.capacity,2,512),title:str(e.title,4,100),description:str(e.description,10,4000)};
}
export function safeVideo(value:unknown) {if(!value)return '';const u=new URL(str(value,1,500));expect(u.protocol==='https:'&&['www.youtube.com','youtube.com','youtu.be','www.instagram.com','instagram.com'].includes(u.hostname),'Use an approved YouTube or Instagram HTTPS link.');return u.href;}
export function rulesFor(value:unknown,br:boolean) {
  const r=typeof value==='string'?JSON.parse(value):value;expect(r&&typeof r==='object','Rules are required.');
  const x=r as Record<string,unknown>;const placement=Array.isArray(x.placementPoints)?x.placementPoints.map(v=>int(v,0,1000)):[];
  expect(!br||placement.length>0&&placement.length<=100,'Battle Royale needs a placement points table.');
  return {text:str(x.text,10,6000),maps:str(x.maps??'Organizer selected',1,500),bestOf:int(x.bestOf??1,1,9),scoreLimit:int(x.scoreLimit??100,1,1000),roundLimit:int(x.roundLimit??12,1,100),placementPoints:placement,eliminationPoints:int(x.eliminationPoints??1,0,100),winPoints:int(x.winPoints??3,1,100),disputeHours:int(x.disputeHours??24,1,168),tieBreak:'points, wins, eliminations; unresolved ties share rank'};
}
