const mongoose = require('mongoose');

const versionSchema = new mongoose.Schema(
  {
    version: {
      type: String,
      unique: true,
      required: true,
    },
    description: {
      type: String,
      unique: false,
      required: true,
    },
  },
  { timestamps: true },
);

versionSchema.statics.versionExist = async function (version) {
  const v = await this.findOne({version});
  return !!v;
};

const Version = mongoose.model('Version', versionSchema);

module.exports = Version;
