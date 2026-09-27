export default function RecruitingHealthScore({score,health,size='sm'}:{score:number;health:string;size?:'sm'|'lg'}){
 const scoreClass=size==='lg'?'text-5xl':'text-3xl';
 const scoreHeight=size==='lg'?'h-12':'h-8';
 return <div className="flex items-start gap-3">
  <div className={`${scoreClass} ${scoreHeight} flex items-center font-black leading-none`}>{score}</div>
  <div className={`${scoreHeight} flex flex-col justify-between`}>
   <div className="font-black leading-none">{health}</div>
   <div className="muted text-xs leading-none">out of 100</div>
  </div>
 </div>
}
