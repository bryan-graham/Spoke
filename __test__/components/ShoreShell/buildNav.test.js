import {
  buildNav,
  spokeSubItems,
  settingsTabs,
  monogram
} from "../../../src/components/ShoreShell/buildNav";

const SHORE_MENU = {
  org: { slug: "graham-for-providence", name: "Graham for Providence" },
  user: { name: "Pat Example", email: "pat@example.com", role: "staff" },
  groups: [
    {
      label: null,
      items: [
        {
          key: "inbox",
          label: "Inbox",
          icon: "inbox",
          url: "https://app.shore.vote/o/graham-for-providence/inbox",
          count: 3
        },
        {
          key: "texting",
          label: "Texting",
          icon: "message",
          url: "https://app.shore.vote/auth/spoke/graham-for-providence",
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
          url: "https://app.shore.vote/o/graham-for-providence/settings"
        }
      ]
    }
  ]
};

const admin = ["TEXTER", "SUPERVOLUNTEER", "ADMIN", "OWNER"];

describe("buildNav", () => {
  it("shows Shore's menu, with Texting as Spoke and current", () => {
    const groups = buildNav({
      shoreMenu: SHORE_MENU,
      organizationId: "1",
      roles: ["TEXTER"],
      currentPath: "/app/1/todos"
    });
    expect(groups.map(g => g.label)).toEqual([null, "Admin"]);
    const [inbox, texting] = groups[0].items;
    expect(inbox).toEqual({
      key: "inbox",
      label: "Inbox",
      icon: "inbox",
      href: "https://app.shore.vote/o/graham-for-providence/inbox",
      newTab: false,
      count: 3
    });
    expect(texting).toMatchObject({
      key: "texting",
      label: "Texting",
      to: "/app/1/todos",
      active: true,
      subItems: []
    });
    expect(texting.href).toBeUndefined();
  });

  it("gives texters Texting with no sub-items", () => {
    const groups = buildNav({
      shoreMenu: SHORE_MENU,
      organizationId: "1",
      roles: ["TEXTER"],
      currentPath: "/app/1/todos"
    });
    const texting = groups[0].items.find(i => i.key === "texting");
    expect(texting.subItems).toEqual([]);
  });

  it("gives admins Spoke's pages under Texting, and marks the current one", () => {
    const groups = buildNav({
      shoreMenu: { groups: [{ label: null, items: [] }] },
      organizationId: "7",
      roles: admin,
      currentPath: "/admin/7/campaigns/12/edit"
    });
    const texting = groups[0].items[0];
    expect(texting.to).toBe("/admin/7/campaigns");
    expect(texting.subItems.map(i => i.label)).toEqual([
      "My assignments",
      "Campaigns",
      "Message Review",
      "Settings"
    ]);
    expect(texting.subItems.filter(i => i.active).map(i => i.key)).toEqual([
      "campaigns"
    ]);
    expect(texting.subItems[0]).toMatchObject({
      to: "/app/7/todos",
      dataTest: "navSwitchToTexter"
    });
  });

  describe("without Shore (not connected, unreachable, or not a member)", () => {
    it("lists Spoke's pages at the top level for admins, with no nesting", () => {
      const groups = buildNav({
        shoreMenu: null,
        organizationId: "7",
        roles: admin,
        currentPath: "/admin/7/people"
      });
      expect(groups).toHaveLength(1);
      expect(groups[0].label).toBeNull();
      expect(groups[0].items.map(i => i.label)).toEqual([
        "My assignments",
        "Campaigns",
        "Message Review",
        "Settings"
      ]);
      expect(groups[0].items.some(i => i.key === "texting")).toBe(false);
      expect(groups[0].items.some(i => i.subItems)).toBe(false);
      expect(groups[0].items.filter(i => i.active).map(i => i.key)).toEqual([
        "settings"
      ]);
    });

    it("gives texters My assignments only", () => {
      const [group] = buildNav({
        shoreMenu: null,
        organizationId: "1",
        roles: ["TEXTER"],
        currentPath: "/app/1/todos"
      });
      expect(group.items.map(i => [i.label, i.to, i.active])).toEqual([
        ["My assignments", "/app/1/todos", true]
      ]);
    });

    it("links Home when there's no organization yet", () => {
      const [group] = buildNav({ shoreMenu: null, roles: [] });
      expect(group.items.map(i => i.to)).toEqual(["/app"]);
    });
  });

  it("filters Spoke's pages by role and phone inventory", () => {
    const sup = spokeSubItems({
      organizationId: "1",
      roles: ["TEXTER", "SUPERVOLUNTEER"],
      phoneInventoryEnabled: true
    }).map(i => i.key);
    expect(sup).toEqual(["assignments", "campaigns", "incoming", "settings"]);
  });

  describe("settingsTabs", () => {
    it("lists Users, Bulk Script Editor, Tags, Phone Numbers and General for admins", () => {
      const tabs = settingsTabs({
        organizationId: "7",
        roles: admin,
        phoneInventoryEnabled: true,
        currentPath: "/admin/7/settings"
      });
      expect(tabs.map(t => [t.label, t.to])).toEqual([
        ["Users", "/admin/7/people"],
        ["Bulk Script Editor", "/admin/7/bulk-script-editor"],
        ["Tags", "/admin/7/tags"],
        ["Phone Numbers", "/admin/7/phone-numbers"],
        ["General", "/admin/7/settings"]
      ]);
      expect(tabs.filter(t => t.active).map(t => t.key)).toEqual(["general"]);
    });

    it("filters by role and phone inventory", () => {
      const sup = settingsTabs({
        organizationId: "1",
        roles: ["TEXTER", "SUPERVOLUNTEER"],
        phoneInventoryEnabled: true
      }).map(t => t.key);
      expect(sup).toEqual(["tags", "general"]);
      const noPhones = settingsTabs({
        organizationId: "1",
        roles: admin,
        phoneInventoryEnabled: false
      }).map(t => t.key);
      expect(noPhones).not.toContain("phone-numbers");
    });

    it("points the Settings nav item at the first tab the person can see", () => {
      const settingsFor = roles =>
        spokeSubItems({ organizationId: "1", roles }).find(
          i => i.key === "settings"
        );
      expect(settingsFor(admin).to).toBe("/admin/1/people");
      expect(settingsFor(["TEXTER", "SUPERVOLUNTEER"]).to).toBe(
        "/admin/1/tags"
      );
    });
  });

  it("adds Texting when Shore's menu doesn't include it", () => {
    const groups = buildNav({
      shoreMenu: {
        groups: [{ label: null, items: [SHORE_MENU.groups[0].items[0]] }]
      },
      organizationId: "1",
      roles: ["TEXTER"]
    });
    expect(groups[0].items.map(i => i.key)).toEqual(["inbox", "texting"]);
  });

  it("hides zero counts and opens external items in a new tab", () => {
    const groups = buildNav({
      shoreMenu: {
        groups: [
          {
            label: null,
            items: [
              { key: "a", label: "A", url: "https://x.test/a", count: 0 },
              { key: "b", label: "B", url: "https://x.test/b", external: true }
            ]
          }
        ]
      },
      organizationId: "1",
      roles: []
    });
    expect(groups[0].items[0].count).toBeNull();
    expect(groups[0].items[1].newTab).toBe(true);
  });
});

describe("monogram", () => {
  it("uses the first and last significant words", () => {
    expect(monogram("Graham for Providence")).toBe("GP");
    expect(monogram("The Committee to Elect Pat")).toBe("CP");
    expect(monogram("Spoke")).toBe("SP");
    expect(monogram("")).toBe("?");
    expect(monogram("Élan & Co.")).toBe("ÉC");
  });
});
