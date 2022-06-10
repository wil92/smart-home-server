const jwt = require('jsonwebtoken');

describe('Functions test', () => {
  const TEST_KEY = '5FucJT6D46LXBt8';

  it('should generate a code with expiration', () => {
    const code = jwt.sign({}, TEST_KEY, {expiresIn: '1h'});
    expect(code).not.toBeNull();
  });
});
