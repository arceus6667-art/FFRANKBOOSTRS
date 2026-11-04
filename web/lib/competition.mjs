export const LOBBY_LEAD_MS=15*60*1000;
export function lobbyRelease(starts) {return Number(starts)-LOBBY_LEAD_MS;}
export function lobbyAvailable(match,event,now=Date.now()) {
  return now>=lobbyRelease(match.starts)&&now<Number(match.starts)+6*3600000
    &&!['completed','cancelled'].includes(match.status)
    &&!['draft','cancelled','completed'].includes(event.status)&&!event.deleted;
}
