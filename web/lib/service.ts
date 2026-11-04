import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
import { all, one, run, statement, db, uid, auditStatement, notifyStatement, config } from './store';
import { identity, requirePlayer, requireRole, rateLimit, currentTeams } from './identity';
import { expect, str, int, date, validateEvent, rulesFor, safeVideo, states, Problem, type Row } from './domain';

export async function bootstrap() {
  const [user,tournaments,announcements,settings,leaderboard] = await Promise.all([
    identity(),all(`SELECT t.*,p.name organizer_name,(SELECT COUNT(*) FROM registrations r WHERE r.tournament=t.id) registered FROM tournaments t JOIN players p ON p.id=t.organizer WHERE t.status<>'draft' AND t.archived=0 ORDER BY starts LIMIT 200`),
    all('SELECT * FROM announcements ORDER BY created DESC LIMIT 20'),all("SELECT * FROM settings WHERE key IN ('support','instagram','youtube','apk','community')"),
    all(`SELECT p.code,p.name,t.game,t.id tournament,t.title tournament_title, SUM(r.points) points,SUM(r.won) wins,SUM(r.eliminations) eliminations,COUNT(*) played FROM results r JOIN entrants e ON e.registration=r.registration JOIN players p ON p.id=e.player JOIN matches m ON m.id=r.match JOIN tournaments t ON t.id=m.tournament WHERE r.status='verified' GROUP BY p.id,t.game,t.id ORDER BY points DESC,wins DESC,eliminations DESC LIMIT 1000`),
  ]);
  const teamLeaderboard=await all(`SELECT tm.id,tm.name,t.game,t.id tournament,t.title tournament_title,SUM(r.points) points,SUM(r.won) wins,SUM(r.eliminations) eliminations,COUNT(*) played FROM results r JOIN registrations reg ON reg.id=r.registration JOIN teams tm ON tm.id=reg.team JOIN matches m ON m.id=r.match JOIN tournaments t ON t.id=m.tournament WHERE r.status='verified' GROUP BY tm.id,t.game,t.id ORDER BY points DESC,wins DESC,eliminations DESC LIMIT 1000`);
  return {user,tournaments,announcements,settings,leaderboard,teamLeaderboard,emailAuth:!!(config().SUPABASE_URL&&config().SUPABASE_PUBLISHABLE_KEY)};
}
export async function workspace() {
  const p=await requirePlayer(),id=String(p.id);
  const [identities,teams,invitations,registrations,matches,results,notifications] = await Promise.all([
    all('SELECT * FROM identities WHERE player=?',[id]),currentTeams(id),
    all("SELECT i.*,t.name,t.game FROM invitations i JOIN teams t ON t.id=i.team WHERE i.player=? AND i.status='pending' AND i.expires>?",[id,Date.now()]),
    all('SELECT r.*,t.title,t.game,t.status,t.starts,t.checkin FROM registrations r JOIN entrants e ON e.registration=r.id JOIN tournaments t ON t.id=r.tournament WHERE e.player=? ORDER BY t.starts',[id]),
    all(`SELECT m.id,m.tournament,m.title,m.starts,m.checkin,m.release,m.status,t.title tournament_title,t.game,c.created checked FROM matches m JOIN tournaments t ON t.id=m.tournament JOIN entrants e ON e.tournament=t.id LEFT JOIN checkins c ON c.match=m.id AND c.player=e.player WHERE e.player=? AND (json_array_length(m.participants)=0 OR e.registration IN (SELECT value FROM json_each(m.participants))) ORDER BY m.starts`,[id]),
    all('SELECT r.*,m.title,m.tournament,t.game FROM results r JOIN entrants e ON e.registration=r.registration JOIN matches m ON m.id=r.match JOIN tournaments t ON t.id=m.tournament WHERE e.player=? ORDER BY r.created DESC',[id]),
    all('SELECT * FROM notifications WHERE player=? ORDER BY created DESC LIMIT 100',[id]),
  ]);
  const roster=teams.length?await all(`SELECT m.team,p.code,p.name,p.id,p.adult,p.consent FROM members m JOIN players p ON p.id=m.player WHERE m.team IN (SELECT team FROM members WHERE player=?)`,[id]):[];
  const disputes=await all('SELECT d.*,m.title FROM disputes d JOIN results r ON r.id=d.result JOIN matches m ON m.id=r.match WHERE d.player=? ORDER BY d.created DESC',[id]);
  return {user:p,identities,teams,roster,invitations,registrations,matches,results,notifications,disputes};
}
export async function adminData() {
  const p=await requireRole('admin','moderator');
  const queries:Record<string,string>={
    tournaments:'SELECT t.*,p.name organizer_name,(SELECT COUNT(*) FROM registrations r WHERE r.tournament=t.id) registered FROM tournaments t JOIN players p ON p.id=t.organizer ORDER BY t.created DESC LIMIT 500',
    players:'SELECT id,code,name,region,game,role,adult,consent,created FROM players ORDER BY created DESC LIMIT 500',
    teams:'SELECT t.*,p.name captain_name,(SELECT COUNT(*) FROM members m WHERE m.team=t.id) members FROM teams t JOIN players p ON p.id=t.captain ORDER BY t.created DESC LIMIT 500',
    registrations:'SELECT r.*,t.title,p.name captain_name FROM registrations r JOIN tournaments t ON t.id=r.tournament JOIN players p ON p.id=r.captain ORDER BY r.created DESC LIMIT 500',
    matches:'SELECT m.*,t.title tournament_title,t.game FROM matches m JOIN tournaments t ON t.id=m.tournament ORDER BY starts LIMIT 500',
    results:'SELECT r.*,m.title,p.name submitter_name,t.game,t.rules FROM results r JOIN matches m ON m.id=r.match JOIN tournaments t ON t.id=m.tournament JOIN players p ON p.id=r.submitter ORDER BY r.created DESC LIMIT 500',
    disputes:'SELECT d.*,p.name,m.title FROM disputes d JOIN players p ON p.id=d.player JOIN results r ON r.id=d.result JOIN matches m ON m.id=r.match ORDER BY d.created DESC LIMIT 500',
    announcements:'SELECT * FROM announcements ORDER BY created DESC LIMIT 100',
    audit:'SELECT a.*,p.name FROM audit a JOIN players p ON p.id=a.actor ORDER BY a.created DESC LIMIT 300',
    support:'SELECT s.*,p.name,p.code FROM support s JOIN players p ON p.id=s.player ORDER BY s.created DESC LIMIT 300',settings:'SELECT * FROM settings',assets:'SELECT id,type,size,created FROM assets ORDER BY created DESC LIMIT 100',
  };
  const output:Record<string,unknown>={user:p};
  await Promise.all(Object.entries(queries).filter(([key])=>p.role==='admin'||['results','disputes','tournaments'].includes(key)).map(async([key,sql])=>{output[key]=await all(sql);}));
  return output;
}
export async function lobby(matchId:string) {
  const p=await requirePlayer(),id=String(p.id),m=await one('SELECT * FROM matches WHERE id=?',[matchId]);expect(m,'Match not found.',404);
  if(p.role!=='admin') {
    expect(await one('SELECT 1 FROM entrants WHERE tournament=? AND player=? AND (json_array_length(?)=0 OR registration IN (SELECT value FROM json_each(?)))',[m.tournament,id,m.participants,m.participants]),'This lobby is for assigned registered players.',403);
    expect(await one('SELECT 1 FROM checkins WHERE match=? AND player=?',[matchId,id]),'Check in before accessing the lobby.',403);
    expect(Date.now()>=Number(m.release)&&Date.now()<Number(m.starts)+6*3600000&&m.status!=='completed'&&m.status!=='cancelled','Lobby details are not available in this time window.',403);
    const t=await one('SELECT status FROM tournaments WHERE id=?',[m.tournament]);expect(t&&['upcoming','live'].includes(String(t.status)),'Lobby is unavailable for this event status.',403);
  }
  expect(m.room,'The organizer has not released room credentials yet.',409);
  await auditStatement(id,'lobby.access',matchId).run();
  return {room:m.room,instructions:m.instructions};
}

