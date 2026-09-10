import {redirect} from 'next/navigation';
export default async function AdvisorPlayer({params}:{params:Promise<{id:string}>}){const {id}=await params;redirect(`/players/${id}`)}
