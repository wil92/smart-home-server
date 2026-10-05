import Payload from './payload';

export default interface FulfillmentResponse {
  requestId: string;
  payload: Payload;
}
