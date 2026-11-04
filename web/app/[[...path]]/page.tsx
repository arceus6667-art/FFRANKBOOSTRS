import Platform from '@/components/platform';
import { bootstrap } from '@/lib/service';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
export const dynamic='force-dynamic';
const allowed=['tournaments','games','leaderboard','download-app','sign-in','register','recover','dashboard','my-matches','my-teams','profile','notifications','settings','admin','privacy','terms','fair-play','community-guidelines','support','cancellation-policy'];
export async function generateMetadata({params}:{params:Promise<{path?:string[]}>}):Promise<Metadata> {const {path=[]}=await params;const title=path.length?path[0].replaceAll('-',' ').replace(/\b\w/g,c=>c.toUpperCase()):'Compete Together';return {title:`${title} | RankForge`,robots:path.some(p=>['admin','dashboard','profile','my-matches','my-teams','notifications','settings'].includes(p))?{index:false,follow:false}:undefined};}
export default async function Page({params}:{params:Promise<{path?:string[]}>}) {const {path=[]}=await params;if(path.length&&!allowed.includes(path[0])||path.length>2)notFound();const initial=await bootstrap();return <Platform initial={initial} route={path}/>;}
