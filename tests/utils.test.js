const {randomText} = require("../src/utils");

describe('Utils functions', () => {
  it('should expect a random text of size 10', () => {
    expect(randomText(10).length).toEqual(10);
    expect(randomText(20).length).toEqual(20);
  });
});
