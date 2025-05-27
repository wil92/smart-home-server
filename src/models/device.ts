import mongoose from 'mongoose';
import {Schema} from 'mongoose';

interface IDevice {
  did: string;
  params: {
    on: boolean;
    isRunning: boolean;
  };
  type: string;
  name: {
    name: string;
  };
}

interface DeviceModel extends mongoose.Model<IDevice> {
  updateOrCreate(deviceRes: any): Promise<IDevice>;
  exist(id: string): Promise<boolean>;
}

const deviceSchema = new mongoose.Schema<IDevice, DeviceModel>(
  {
    did: {
      type: String,
      unique: true,
      required: true,
    },
    params: {type: new Schema({on: Boolean, isRunning: Boolean})},
    type: String,
    name: {type: new Schema({name: String})},
  },
  {timestamps: true},
);

deviceSchema.statics.updateOrCreate = async function (deviceRes) {
  let device = await this.findOne({did: deviceRes.payload.id});
  if (!!device) {
    device.params = {on: deviceRes.payload.on, isRunning: deviceRes.payload.isRunning};
    device.type = deviceRes.payload.type;
    device.name = deviceRes.payload.name;
  } else {
    device = new this({
      did: deviceRes.payload.id,
      params: {on: deviceRes.payload.on, isRunning: deviceRes.payload.isRunning},
      type: deviceRes.payload.type,
      name: deviceRes.payload.name
    });
  }
  await device.save();
  return device;
}

deviceSchema.statics.exist = async function (id) {
  let device = await this.findOne({did: id});
  return !!device;
}

const Device = mongoose.model<IDevice, DeviceModel>('Device', deviceSchema);

export default Device;
