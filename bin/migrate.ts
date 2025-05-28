#!/usr/bin/env node

import {config} from "dotenv";

if (process.env.NODE_ENV !== 'test') {
  config();
}

import {connectDb, runMigrations} from "../src/models";


connectDb().then(async () => {
  await runMigrations();
  process.exit(0);
});
