'use client';

import {announceDataChanged,type DataChangedDetail} from '@/lib/feedback';

type Action='create'|'update'|'delete'|'complete'|'reopen'|'archive'|'restore'|'rsvp';

const actionMap:Record<Action,NonNullable<DataChangedDetail['action']>>={
  create:'created',
  update:'updated',
  delete:'deleted',
  complete:'completed',
  reopen:'reopened',
  archive:'archived',
  restore:'restored',
  rsvp:'rsvp',
};

export function emitDataChanged(entity:string,action:Action,id?:string,payload?:unknown){
  announceDataChanged({entity,action:actionMap[action],id,payload});
}
