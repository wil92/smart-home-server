import { IntentType } from './intent.type';
import { CommandType } from './command.type';

export default interface RequestInput {
  intent: IntentType;
  payload?: {
    commands?: {
      devices: {
        id: string;
      }[];
      execution: {
        command: CommandType;
        params: {
          start?: boolean;
          on?: boolean;
          StreamToChromecast?: boolean;
          SupportedStreamProtocols?: string[];
        };
      }[];
    }[];
    devices?: {
      id: string;
    }[];
  };
}
