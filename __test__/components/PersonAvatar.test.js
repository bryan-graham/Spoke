/**
 * @jest-environment jsdom
 */
import React from "react";
import { mount } from "enzyme";
import { StyleSheetTestUtils } from "aphrodite";
import PersonAvatar, {
  personInitials,
  avatarColorName,
  avatarColors
} from "../../src/components/PersonAvatar";
import ContactToolbar from "../../src/components/AssignmentTexter/ContactToolbar";
import { palette } from "../../src/styles/shore-tokens";

describe("PersonAvatar", () => {
  it("shows a person's initials", () => {
    expect(personInitials("Pat Example")).toBe("PE");
    expect(personInitials("Mary Ann de la Cruz")).toBe("MC");
    expect(personInitials("pat")).toBe("P");
    expect(personInitials("")).toBe("?");
    expect(personInitials(null)).toBe("?");
  });

  it("picks the same Shore colour for the same name", () => {
    const colors = ["navy", "ocean", "seagrass", "coral", "sand"];
    expect(colors).toContain(avatarColorName("Pat"));
    expect(avatarColorName("Pat")).toBe(avatarColorName("Pat"));
    const seen = new Set(
      ["Pat", "Sam", "Alex", "Jordan", "Riley", "Casey", "Taylor"].map(
        avatarColorName
      )
    );
    expect(seen.size).toBeGreaterThan(1);
  });

  it("uses pale tints in light mode and solid colours in dark", () => {
    const name = "Pat";
    const scale = palette[avatarColorName(name)];
    expect(avatarColors(name, "light").backgroundColor).toBe(scale[1]);
    const dark = avatarColors(name, "dark").backgroundColor;
    expect([scale[6], scale[3]]).toContain(dark);
  });

  it("renders the initials", () => {
    const avatar = mount(<PersonAvatar name="Pat Example" />);
    expect(avatar.text()).toBe("PE");
  });
});

describe("ContactToolbar", () => {
  beforeEach(() => StyleSheetTestUtils.suppressStyleInjection());
  afterEach(() => StyleSheetTestUtils.clearBufferAndResumeStyleInjection());

  const props = {
    campaign: { id: "1", timezone: "US/Eastern" },
    campaignContact: {
      firstName: "Pat",
      location: { city: "Brooklyn", state: "NY", timezone: null }
    },
    navigationToolbarChildren: {
      onPrevious: null,
      onNext: () => {},
      title: "3 of 20"
    }
  };

  it("shows the contact, where they are, and their place in the list", () => {
    const bar = mount(<ContactToolbar {...props} />);
    const text = bar.text();
    expect(text).toContain("Pat");
    expect(text).toContain("Brooklyn, NY");
    expect(text).toContain("3 of 20");
    expect(
      bar.find('button[aria-label="Previous contact"]').prop("disabled")
    ).toBe(true);
    expect(bar.find('button[aria-label="Next contact"]').prop("disabled")).toBe(
      false
    );
    // no contact list toggle unless the contact list is turned on
    expect(
      bar.find('button[aria-label="Show or hide the contact list"]').length
    ).toBe(0);
  });
});
