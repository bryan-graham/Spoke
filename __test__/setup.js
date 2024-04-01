import { configure } from "enzyme";
import Adapter from "enzyme-adapter-react-16";
import { TextEncoder, TextDecoder } from "util";
import { r } from "../src/server/models";

Object.assign(global, { TextDecoder, TextEncoder });

configure({ adapter: new Adapter() });

// server/api/campaign.test.js has some long tests so we increase from 5sec default
jest.setTimeout(15000);

afterAll(async () => {
  if (!r.redis) {
    return;
  }

  // eslint-disable-next-line no-unused-vars
  r.redis.quit().catch(error => {});
});
