import RequestInput from './request-input';

export default interface FulfillmentRequest {
  requestId: string;
  inputs: RequestInput[];
}
