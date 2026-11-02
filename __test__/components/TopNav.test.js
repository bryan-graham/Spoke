import React from "react";
import { shallow } from "enzyme";
import { StyleSheetTestUtils } from "aphrodite";
import { TopNavBase as TopNav } from "../../src/components/TopNav";
import UserMenu from "../../src/containers/UserMenu";

describe("TopNav component", () => {
  StyleSheetTestUtils.suppressStyleInjection();

  const orgId = "1";
  const title = "foo";
  const wrapper = shallow(<TopNav orgId={orgId} title={title} />);

  test("leaves the account menu to the Shore shell's sidebar", () => {
    expect(wrapper.find(UserMenu).length).toBe(0);
    expect(wrapper.find("h1").length + wrapper.text().length).toBeGreaterThan(
      0
    );
  });
});
