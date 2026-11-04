'use client';
export default function ErrorPage({reset}:{reset:()=>void}) {return <main className="container page"><div className="empty"><span className="eyebrow">A BRIEF TIMEOUT</span><h1>Let’s get you back in the game.</h1><p>The page could not load. Your stored registrations and results have not been changed.</p><button className="button" onClick={reset}>Try again</button></div></main>;}
