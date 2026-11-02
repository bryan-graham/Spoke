/**
 * @jest-environment jsdom
 */
import React from "react";
import { shallow } from "enzyme";
import { StyleSheetTestUtils } from "aphrodite";
import Autocomplete from "@material-ui/lab/Autocomplete";
import {
  CampaignContactsForm,
  errorMessage
} from "../../../../src/extensions/contact-loaders/shore/react-component";

const segments = [
  { id: "seg-1", name: "Pledged", description: "d", textableCount: 412 },
  { id: "seg-2", name: "Volunteers", description: null, textableCount: 7 }
];

const render = props =>
  shallow(
    <CampaignContactsForm
      onChange={jest.fn()}
      onSubmit={jest.fn()}
      saveLabel="Save"
      icons={{}}
      clientChoiceData={JSON.stringify({
        segments,
        fetchedAt: "2026-11-01T14:00:00Z"
      })}
      {...props}
    />
  );

describe("shore CampaignContactsForm", () => {
  beforeEach(() => StyleSheetTestUtils.suppressStyleInjection());
  afterEach(() => StyleSheetTestUtils.clearBufferAndResumeStyleInjection());

  it("lists segments and sends the chosen one as the payload", () => {
    const onChange = jest.fn();
    const wrapper = render({ onChange });
    const picker = wrapper.find(Autocomplete);
    expect(picker.prop("options")).toEqual(segments);
    picker.prop("onChange")({}, segments[1]);
    expect(JSON.parse(onChange.mock.calls[0][0])).toEqual({
      segmentId: "seg-2",
      segmentName: "Volunteers"
    });
    wrapper.find(Autocomplete).prop("onChange")({}, null);
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it("preselects the last loaded segment", () => {
    const wrapper = render({
      lastResult: {
        reference: JSON.stringify({
          segmentId: "seg-1",
          segmentName: "Pledged"
        }),
        result: JSON.stringify({ finalCount: 3, invalidCellCount: 2 })
      }
    });
    expect(wrapper.find(Autocomplete).prop("value")).toEqual(segments[0]);
    expect(wrapper.html()).toContain("Segment: Pledged");
    expect(wrapper.html()).toContain("2 contacts with an invalid cell number");
  });

  it("shows Shore errors in words", () => {
    const wrapper = render({
      clientChoiceData: JSON.stringify({ error: "shore_unreachable" })
    });
    expect(wrapper.find(Autocomplete).exists()).toBe(false);
    expect(wrapper.text()).toContain("Couldn't reach Shore");
    expect(errorMessage("something_new")).toBe(
      "The load failed (something_new)."
    );
  });
});
