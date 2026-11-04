/**
 * @jest-environment jsdom
 */
import React from "react";
import { mount } from "enzyme";
import { act } from "react-dom/test-utils";
import { MockedProvider } from "@apollo/client/testing";
import OrganizationLogoSettings, {
  ORGANIZATION_LOGO_QUERY,
  fileProblem,
  MAX_BYTES
} from "../../src/components/OrganizationLogoSettings";

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

const logoMock = logo => ({
  request: {
    query: ORGANIZATION_LOGO_QUERY,
    variables: { organizationId: "1" }
  },
  result: {
    data: {
      organization: {
        __typename: "Organization",
        id: "1",
        name: "Graham for Providence",
        logo: { __typename: "OrganizationLogo", ...logo }
      }
    }
  }
});

const render = async ({ menu, logo }) => {
  global.fetch = jest.fn(() =>
    Promise.resolve(
      menu
        ? { ok: true, json: () => Promise.resolve(menu) }
        : { ok: false, json: () => Promise.resolve({}) }
    )
  );
  let wrapper;
  await act(async () => {
    wrapper = mount(
      <MockedProvider mocks={[logoMock(logo)]} addTypename>
        <OrganizationLogoSettings organizationId="1" />
      </MockedProvider>
    );
  });
  await act(async () => {
    await flush();
    await flush();
  });
  wrapper.update();
  return wrapper;
};

describe("OrganizationLogoSettings", () => {
  afterEach(() => {
    delete global.fetch;
    window.localStorage.clear();
  });

  it("offers a light and a dark logo without Shore", async () => {
    const wrapper = await render({
      logo: { light: "/org-logo/1/light?v=1", dark: null }
    });
    const light = wrapper.find('[data-test="logo-light"]').first();
    const dark = wrapper.find('[data-test="logo-dark"]').first();
    expect(light.text()).toContain("Uploaded");
    expect(light.text()).toContain("Replace");
    expect(light.text()).toContain("Remove");
    // without a dark version the light one is used in dark mode
    expect(dark.text()).toContain("Using the light logo");
    expect(dark.text()).toContain("Upload");
    expect(dark.text()).not.toContain("Remove");
    expect(wrapper.find('input[type="file"]').length).toBe(2);
  });

  it("points to Shore when the logo comes from Shore", async () => {
    const wrapper = await render({
      logo: { light: null, dark: null },
      menu: {
        org: { name: "Graham for Providence" },
        groups: [
          {
            label: "Admin",
            items: [
              {
                key: "settings",
                label: "Settings",
                url: "https://app.shore.vote/o/gfp/settings"
              }
            ]
          }
        ]
      }
    });
    expect(wrapper.find('[data-test="logo-from-shore"]').length).toBe(1);
    expect(wrapper.find("a").prop("href")).toBe(
      "https://app.shore.vote/o/gfp/settings"
    );
    expect(wrapper.find('input[type="file"]').length).toBe(0);
  });

  it("checks a file before uploading it", () => {
    expect(fileProblem({ type: "image/png", size: 1000 })).toBeNull();
    expect(fileProblem({ type: "image/svg+xml", size: 1000 })).toContain("PNG");
    expect(fileProblem({ type: "image/png", size: MAX_BYTES + 1 })).toContain(
      "512 KB"
    );
  });
});
