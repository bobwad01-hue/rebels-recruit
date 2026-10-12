import {redirect} from 'next/navigation';

// Comparison now lives in Find Schools so users can compare any three schools,
// not only schools already added to Connections.
export default function Compare(){
  redirect('/discover#compare-schools');
}
