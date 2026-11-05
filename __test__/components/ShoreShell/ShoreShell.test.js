/**
 * @jest-environment jsdom
 */
import React from "react";
import { mount } from "enzyme";
import { act } from "react-dom/test-utils";
import { MockedProvider } from "@apollo/client/testing";
import { ColorSchemeContext } from "../../../src/components/ColorScheme";
import ShoreShell, {
  SHELL_QUERY,
  SHELL_ADMIN_QUERY
} from "../../../src/components/ShoreShell/ShoreShell";

// The account menu has its own tests (containers/UserMenu.test.js).
jest.mock("../../../src/containers/UserMenu", () => {
  const Stub = () => <div className="user-menu-stub" />;
  return Stub;
});

const shellMock = (roles, logo = null) => ({
  request: { query: SHELL_QUERY, variables: { organizationId: "1" } },
  result: {
    data: {
      currentUser: { __typename: "User", id: "9", roles },
      organization: {
        __typename: "Organization",
        id: "1",
        name: "Graham for Providence",
        logo: logo && { __typename: "OrganizationLogo", ...logo }
      }
    }
  }
});

const adminMock = {
  request: { query: SHELL_ADMIN_QUERY, variables: { organizationId: "1" } },
  result: {
    data: {
      organization: {
        __typename: "Organization",
        id: "1",
        phoneInventoryEnabled: false
      }
    }
  }
};

const SHORE_MENU = {
  org: { slug: "gotv", name: "Graham for Providence" },
  user: { name: "Pat", email: "pat@example.com", role: "staff" },
  groups: [
    {
      label: null,
      items: [
        {
          key: "inbox",
          label: "Inbox",
          icon: "inbox",
          url: "https://shore.test/o/gotv/inbox",
          count: 3
        },
        {
          key: "texting",
          label: "Texting",
          icon: "message",
          url: "https://shore.test/auth/spoke/gotv",
          external: true
        }
      ]
    },
    {
      label: "Admin",
      items: [
        {
          key: "settings",
          label: "Settings",
          icon: "settings",
          url: "https://shore.test/o/gotv/settings"
        }
      ]
    }
  ]
};

const flush = async () => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
};

let setShorePreference;

const render = async ({ roles, menu, path, pending, logo }) => {
  setShorePreference = jest.fn();
  global.fetch = jest.fn(() =>
    pending
      ? new Promise(() => {})
      : Promise.resolve(
          menu
            ? { ok: true, json: () => Promise.resolve(menu) }
            : {
                ok: false,
                json: () => Promise.resolve({ error: "not_configured" })
              }
        )
  );

  let wrapper;
  await act(async () => {
    wrapper = mount(
      <MockedProvider mocks={[shellMock(roles, logo), adminMock]} addTypename>
        <ColorSchemeContext.Provider
          value={{
            preference: "auto",
            scheme: "light",
            followsShore: false,
            setPreference: jest.fn(),
            setShorePreference
          }}
        >
          <ShoreShell
            organizationId="1"
            currentPath={path}
            header={<h1>Page title</h1>}
          >
            <p className="page-body">Hello</p>
          </ShoreShell>
        </ColorSchemeContext.Provider>
      </MockedProvider>
    );
  });
  await flush();
  await flush();
  wrapper.update();
  return wrapper;
};

const navLabels = wrapper =>
  wrapper
    .find("nav a")
    .map(a => a.text().replace(/\d+$/, ""))
    .filter(Boolean);

describe("ShoreShell on a phone", () => {
  const realMatchMedia = window.matchMedia;
  beforeEach(() => {
    // Pretend the screen is phone-sized.
    window.matchMedia = query => ({
      matches: /max-width/.test(query),
      media: query,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {}
    });
  });
  afterEach(() => {
    window.matchMedia = realMatchMedia;
    delete global.fetch;
    window.localStorage.clear();
  });

  it("opens and closes the menu from anywhere on the top bar", async () => {
    const wrapper = await render({ roles: ["TEXTER"], path: "/app/1/todos" });
    const bar = () => wrapper.find('[role="button"][aria-expanded]').first();
    expect(bar().prop("aria-label")).toBe("Open menu");
    expect(bar().text()).toContain("Graham for Providence");
    await act(async () => {
      bar().simulate("click");
    });
    wrapper.update();
    expect(bar().prop("aria-expanded")).toBe(true);
    expect(bar().prop("aria-label")).toBe("Close menu");
    await act(async () => {
      bar().simulate("click");
    });
    wrapper.update();
    expect(bar().prop("aria-expanded")).toBe(false);
  });

  it("opens with the keyboard too", async () => {
    const wrapper = await render({ roles: ["TEXTER"], path: "/app/1/todos" });
    const bar = () => wrapper.find('[role="button"][aria-expanded]').first();
    await act(async () => {
      bar().simulate("keydown", { key: "Enter" });
    });
    wrapper.update();
    expect(bar().prop("aria-expanded")).toBe(true);
  });
});

