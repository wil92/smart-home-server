const {randomText, createAccessToken} = require("../src/utils");
const { createClient } = require("./utils/utils");

describe('Utils functions', () => {
  it('should expect a random text of size 10', () => {
    expect(randomText(10).length).toEqual(10);
    expect(randomText(20).length).toEqual(20);
  });

  it('should get accessToken', function () {
    const jwt = createAccessToken();
    console.log(jwt);
  });

  // only for test propose, should not be used in production
  xit('should connect testing device to server', async () => {
    const device = await createClient({
      messageType: 'QUERY',
      payload: {
        id: 'CgCGzmhvelv1',
        on: true,
        type: 'action.devices.types.OUTLET',
        // type: 'action.devices.types.PETFEEDER',
        name: {name: 'td1'}
      }
    }, (msg) => msg, 3000);
    console.log('Device:', device);
  });
});
