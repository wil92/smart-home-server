export default function isLogin(req: any, res: any, next: any) {
  if(!req.url.startsWith('/auth') && !req.url.startsWith('/policy') && !req.url.startsWith('/api') && !req.session['isLogin']) {
    return res.redirect('/auth');
  }
  next();
}