export async function mutate(action:string,b:Record<string,unknown>,request:Request) {
  if(action.startsWith('auth/'))return authAction(action,b,request);
  const p=await requirePlayer(),actor=String(p.id),now=Date.now();await rateLimit(actor);
  const admin=()=>expect(p.role==='admin','Administrator access required.',403);
  const reviewer=()=>expect(['admin','moderator'].includes(String(p.role)),'Moderator access required.',403);
  const id=()=>str(b.id,1,100);
  if(action==='profile') {
    const name=str(b.name,2,40),region=str(b.region,2,80),game=str(b.game);expect(['ffmax','bgmi','codm'].includes(game),'Choose a supported game.');
    expect(b.adult===true&&b.consent===true,'You must be 18 or older and accept the terms and privacy policy to compete.');
    await db().batch([statement("UPDATE players SET name=?,region=?,game=?,adult=1,consent='2026-11-v1' WHERE id=?",[name,region,game,actor]),auditStatement(actor,'profile.consent','2026-11-v1')]);
    return {message:'Profile saved. Your private game UID is visible only to you.'};
  }
  if(action==='game-profile') {
    const game=str(b.game);expect(['ffmax','bgmi','codm'].includes(game),'Choose a supported game.');
    await run('INSERT INTO identities (id,player,game,name,uid) VALUES (?,?,?,?,?) ON CONFLICT(player,game) DO UPDATE SET name=excluded.name,uid=excluded.uid',[uid(),actor,game,str(b.name,1,64),str(b.uid,1,64)]);
    return {message:'Private game identity saved.'};
  }
  if(action==='teams/create') {
    expect(p.adult&&p.consent,'Complete your player profile first.');
    const game=str(b.game);expect(['ffmax','bgmi','codm'].includes(game),'Unsupported game.');
    const team=uid();await db().batch([statement('INSERT INTO teams (id,name,game,captain,created) VALUES (?,?,?,?,?)',[team,str(b.name,2,40),game,actor,now]),statement('INSERT INTO members (id,team,player,joined) VALUES (?,?,?,?)',[uid(),team,actor,now])]);
    return {message:'Team created. Invite your teammates using their RankForge player IDs.'};
  }
  if(action==='teams/invite') {
    const team=await one('SELECT * FROM teams WHERE id=?',[id()]);expect(team&&team.captain===actor,'Only the team captain can invite players.',403);
    const target=await one('SELECT id FROM players WHERE code=?',[str(b.code).toUpperCase()]);expect(target,'That player ID was not found.',404);
    expect(!await one('SELECT id FROM members WHERE team=? AND player=?',[team.id,target.id]),'Player is already a member.');
    expect(!await one("SELECT id FROM invitations WHERE team=? AND player=? AND status='pending' AND expires>?",[team.id,target.id,now]),'An invitation is already pending.');
    await db().batch([statement('INSERT INTO invitations (id,team,player,expires) VALUES (?,?,?,?)',[uid(),team.id,target.id,now+7*86400000]),notifyStatement(String(target.id),`You have been invited to ${team.name}. Open My Teams to respond.`)]);
    return {message:'Invitation sent.'};
  }
  if(action==='teams/respond') {
    const invite=await one("SELECT * FROM invitations WHERE id=? AND player=? AND status='pending' AND expires>?",[id(),actor,now]);expect(invite,'Invitation expired or is no longer available.');
    const accepted=b.accept===true;
    await db().batch([...(accepted?[statement("INSERT OR IGNORE INTO members (id,team,player,joined) SELECT ?,team,player,? FROM invitations WHERE id=? AND player=? AND status='pending' AND expires>?",[uid(),now,invite.id,actor,now])]:[]),statement("UPDATE invitations SET status=? WHERE id=? AND status='pending'",[accepted?'accepted':'declined',invite.id])]);
    return {message:accepted?'You joined the squad.':'Invitation declined.'};
  }
  if(action==='teams/leave') {
    const team=await one('SELECT * FROM teams WHERE id=?',[id()]);expect(team,'Team not found.',404);
    if(team.captain===actor)expect(!await one('SELECT id FROM members WHERE team=? AND player<>?',[team.id,actor]),'Transfer captaincy before leaving a team with other members.');
    await run('DELETE FROM members WHERE team=? AND player=?',[team.id,actor]);return {message:'You left the team. Existing tournament rosters remain unchanged.'};
  }
  if(action==='teams/captain') {
    const team=await one('SELECT * FROM teams WHERE id=?',[id()]);expect(team?.captain===actor,'Only the captain can transfer captaincy.',403);
    expect(await one('SELECT id FROM members WHERE team=? AND player=?',[team.id,str(b.player)]),'Choose a current roster member.');
    await db().batch([statement('UPDATE teams SET captain=? WHERE id=?',[b.player,team.id]),auditStatement(actor,'team.captain_transfer',String(team.id))]);return {message:'Captaincy transferred.'};
  }
  if(action==='tournaments/register') {
    const t=await one('SELECT * FROM tournaments WHERE id=?',[id()]);expect(t,'Tournament not found.',404);
    expect(t.status==='registration_open'&&now>=Number(t.opens)&&now<Number(t.closes)&&!t.archived,'Registration is not open.');
    const teamId=b.team?str(b.team):null;let roster=[actor];
    if(Number(t.size)>1) {
      expect(teamId,'Select a team.');const team=await one('SELECT * FROM teams WHERE id=?',[teamId]);expect(team&&team.captain===actor&&team.game===t.game,'Choose a compatible team that you captain.');
      expect(Array.isArray(b.roster)&&b.roster.length===Number(t.size),'Select the exact eligible roster size.');
      roster=(b.roster as unknown[]).map(v=>str(v));expect(new Set(roster).size===roster.length&&roster.includes(actor),'Roster must include the captain and unique players.');
      const members=await all('SELECT player FROM members WHERE team=?',[teamId]);expect(roster.every(v=>members.some(m=>m.player===v)),'Roster includes a non-member.');
    }
    for(const player of roster) {
      const eligible=await one('SELECT p.adult,p.consent,i.uid FROM players p LEFT JOIN identities i ON i.player=p.id AND i.game=? WHERE p.id=?',[t.game,player]);
      expect(eligible?.adult&&eligible.consent&&eligible.uid,'Every roster member needs an eligible profile and private game UID.');
    }
    const reg=uid();
    await db().batch([statement('INSERT INTO registrations (id,tournament,captain,team,roster,created) VALUES (?,?,?,?,?,?)',[reg,t.id,actor,teamId,JSON.stringify(roster),now]),...roster.map(player=>statement('INSERT INTO entrants (id,registration,tournament,player) VALUES (?,?,?,?)',[uid(),reg,t.id,player])),...roster.map(player=>notifyStatement(player,`Registered for ${t.title}. Check the match schedule before check-in.`))]);
    return {message:'Registration confirmed. Find your event in My Matches.'};
  }
  if(action==='tournaments/cancel-registration') {
    const r=await one('SELECT r.*,t.closes,t.status FROM registrations r JOIN tournaments t ON t.id=r.tournament WHERE r.id=?',[id()]);expect(r?.captain===actor,'Only the registering captain can withdraw.',403);
    expect(now<Number(r.closes)&&r.status==='registration_open','Withdrawal closes with registration. Contact support after the deadline.');
    await db().batch([statement('DELETE FROM entrants WHERE registration=?',[r.id]),statement('DELETE FROM registrations WHERE id=?',[r.id]),auditStatement(actor,'registration.withdraw',String(r.id))]);return {message:'Registration withdrawn.'};
  }
  if(action==='matches/check-in') {
    const m=await one('SELECT m.*,t.status event_status FROM matches m JOIN tournaments t ON t.id=m.tournament WHERE m.id=?',[id()]);expect(m,'Match not found.',404);
    expect(['upcoming','live','registration_closed'].includes(String(m.event_status))&&m.status==='upcoming'&&now<Number(m.checkin)&&now>=Number(m.starts)-24*3600000,'Check-in is available in the 24 hours before the match, until its deadline.');
    expect(await one('SELECT 1 FROM entrants WHERE tournament=? AND player=? AND (json_array_length(?)=0 OR registration IN (SELECT value FROM json_each(?)))',[m.tournament,actor,m.participants,m.participants]),'You are not assigned to this match.',403);
    await run('INSERT OR IGNORE INTO checkins (id,match,player,created) VALUES (?,?,?,?)',[uid(),m.id,actor,now]);return {message:'You are checked in. Lobby access opens at the scheduled release time.'};
  }
  if(action==='results/submit') {
    const m=await one('SELECT m.*,t.status event_status FROM matches m JOIN tournaments t ON t.id=m.tournament WHERE m.id=?',[str(b.match)]);expect(m,'Match not found.',404);
    expect(now>=Number(m.starts)&&['live','completed'].includes(String(m.event_status)),'Results open after the event starts.');
    const reg=await one('SELECT r.* FROM registrations r JOIN entrants e ON e.registration=r.id WHERE r.tournament=? AND e.player=?',[m.tournament,actor]);expect(reg,'Only registered participants can submit results.',403);const assigned=JSON.parse(String(m.participants)) as string[];expect(!assigned.length||assigned.includes(String(reg.id)),'Your entry is not assigned to this match.',403);
    const evidence=b.evidence?str(b.evidence):'';if(evidence)expect(await one('SELECT id FROM assets WHERE id=? AND owner=?',[evidence,actor]),'Evidence file is not yours.',403);
    await run('INSERT INTO results (id,match,registration,submitter,placement,eliminations,won,evidence,created) VALUES (?,?,?,?,?,?,?,?,?)',[uid(),m.id,reg.id,actor,int(b.placement,1,512),int(b.eliminations,0,1000),b.won===true?1:0,evidence,now]);return {message:'Result submitted. It will remain pending until independently verified.'};
  }
  if(action==='disputes/create') {
    const result=await one('SELECT r.*,m.tournament,t.rules FROM results r JOIN matches m ON m.id=r.match JOIN tournaments t ON t.id=m.tournament WHERE r.id=?',[str(b.result)]);expect(result,'Result not found.',404);
    expect(await one('SELECT id FROM entrants WHERE tournament=? AND player=?',[result.tournament,actor]),'Only event participants can report a dispute.',403);
    const rules=JSON.parse(String(result.rules));expect(now-Number(result.created)<=rules.disputeHours*3600000,'The published dispute window has closed.');
    expect(!await one("SELECT id FROM disputes WHERE result=? AND status='open'",[result.id]),'An open dispute already exists.');
    await db().batch([statement('INSERT INTO disputes (id,result,player,reason,created) VALUES (?,?,?,?,?)',[uid(),result.id,actor,str(b.reason,10,2000),now]),statement("UPDATE results SET status='disputed' WHERE id=?",[result.id]),auditStatement(actor,'result.disputed',String(result.id))]);return {message:'Dispute opened. This result is excluded from standings until reviewed.'};
  }
  if(action==='support/create') {const ticket=uid(),kind=str(b.kind);expect(['account','privacy','fair_play','other'].includes(kind),'Choose a valid support category.');await db().batch([statement('INSERT INTO support (id,player,kind,subject,message,created) VALUES (?,?,?,?,?,?)',[ticket,actor,kind,str(b.subject,5,120),str(b.message,10,4000),now]),notifyStatement(actor,`Support request received: ${ticket}. A response will appear in Notifications.`)]);return {message:`Request received. Reference: ${ticket}. Watch Notifications for a response.`};}
  if(action==='admin/support') {admin();const ticket=await one('SELECT * FROM support WHERE id=?',[id()]);expect(ticket,'Support request not found.',404);const response=str(b.response,10,4000);await db().batch([statement("UPDATE support SET status='responded',response=? WHERE id=?",[response,ticket.id]),notifyStatement(String(ticket.player),`Support response (${ticket.subject}): ${response}`),auditStatement(actor,'support.respond',String(ticket.id))]);return {message:'Response saved and delivered to the player’s notifications.'};}
  if(action==='notifications/read') {await run('UPDATE notifications SET read=1 WHERE player=?',[actor]);return {message:'Notifications marked as read.'};}

  if(action==='admin/tournaments') {
    admin();const t=validateEvent(b),rules=rulesFor(b.rules,t.mode==='battle_royale');
    const eventId=b.id?str(b.id):uid();const old=b.id?await one('SELECT * FROM tournaments WHERE id=?',[eventId]):null;
    if(old)expect(old.status==='draft','Published rules and rosters are locked. Use postpone or cancel for published events.');
    const columns=Object.keys(t),values=Object.values(t);
    await db().batch([old?statement(`UPDATE tournaments SET ${columns.map(c=>`${c}=?`).join(',')},rules=? WHERE id=?`,[...values,JSON.stringify(rules),eventId]):statement(`INSERT INTO tournaments (id,${columns.join(',')},rules,organizer,created) VALUES (${Array(columns.length+4).fill('?').join(',')})`,[eventId,...values,JSON.stringify(rules),actor,now]),auditStatement(actor,old?'tournament.edit':'tournament.create',eventId)]);
    return {message:'Tournament draft saved. Review it before opening registration.'};
  }
  if(action==='admin/event-state') {
    admin();const t=await one('SELECT * FROM tournaments WHERE id=?',[id()]);expect(t,'Event not found.',404);const status=str(b.status);
    expect(states[String(t.status)]?.includes(status),'Use the next valid tournament state.');if(status==='live')expect(now>=Number(t.starts),'The event cannot go live before its scheduled start.');
    if(status==='completed')expect(!await one("SELECT r.id FROM results r JOIN matches m ON m.id=r.match WHERE m.tournament=? AND r.status IN ('pending','disputed')",[t.id]),'Resolve pending and disputed results before completing the event.');
    const entrants=await all('SELECT DISTINCT player FROM entrants WHERE tournament=?',[t.id]);
    await db().batch([statement('UPDATE tournaments SET status=? WHERE id=?',[status,t.id]),auditStatement(actor,`tournament.${status}`,String(t.id)),...entrants.map(e=>notifyStatement(String(e.player),`${t.title}: status changed to ${status.replaceAll('_',' ')}.`))]);return {message:'Tournament status updated.'};
  }
  if(action==='admin/postpone') {
    admin();const t=await one('SELECT * FROM tournaments WHERE id=?',[id()]);expect(t&&!['completed','cancelled'].includes(String(t.status)),'This event cannot be postponed.');
    const starts=date(b.starts);expect(starts>Number(t.starts),'Postponement must move the event later.');const delta=starts-Number(t.starts);
    const entrants=await all('SELECT DISTINCT player FROM entrants WHERE tournament=?',[t.id]);
    await db().batch([statement('UPDATE tournaments SET starts=starts+?,checkin=checkin+? WHERE id=?',[delta,delta,t.id]),statement('UPDATE matches SET starts=starts+?,checkin=checkin+?,release=release+? WHERE tournament=?',[delta,delta,delta,t.id]),auditStatement(actor,'tournament.postpone',JSON.stringify({id:t.id,previous:t.starts,next:starts})),...entrants.map(e=>notifyStatement(String(e.player),`${t.title} has been postponed. Review the updated schedule in My Matches.`))]);return {message:'Event and match schedules postponed; participants notified.'};
  }
  if(action==='admin/archive') {admin();const t=await one('SELECT status FROM tournaments WHERE id=?',[id()]);expect(t&&['cancelled','completed'].includes(String(t.status)),'Only completed or cancelled events can be archived.');await db().batch([statement('UPDATE tournaments SET archived=1 WHERE id=?',[id()]),auditStatement(actor,'tournament.archive',id())]);return {message:'Tournament archived.'};}
  if(action==='admin/matches') {
    admin();const event=await one('SELECT * FROM tournaments WHERE id=?',[str(b.tournament)]);expect(event&&!['draft','completed','cancelled'].includes(String(event.status)),'Choose a published active event.');
    const starts=date(b.starts),checkin=date(b.checkin),release=date(b.release);expect(Number(event.closes)<=checkin&&checkin<=starts&&release<=starts&&release>=checkin,'Lobby release must be between check-in deadline and match start.');
    const matchId=b.id?str(b.id):uid();const previous=b.id?await one('SELECT * FROM matches WHERE id=?',[matchId]):null;
    if(b.id)expect(previous&&previous.tournament===event.id,'Match does not belong to this tournament.');
    const participants=str(b.participants??'',0,2000).split(',').map(s=>s.trim()).filter(Boolean);expect(new Set(participants).size===participants.length,'Match entries must be unique.');if(event.format==='knockout')expect(participants.length===2,'A knockout match needs exactly two registered entry IDs.');for(const entry of participants)expect(await one('SELECT id FROM registrations WHERE id=? AND tournament=?',[entry,event.id]),'Every assigned entry must belong to this event.');if(previous){const hasResults=await one('SELECT id FROM results WHERE match=?',[matchId]);expect(!hasResults||JSON.stringify(participants)===previous.participants,'Match assignments are locked once results exist.');}
    const values=[event.id,str(b.title,3,100),starts,checkin,release,str(b.room??'',0,200),str(b.instructions??'',0,2000),str(b.status??'upcoming'),JSON.stringify(participants)];expect(['upcoming','live','completed','cancelled'].includes(String(values[7])),'Invalid match state.');
    const entrants=await all('SELECT DISTINCT player FROM entrants WHERE tournament=?',[event.id]);
    await db().batch([previous?statement('UPDATE matches SET tournament=?,title=?,starts=?,checkin=?,release=?,room=?,instructions=?,status=?,participants=? WHERE id=?',[...values,matchId]):statement('INSERT INTO matches (tournament,title,starts,checkin,release,room,instructions,status,participants,id) VALUES (?,?,?,?,?,?,?,?,?,?)',[...values,matchId]),auditStatement(actor,'match.save',matchId),...entrants.map(e=>notifyStatement(String(e.player),`${event.title}: match schedule updated. Open My Matches for details.`))]);return {message:'Match and lobby settings saved.'};
  }
  if(action==='admin/review') {
    reviewer();const r=await one('SELECT r.*,t.rules,t.mode FROM results r JOIN matches m ON m.id=r.match JOIN tournaments t ON t.id=m.tournament WHERE r.id=?',[id()]);expect(r,'Result not found.',404);
    expect(r.submitter!==actor,'You cannot verify your own submitted result.',403);expect(!await one('SELECT 1 FROM entrants e JOIN matches m ON m.tournament=e.tournament WHERE m.id=? AND e.player=?',[r.match,actor]),'Event participants cannot review results from their own competition.',403);
    expect(!await one("SELECT id FROM disputes WHERE result=? AND status='open'",[r.id]),'Resolve the open dispute before publishing this result.');
    const status=str(b.status);expect(['verified','rejected'].includes(status),'Choose verify or reject.');const rules=JSON.parse(String(r.rules));
    const placement=int(b.placement??r.placement,1,512),eliminations=int(b.eliminations??r.eliminations,0,1000),won=b.won===undefined?Number(r.won):b.won===true?1:0;
    if(status==='verified'&&won&&r.mode!=='battle_royale')expect(!await one("SELECT id FROM results WHERE match=? AND status='verified' AND won=1 AND id<>?",[r.match,r.id]),'This match already has a verified winner. Correct that result before publishing a different winner.');
    const points=status==='verified'?(r.mode==='battle_royale'?(rules.placementPoints[placement-1]??0)+eliminations*rules.eliminationPoints:won*rules.winPoints):0;
    await db().batch([statement('UPDATE results SET status=?,placement=?,eliminations=?,won=?,points=?,reviewer=?,reason=? WHERE id=?',[status,placement,eliminations,won,points,actor,str(b.reason,5,2000),r.id]),auditStatement(actor,'result.review',JSON.stringify({id:r.id,previous:{status:r.status,points:r.points,placement:r.placement,eliminations:r.eliminations},next:{status,points,placement,eliminations}})),notifyStatement(String(r.submitter),`Your result was ${status}. Check My Matches for the review.`)]);return {message:'Result reviewed. Verified standings updated automatically.'};
  }
  if(action==='admin/disputes') {reviewer();const d=await one('SELECT * FROM disputes WHERE id=?',[id()]);expect(d&&d.status==='open','Open dispute not found.');expect(d.player!==actor,'You cannot resolve your own dispute.',403);await db().batch([statement("UPDATE disputes SET status='resolved',resolution=? WHERE id=?",[str(b.resolution,10,2000),d.id]),statement("UPDATE results SET status='pending' WHERE id=?",[d.result]),auditStatement(actor,'dispute.resolve',String(d.id)),notifyStatement(String(d.player),'Your dispute has been resolved. The result is awaiting a fresh review.')]);return {message:'Dispute resolved. Review and verify the result separately.'};}
  if(action==='admin/announcements') {admin();const a=uid(),game=str(b.game??'all');expect(['all','ffmax','bgmi','codm'].includes(game),'Unsupported game.');await db().batch([statement('INSERT INTO announcements (id,title,body,game,video,created) VALUES (?,?,?,?,?,?)',[a,str(b.title,3,120),str(b.body,10,4000),game,safeVideo(b.video),now]),auditStatement(actor,'announcement.publish',a)]);return {message:'Announcement published.'};}
  if(action==='admin/delete-announcement') {admin();await db().batch([statement('DELETE FROM announcements WHERE id=?',[id()]),auditStatement(actor,'announcement.delete',id())]);return {message:'Announcement removed.'};}
  if(action==='admin/roles') {admin();const target=await one('SELECT * FROM players WHERE id=?',[id()]);expect(target&&target.id!==actor,'You cannot change your own role.');const role=str(b.role);expect(['player','moderator','admin'].includes(role),'Invalid role.');await db().batch([statement('UPDATE players SET role=? WHERE id=?',[role,target.id]),auditStatement(actor,'player.role',JSON.stringify({id:target.id,role}))]);return {message:'Role updated.'};}
  if(action==='admin/settings') {
    admin();const key=str(b.key);expect(['support','instagram','youtube','community','apk'].includes(key),'Unsupported setting.');let value=str(b.value,0,6000);
    if(['instagram','youtube'].includes(key)&&value)value=safeVideo(value);
    if(key==='support'&&value)expect(/^\+?[1-9]\d{7,14}$/.test(value),'Enter a verified international phone number.');
    if(key==='apk'&&value) {const apk=JSON.parse(value);expect(apk.approved===true,'Only approved, signed releases can be published.');const u=new URL(str(apk.url,1,1000));expect(u.protocol==='https:'&&!u.username&&!u.password,'Use a verified HTTPS APK URL.');expect(/^[a-fA-F0-9]{64}$/.test(str(apk.sha256)),'Enter the APK SHA-256 checksum.');expect(str(apk.version)&&str(apk.minAndroid)&&str(apk.notes,10,4000)&&int(apk.size,1,2000000000)&&date(apk.released),'Complete all APK release metadata.');}
    await db().batch([statement('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[key,value]),auditStatement(actor,`settings.${key}`,key)]);return {message:'Platform setting saved.'};
  }
  throw new Problem(404,'Action not found.');
}

async function authAction(action:string,b:Record<string,unknown>,request:Request) {
  const cfg=config();
  if(action==='auth/logout') {const jar=await cookies();jar.delete('rf_access');return {message:'Signed out.'};}
  expect(cfg.SUPABASE_URL&&cfg.SUPABASE_PUBLISHABLE_KEY,'Email sign-in is not configured. Continue with secure sign-in instead.',503);
  await rateLimit(`auth:${request.headers.get('cf-connecting-ip')??'unknown'}`,8);
  const base=cfg.SUPABASE_URL,headers={apikey:cfg.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'};
  if(action==='auth/session'||action==='auth/reset') {
    const token=str(b.token,20,8192);const verified=await fetch(`${base}/auth/v1/user`,{headers:{...headers,Authorization:`Bearer ${token}`}});
    const user=await verified.json() as {email_confirmed_at?:string,is_anonymous?:boolean};expect(verified.ok&&user.email_confirmed_at&&!user.is_anonymous,'This verification or recovery link is invalid or expired.',401);
    if(action==='auth/reset') {expect(typeof b.password==='string'&&b.password.length>=12&&b.password.length<=128,'Use a password between 12 and 128 characters.');const update=await fetch(`${base}/auth/v1/user`,{method:'PUT',headers:{...headers,Authorization:`Bearer ${token}`},body:JSON.stringify({password:b.password})});expect(update.ok,'The password could not be updated. Request a new recovery link.');}
    (await cookies()).set('rf_access',token,{httpOnly:true,secure:new URL(request.url).protocol==='https:',sameSite:'lax',path:'/',maxAge:3600});return {message:action==='auth/reset'?'Password updated. You can continue to your dashboard.':'Email verified. Welcome to RankForge.'};
  }
  const email=str(b.email,3,254);expect(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Enter a valid email address.');
  if(action==='auth/recover') {await fetch(`${base}/auth/v1/recover?redirect_to=${encodeURIComponent(new URL('/auth-complete',request.url).href)}`,{method:'POST',headers,body:JSON.stringify({email})});return {message:'If an account exists, a recovery email will arrive shortly.'};}
  expect(typeof b.password==='string'&&b.password.length>=12&&b.password.length<=128,'Use a password between 12 and 128 characters.');const password=b.password;
  if(action==='auth/register') {expect(b.consent===true&&b.adult===true,'Confirm age eligibility and accept the policies.');await fetch(`${base}/auth/v1/signup?redirect_to=${encodeURIComponent(new URL('/auth-complete',request.url).href)}`,{method:'POST',headers,body:JSON.stringify({email,password})});return {message:'Check your email to confirm your account, then sign in.'};}
  if(action==='auth/login') {
    const res=await fetch(`${base}/auth/v1/token?grant_type=password`,{method:'POST',headers,body:JSON.stringify({email,password})});const data=await res.json() as {access_token?:string,expires_in?:number,user?:{email_confirmed_at?:string}};
    expect(res.ok&&data.access_token&&data.user?.email_confirmed_at,'Unable to sign in. Check your details and email verification.',401);
    (await cookies()).set('rf_access',data.access_token,{httpOnly:true,secure:new URL(request.url).protocol==='https:',sameSite:'lax',path:'/',maxAge:data.expires_in??3600});return {message:'Signed in. Welcome to RankForge.'};
  }
  throw new Problem(404,'Authentication action not found.');
}

export async function upload(request:Request) {
  const p=await requirePlayer();await rateLimit(`upload:${p.id}`,5);expect(env.BUCKET,'File storage is temporarily unavailable.',503);
  expect(Number(request.headers.get('content-length')??0)<=5*1024*1024,'Evidence must be under 5 MB.');
  const data=await request.arrayBuffer();expect(data.byteLength>0&&data.byteLength<=5*1024*1024,'Evidence must be under 5 MB.');const a=new Uint8Array(data);
  const png=a[0]===137&&a[1]===80&&a[2]===78&&a[3]===71,jpeg=a[0]===255&&a[1]===216&&a[2]===255;
  expect(png||jpeg,'Upload a PNG or JPEG screenshot.');const type=png?'image/png':'image/jpeg',id=uid();
  await env.BUCKET.put(id,data,{httpMetadata:{contentType:type}});
  try {await run('INSERT INTO assets (id,owner,type,size,created) VALUES (?,?,?,?,?)',[id,p.id,type,data.byteLength,Date.now()]);}catch(e){await env.BUCKET.delete(id);throw e;}
  return {id,message:'Evidence uploaded securely.'};
}
export async function evidence(id:string) {
  const p=await requirePlayer(),asset=await one('SELECT * FROM assets WHERE id=?',[id]);expect(asset,'Evidence not found.',404);
  expect(asset.owner===p.id||['admin','moderator'].includes(String(p.role)),'You cannot access this file.',403);const file=await env.BUCKET?.get(id);expect(file,'File not found.',404);
  if(asset.owner!==p.id)await auditStatement(String(p.id),'evidence.access',id).run();
  return new Response(file.body,{headers:{'Content-Type':String(asset.type),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}
