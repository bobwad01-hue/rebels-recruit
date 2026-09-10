import {redirect} from 'next/navigation';

export default function TasksRedirect(){
  redirect('/game-plan#next-moves');
}
