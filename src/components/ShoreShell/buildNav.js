import { hasRole } from "../../lib/permissions";

// Builds the sidebar's navigation from Shore's shared menu (when Spoke could
// fetch it) and Spoke's own pages.
//
// - Shore's groups and items appear as Shore sends them, linking back into
//   Shore.
// - Shore's "texting" item is Spoke itself: it's always the current item and
//   links to Spoke's home for this person.
// - People with admin access in Spoke see Spoke's pages as sub-items under
//   Texting; texters see Texting alone.
// - Without Shore's menu (not configured, unreachable, or not a Shore member),
//   the sidebar shows Texting and its sub-items only.

// Spoke's own pages, with the minimum role that may see each.
export const SPOKE_SECTIONS = [
  {
    key: "campaigns",
    label: "Campaigns",
    icon: "speakerphone",
    path: "campaigns",
    role: "SUPERVOLUNTEER"
  },
  {
    key: "people",
    label: "People",
    icon: "users",
    path: "people",
    role: "ADMIN"
  },
  {
    key: "incoming",
    label: "Message Review",
    icon: "messages",
    path: "incoming",
    role: "SUPERVOLUNTEER"
  },
  {
    key: "bulk-script-editor",
    label: "Bulk Script Editor",
    icon: "file-text",
    path: "bulk-script-editor",
    role: "ADMIN"
  },
  {
    key: "tags",
    label: "Tags",
    icon: "tags",
    path: "tags",
    role: "SUPERVOLUNTEER"
  },
  {
    key: "settings",
    label: "Settings",
    icon: "settings",
    path: "settings",
    role: "SUPERVOLUNTEER"
  },
  {
    key: "phone-numbers",
    label: "Phone Numbers",
    icon: "phone",
    path: "phone-numbers",
    role: "ADMIN",
    needsPhoneInventory: true
  }
];

const isAdmin = roles => hasRole("SUPERVOLUNTEER", roles || []);

const pathMatches = (currentPath, to) =>
  Boolean(currentPath) &&
  (currentPath === to || currentPath.startsWith(`${to}/`));

export function spokeSubItems({
  organizationId,
  roles,
  phoneInventoryEnabled,
  currentPath
}) {
  if (!organizationId || !isAdmin(roles)) {
    return [];
  }
  const items = [
    {
      key: "assignments",
      label: "My assignments",
      icon: "list-check",
      to: `/app/${organizationId}/todos`,
      dataTest: "navSwitchToTexter"
    },
    ...SPOKE_SECTIONS.filter(
      s =>
        hasRole(s.role, roles) &&
        (!s.needsPhoneInventory || phoneInventoryEnabled)
    ).map(s => ({
      key: s.key,
      label: s.label,
      icon: s.icon,
      to: `/admin/${organizationId}/${s.path}`
    }))
  ];
  return items.map(item => ({
    ...item,
    active: pathMatches(currentPath, item.to)
  }));
}

function textingItem(base, context) {
  const { organizationId, roles } = context;
  const subItems = spokeSubItems(context);
  return {
    key: "texting",
    label: (base && base.label) || "Texting",
    icon: (base && base.icon) || "message",
    to: organizationId
      ? isAdmin(roles)
        ? `/admin/${organizationId}/campaigns`
        : `/app/${organizationId}/todos`
      : "/app",
    active: true,
    subItems
  };
}

function shoreItem(item) {
  return {
    key: item.key,
    label: item.label,
    icon: item.icon,
    href: item.url,
    newTab: Boolean(item.external),
    count: typeof item.count === "number" && item.count > 0 ? item.count : null
  };
}

export function buildNav({ shoreMenu, ...context }) {
  if (!shoreMenu || !Array.isArray(shoreMenu.groups)) {
    return [{ label: null, items: [textingItem(null, context)] }];
  }
  let placed = false;
  const groups = shoreMenu.groups.map(group => ({
    label: group.label || null,
    items: (group.items || []).map(item => {
      if (item.key === "texting") {
        placed = true;
        return textingItem(item, context);
      }
      return shoreItem(item);
    })
  }));
  if (!placed) {
    if (groups.length === 0) {
      groups.push({ label: null, items: [] });
    }
    groups[0].items.push(textingItem(null, context));
  }
  return groups;
}

// "Graham for Providence" -> "GP"; "Spoke" -> "SP".
export function monogram(name) {
  const words = String(name || "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(w => w && !/^(for|the|of|and|to|a)$/i.test(w));
  if (words.length === 0) {
    return "?";
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
