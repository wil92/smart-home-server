import jwt, {SignOptions} from 'jsonwebtoken';
import bcrypt from "bcrypt";

import env from './environments';

export const CODE_TOKEN_TYPE = 'code';
export const REFRESH_TOKEN_TYPE = 'refresh_token';
export const ACCESS_TOKEN_TYPE = 'access_token';

export const COMMAND_ON_OFF = 'action.devices.commands.OnOff';
export const COMMAND_START_STOP = 'action.devices.commands.StartStop';

export const DEVICE_TYPE_PETFEEDER = 'action.devices.types.PETFEEDER';
export const DEVICE_TYPE_OUTLET = 'action.devices.types.OUTLET';

/**
 * @param query {object}
 * @returns {string}
 */
export function queryToStr(query: any): string {
  return Object.keys(query).reduce((p, k, i) => {
    let q = `${k}=${encodeURI(query[k])}`;
    if (i > 0) {
      q = `${p}&${q}`;
    }
    return q;
  }, '');
}

export function createCode() {
  return createToken({type: CODE_TOKEN_TYPE});
}

export interface Auth2Response {
  token_type: string;
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

export function auth2Response(withRefreshToken = true): Auth2Response {
  const res = {
    token_type: 'Bearer',
    access_token: createAccessToken(),
    expires_in: 2 * 60 * 60 // 2h in seconds
  } as Auth2Response;
  if (withRefreshToken) {
    res.refresh_token = createRefreshToken();
  }
  return res;
}

export function createRefreshToken(): string {
  return createToken({type: REFRESH_TOKEN_TYPE}, '2y');
}

export function createAccessToken(): string {
  return createToken({type: ACCESS_TOKEN_TYPE}, '2h');
}

export function createToken(payload = {}, expiresIn = '20m'): string {
  return jwt.sign(payload, env.key, {expiresIn} as SignOptions);
}

const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export function randomText(size = 10): string {
  let res = '';
  for (let i = 0; i < size; i++) {
    res += characters.charAt(Math.floor(characters.length * Math.random()));
  }
  return res;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

export async function validatePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}
