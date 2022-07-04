const {randomText, createAccessToken} = require("../src/utils");
const env = require('../src/environments');

describe('Utils functions', () => {
  it('should expect a random text of size 10', () => {
    expect(randomText(10).length).toEqual(10);
    expect(randomText(20).length).toEqual(20);
  });

  it('should get accessToken', function () {
    const jwt = createAccessToken();
    console.log(jwt);
  });
});
