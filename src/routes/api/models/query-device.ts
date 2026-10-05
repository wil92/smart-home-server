import { StatusType } from './status.type';
import { CameraAttributes, FeederAttributes, OutletAttributes } from './device-attributes';

export default interface QueryDevice extends CameraAttributes, FeederAttributes, OutletAttributes {
  status: StatusType;
  online: boolean;
  errorCode?: string;
}
