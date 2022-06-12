
function isLogin(req, res, next) {
  if(!req.url.startsWith('/auth') && !req.url.startsWith('/policy') && !req.url.startsWith('/api') && !req.session['isLogin']) {
    return res.redirect('/auth');
  }
  next();
}

module.exports = isLogin;
