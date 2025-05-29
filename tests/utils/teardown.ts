import {closeApp, getApp} from "./utils";
import {dropDatabase} from "../../src/models";

export default async function teardown() {
    await getApp();
    await dropDatabase();
    await closeApp();
}
