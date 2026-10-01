import {env} from "../environments";

export function haveBasicAuth(req: any): boolean {
    const authHeader = req.headers['authorization'];
    let isAuth = false;
    if (authHeader) {
        // validate user/pass
        const auth = new Buffer(authHeader.replace("Basic ", ""), 'base64').toString('utf8');
        const userpass = auth.split(":");

        if (userpass[0] === env.username && userpass[1] === env.password) {
            isAuth = true;
        }
    }
    return isAuth;
}

export default function isLogin(req: any, res: any, next: any) {
    if (!req.url.startsWith('/auth') && !req.url.startsWith('/policy') && !req.url.startsWith('/api') && !req.session['isLogin'] && !haveBasicAuth(req)) {
        // return res.redirect('/auth');
        return res.status(401).setHeader('WWW-Authenticate', 'Basic realm="User Visible Realm"').send("");
    }
    next();
}
