import { DeviceType } from './device.type';
import { TraitType } from './trait.type';
import { CameraProtocolType } from './camera-protocol.type';
import { UnitType } from './unit.type';

export default interface Device {
  id: string;
  type: DeviceType;
  traits: TraitType[];
  name: { name: string };
  willReportState: boolean;
  attributes?: Attributes;
}

export interface Attributes {
  // StartStop attributes
  pausable?: boolean;

  // Dispense attributes
  supportedDispenseItems: SupportedDispenseItem[];
  supportedDispensePresets: SupportedDispensePreset[];

  // Camera attributes
  cameraStreamSupportedProtocols?: CameraProtocolType[];
  cameraStreamNeedAuthToken?: boolean;
  cameraStreamNeedDrmEncryption?: boolean;
}

export interface SupportedDispensePreset {
  preset_name: string;
  preset_name_synonyms: Synonym[];
}

export interface SupportedDispenseItem {
  item_name: string;
  item_name_synonyms: Synonym[];
  supported_units: UnitType[];
  default_portion: { amount: number; unit: UnitType };
}

export interface Synonym {
  lang: string;
  synonyms: string[];
}
