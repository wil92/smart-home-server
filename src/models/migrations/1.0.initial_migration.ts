const {hashPassword} = require("../../utils");

const migration = {
  version: '1.0',
  description: 'Initial migration',
  migrate: async (models: any, env: any) => {
    const hash = await hashPassword(env.password);
    const initialUser = new models.User({username: env.username, password: hash});
    await initialUser.save();
  }
}

module.exports = migration;
