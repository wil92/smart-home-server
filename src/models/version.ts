import mongoose from 'mongoose';

interface IVersion {
    version: string;
    description: string;
}

interface VersionModel extends mongoose.Model<IVersion> {
  versionExist(version: string): Promise<boolean>;
}

const versionSchema = new mongoose.Schema<IVersion, VersionModel>(
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

const Version = mongoose.model<IVersion, VersionModel>('Version', versionSchema);

export default Version;
