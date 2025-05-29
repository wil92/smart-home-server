import jwt from 'jsonwebtoken';
import {env} from '../environments';
import {ACCESS_TOKEN_TYPE} from "../utils";

function validateToken(req: any, res: any, next: any) {
  if (req.headers['authorization']) {
    try {
      const token = req.headers['authorization'].replace(/^Bearer /, '');
      const payload: any = jwt.verify(token, env.key);
      if (payload.type !== ACCESS_TOKEN_TYPE) {
        throw new Error('Invalid token');
      }
      return next();
    } catch (e) {
      console.error(e)
    }
  } else if (req.session['isLogin']) {
    return next();
  }
  res.status(401);
  res.send({ error: 'Invalid access token' });
}

export default validateToken;
