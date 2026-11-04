import { bootstrap, workspace, adminData, lobby, mutate, upload, evidence } from '@/lib/service';
import { Problem, expect } from '@/lib/domain';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
async function handler(request:Request,context:{params:Promise<{path:string[]}>}) {
  try {
    const {path}=await context.params;const action=path.join('/');
    if(request.method==='GET') {
      if(action==='site-session'){await mutate('auth/site',{},request);return Response.redirect(new URL('/profile',request.url),303);}
      if(action==='bootstrap')return json(await bootstrap());
      if(action==='me')return json(await workspace());
      if(action==='admin')return json(await adminData());
      if(path[0]==='lobby'&&path[1])return json(await lobby(path[1]));
      if(path[0]==='evidence'&&path[1])return await evidence(path[1]);
      throw new Problem(404,'Endpoint not found.');
    }
    expect(request.headers.get('origin')===new URL(request.url).origin,'Request origin was not accepted.',403);
    if(action==='upload')return json(await upload(request));
    expect(request.headers.get('content-type')?.includes('application/json'),'Send a JSON request.',415);
    const text=await request.text();expect(text.length<30000,'Request too large.',413);const body=JSON.parse(text);expect(body&&typeof body==='object'&&!Array.isArray(body),'Invalid request.');
    return json(await mutate(action,body,request));
  } catch(error) {
    if(error instanceof Problem)return json({error:error.message},error.status);
    if(error instanceof SyntaxError)return json({error:'The submitted data could not be read.'},400);
    const message=error instanceof Error?error.message:'';
    if(/UNIQUE constraint failed/i.test(message))return json({error:'This player, registration, invitation, or result already exists.'},409);
    if(/event_full|registration_closed|roster_invalid|player_ineligible/i.test(message))return json({error:'Registration could not be completed. Check capacity, the registration window, and roster eligibility.'},409);
    console.error('Platform request failed',message.replace(/(?:Bearer|sb_secret_)\S+/g,'[redacted]').slice(0,250));
    return json({error:'The request could not be completed. Please try again.'},500);
  }
}
export const GET=handler;
export const POST=handler;
