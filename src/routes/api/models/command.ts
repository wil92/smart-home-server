import { StatusType } from './status.type';
import { CameraAttributes, FeederAttributes, OutletAttributes } from './device-attributes';

export default interface Command {
  ids: string[];
  status: StatusType;
  states?: State;
  errorCode?: string;
}

export interface State extends CameraAttributes, OutletAttributes, FeederAttributes {
  online: boolean;
}
