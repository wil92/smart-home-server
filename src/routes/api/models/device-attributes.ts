import { CameraProtocolType } from './camera-protocol.type';

export interface CameraAttributes {
  cameraStreamAccessUrl?: string;
  cameraStreamProtocol?: CameraProtocolType;
}

export interface FeederAttributes {
  dispenseItems?: DispenseItem[];
  isRunning?: boolean;
}

export interface DispenseItem {
  itemName: string;
  isCurrentlyDispensing: boolean;
}

export interface OutletAttributes {
  on?: boolean;
}