describe("ShoreShell", () => {
  afterEach(() => {
    delete global.fetch;
    window.localStorage.clear();
  });

  it("renders the page inside the panel, with the campaign brand", async () => {
    const wrapper = await render({ roles: ["TEXTER"], path: "/app/1/todos" });
    expect(wrapper.find("main h1").text()).toBe("Page title");
    expect(wrapper.find("main .page-body").text()).toBe("Hello");
    expect(wrapper.text()).toContain("Graham for Providence");
    expect(wrapper.text()).toContain("GP");
    expect(wrapper.find(".user-menu-stub").length).toBe(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "/shore-menu/1",
      expect.objectContaining({ cache: "no-store", credentials: "same-origin" })
    );
  });

  it("shows a texter only My assignments, and no Shore mark, without Shore", async () => {
    const wrapper = await render({ roles: ["TEXTER"], path: "/app/1/todos" });
    expect(navLabels(wrapper)).toEqual(["My assignments"]);
    const current = wrapper.find('nav a[aria-current="page"]');
    expect(current.text()).toBe("My assignments");
    expect(wrapper.find('[aria-label="Shore"]').length).toBe(0);
    // react-router fills in href only inside a router; check the target.
    expect(wrapper.find('Link[aria-current="page"]').prop("to")).toBe(
      "/app/1/todos"
    );
  });

  it("follows the person's Shore colour scheme, or Spoke's without Shore", async () => {
    await render({
      roles: ["TEXTER"],
      menu: {
        ...SHORE_MENU,
        user: { ...SHORE_MENU.user, colorScheme: "dark" }
      },
      path: "/app/1/todos"
    });
    expect(setShorePreference).toHaveBeenLastCalledWith("dark");
    await render({ roles: ["TEXTER"], path: "/app/1/todos" });
    expect(setShorePreference).toHaveBeenLastCalledWith(null);
  });

  it("shows Shore's menu with Spoke's pages under Texting for admins", async () => {
    const wrapper = await render({
      roles: ["TEXTER", "SUPERVOLUNTEER", "ADMIN", "OWNER"],
      menu: SHORE_MENU,
      path: "/admin/1/tags"
    });
    expect(navLabels(wrapper)).toEqual([
      "Inbox",
      "Texting",
      "My assignments",
      "Campaigns",
      "Message Review",
      "Settings",
      "Settings"
    ]);
    expect(wrapper.text()).toContain("Admin");
    const inbox = wrapper.find('nav a[href="https://shore.test/o/gotv/inbox"]');
    expect(inbox.text()).toContain("3");
    expect(wrapper.find('[aria-label="Shore"]').length).toBeGreaterThan(0);
    expect(document.title).toBe("Graham for Providence • Shore • Texting");
    const current = wrapper
      .find('nav a[aria-current="page"]')
      .map(a => a.text());
    expect(current).toEqual(["Texting", "Settings"]);
  });

  describe("the campaign logo", () => {
    const logo = { light: "/org-logo/1/light?v=1", dark: null };

    it("uses the organization's own logo without Shore", async () => {
      const wrapper = await render({
        roles: ["TEXTER"],
        path: "/app/1/todos",
        logo
      });
      expect(wrapper.find("CampaignBrand").prop("logoUrl")).toBe(logo.light);
    });

    it("uses Shore's logo, not Spoke's, with Shore's menu", async () => {
      const wrapper = await render({
        roles: ["TEXTER"],
        path: "/app/1/todos",
        logo,
        menu: {
          ...SHORE_MENU,
          org: { ...SHORE_MENU.org, publicLogo: { light: "https://shore/l" } }
        }
      });
      expect(wrapper.find("CampaignBrand").prop("logoUrl")).toBe(
        "https://shore/l"
      );
    });
  });
});
