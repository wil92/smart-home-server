import Device from './device';
import QueryDevice from './query-device';
import Command from './command';

export default interface Payload {
  agentUserId: string;
  devices?: Device[] | QueryDevices;
  commands?: Command[];
}

export interface QueryDevices {
  [id: string]: QueryDevice;
}
