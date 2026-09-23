export default function RecruitingHealthScore({score,health,size='md'}:{score:number;health:string;size?:'sm'|'lg'}){
 const scoreClass=size==='lg'?'text-5xl':'text-3xl';
 return <div className="flex items-end gap-3">
  <div className={`${scoreClass} font-black leading-none`}>{score}</div>
  <div className="pb-0.5"><div className="font-black leading-tight">{health}</div><div className="muted text-xs">out of 100</div></div>
 </div>
}
