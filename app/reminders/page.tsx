import {redirect} from 'next/navigation';

export default function RemindersRedirect(){
  redirect('/game-plan#next-moves');
}
