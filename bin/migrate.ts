#!/usr/bin/env node

import {config} from "dotenv";

import {connectDb, runMigrations} from "../src/models";

if (process.env.NODE_ENV !== 'test') {
  config();
}

connectDb().then(async () => {
  await runMigrations();
  process.exit(0);
});
