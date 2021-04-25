import assert from 'assert';
import { getUserId } from '../../utils/Utils.js';

describe("Utils", () => {

  describe("getUserId", () => {

    it("returns undefined when req is undefined", () => {
      const res = getUserId(undefined);
      assert.strictEqual(undefined, res);
    });

    it("returns undefined when req.user is undefined", () => {
      const res = getUserId({});
      assert.strictEqual(undefined, res);
    });

    it("returns undefined when req.user.sub is undefined", () => {
      const res = getUserId({
        user: {}
      });
      assert.strictEqual(undefined, res);
    });

    it("returns req.user.sub", () => {
      const USER_ID = '98dsagsaufgi932hfafd'
      const res = getUserId({
        user: {
          sub: USER_ID
        }
      });
      assert.strictEqual(USER_ID, res);
    });

  });
});
