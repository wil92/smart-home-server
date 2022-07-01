const jwt = require('jsonwebtoken');
const {hashPassword, validatePassword} = require("../src/utils");

describe('Functions test', () => {
  const TEST_KEY = '5FucJT6D46LXBt8';

  it('should generate a code with expiration', () => {
    const code = jwt.sign({}, TEST_KEY, {expiresIn: '1h'});
    expect(code).not.toBeNull();
  });

  it('should hash and validate passwords', async () => {
    const password = 'test';
    const hash = await hashPassword(password);
    const result = await validatePassword(password, hash);
    expect(result).toBeTruthy();
  });
});
