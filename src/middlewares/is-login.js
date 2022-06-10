
function isLogin(req, res, next) {
  if(!req.url.startsWith('/auth') && !req.session['isLogin']) {
    return res.redirect('/auth');
  }
  next();
}

module.exports = isLogin;
