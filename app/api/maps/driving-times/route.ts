import {NextResponse} from 'next/server';
// Route Matrix intentionally disabled to prevent Google Maps Platform charges.
export async function POST(){return NextResponse.json({configured:false,disabled:true,origin:null,times:{},error:'Driving-time calculations are currently disabled.'},{status:410})}
