import {Suspense} from 'react';
import VideoLibrary from './VideoLibrary';

export default function VideosPage(){
  return <Suspense fallback={<div className="min-h-screen bg-slate-50"/>}><VideoLibrary/></Suspense>;
}
