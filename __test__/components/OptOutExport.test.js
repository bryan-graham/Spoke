/**
 * @jest-environment jsdom
 */
import React from "react";
import { mount } from "enzyme";
import { act } from "react-dom/test-utils";
import { MockedProvider } from "@apollo/client/testing";
import OptOutExport, {
  exportRange,
  exportUrl,
  inputDate
} from "../../src/components/OptOutExport";
import { SHELL_QUERY } from "../../src/components/ShoreShell/ShoreShell";

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

const shellMock = roles => ({
  request: { query: SHELL_QUERY, variables: { organizationId: "1" } },
  result: {
    data: {
      currentUser: { __typename: "User", id: "9", roles },
      organization: {
        __typename: "Organization",
        id: "1",
        name: "Graham for Providence",
        logo: null
      }
    }
  }
});

const render = async ({ roles, shore }) => {
  global.fetch = jest.fn(() =>
    Promise.resolve(
      shore
        ? {
            ok: true,
            json: () => Promise.resolve({ org: {}, groups: [] })
          }
        : { ok: false, json: () => Promise.resolve({}) }
    )
  );
  let wrapper;
  await act(async () => {
    wrapper = mount(
      <MockedProvider mocks={[shellMock(roles)]} addTypename>
        <OptOutExport organizationId="1" today={new Date(2026, 10, 4)} />
      </MockedProvider>
    );
  });
  // let Shore's menu and the roles query settle
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await flush();
    });
  }
  wrapper.update();
  return wrapper;
};

describe("OptOutExport", () => {
  afterEach(() => {
    delete global.fetch;
    window.localStorage.clear();
  });

  it("offers admins the last 30 days by default without Shore", async () => {
    const wrapper = await render({ roles: ["ADMIN", "TEXTER"] });
    expect(wrapper.find('[data-test="optOutExport"]').length).toBeGreaterThan(
      0
    );
    expect(wrapper.find('input[data-test="exportFrom"]').prop("value")).toBe(
      "2026-10-05"
    );
    expect(wrapper.find('input[data-test="exportTo"]').prop("value")).toBe(
      "2026-11-04"
    );
  });

  it("isn't shown to supervolunteers", async () => {
    const wrapper = await render({ roles: ["SUPERVOLUNTEER", "TEXTER"] });
    expect(wrapper.find('[data-test="optOutExport"]').length).toBe(0);
  });

  it("isn't shown when connected to Shore", async () => {
    const wrapper = await render({ roles: ["OWNER", "ADMIN"], shore: true });
    expect(wrapper.find('[data-test="optOutExport"]').length).toBe(0);
  });

  it("includes the whole last day, in local time", () => {
    const range = exportRange("2026-10-01", "2026-10-31");
    expect(range.start).toEqual(new Date(2026, 9, 1));
    expect(range.end).toEqual(new Date(2026, 10, 1));
    const url = exportUrl("1", "2026-10-01", "2026-10-31", range);
    expect(url).toContain("/opt-out-export/1?");
    expect(url).toContain(
      `from=${encodeURIComponent(range.start.toISOString())}`
    );
    expect(url).toContain("label=2026-10-01-to-2026-10-31");
  });

  it("says when the dates don't work", () => {
    expect(exportRange("", "2026-10-31").error).toContain("start and end");
    expect(exportRange("2026-11-02", "2026-11-01").error).toContain(
      "on or after"
    );
    expect(inputDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
