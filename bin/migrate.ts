#!/usr/bin/env node

import {connectDb, runMigrations} from "../src/models";


connectDb().then(async () => {
  await runMigrations();
  process.exit(0);
});
