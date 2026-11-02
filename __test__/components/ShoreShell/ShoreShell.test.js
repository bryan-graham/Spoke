/**
 * @jest-environment jsdom
 */
import React from "react";
import { mount } from "enzyme";
import { act } from "react-dom/test-utils";
import { MockedProvider } from "@apollo/client/testing";
import ShoreShell, {
  SHELL_QUERY,
  SHELL_ADMIN_QUERY
} from "../../../src/components/ShoreShell/ShoreShell";

// The account menu has its own tests (containers/UserMenu.test.js).
jest.mock("../../../src/containers/UserMenu", () => {
  const Stub = () => <div className="user-menu-stub" />;
  return Stub;
});

const shellMock = roles => ({
  request: { query: SHELL_QUERY, variables: { organizationId: "1" } },
  result: {
    data: {
      currentUser: { __typename: "User", id: "9", roles },
      organization: {
        __typename: "Organization",
        id: "1",
        name: "Graham for Providence"
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

const render = async ({ roles, menu, path }) => {
  global.fetch = jest.fn(() =>
    Promise.resolve(
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
      <MockedProvider mocks={[shellMock(roles), adminMock]} addTypename>
        <ShoreShell
          organizationId="1"
          currentPath={path}
          header={<h1>Page title</h1>}
        >
          <p className="page-body">Hello</p>
        </ShoreShell>
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

describe("ShoreShell", () => {
  afterEach(() => {
    delete global.fetch;
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

  it("shows a texter only Texting when there's no Shore menu", async () => {
    const wrapper = await render({ roles: ["TEXTER"], path: "/app/1/todos" });
    expect(navLabels(wrapper)).toEqual(["Texting"]);
    const texting = wrapper.find('nav a[aria-current="page"]');
    expect(texting.text()).toBe("Texting");
    // react-router fills in href only inside a router; check the target.
    expect(wrapper.find('Link[aria-current="page"]').prop("to")).toBe(
      "/app/1/todos"
    );
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
      "People",
      "Message Review",
      "Bulk Script Editor",
      "Tags",
      "Settings",
      "Settings"
    ]);
    expect(wrapper.text()).toContain("Admin");
    const inbox = wrapper.find('nav a[href="https://shore.test/o/gotv/inbox"]');
    expect(inbox.text()).toContain("3");
    const current = wrapper
      .find('nav a[aria-current="page"]')
      .map(a => a.text());
    expect(current).toEqual(["Texting", "Tags"]);
  });
});
