import {NextRequest,NextResponse} from 'next/server';

export async function GET(req:NextRequest){
 const res=NextResponse.redirect(new URL('/platform-admin',req.url));
 res.cookies.set('rr-support-org','',{path:'/',maxAge:0});
 return res;
}
