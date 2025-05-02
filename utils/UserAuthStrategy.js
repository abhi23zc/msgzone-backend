import { User } from "../models/user.Schema.js";


export class UserAuthStrategy {
  constructor(userId) {
    this.userId = userId;
  }

  async get({ session }) {
    const user = await User.findById(this.userId);
    return user?.waSession || null;
  }

  async set({ session, data }) {
    await User.findByIdAndUpdate(this.userId, { waSession: data }, { new: true, upsert: true });
  }

  async delete({ session }) {
    await User.findByIdAndUpdate(this.userId, { $unset: { waSession: "" } });
  }

  async sessionExists({ session }) {
    const user = await User.findById(this.userId);
    return !!user?.waSession;
  }
}
