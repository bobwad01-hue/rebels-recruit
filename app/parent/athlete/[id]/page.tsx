import {redirect} from 'next/navigation';
export default async function ParentAthleteOverview({params}:{params:Promise<{id:string}>}){const {id}=await params;redirect(`/players/${id}`)}
