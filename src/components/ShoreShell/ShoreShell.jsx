import React, { useState } from "react";
import PropTypes from "prop-types";
import { gql, useQuery } from "@apollo/client";
import { makeStyles } from "@material-ui/core/styles";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import Drawer from "@material-ui/core/Drawer";
import IconButton from "@material-ui/core/IconButton";
import { IconMenu2 } from "@tabler/icons-react";
import { hasRole } from "../../lib/permissions";
import { tokens, layout, fonts } from "../../styles/shore-tokens";
import UserMenu from "../../containers/UserMenu";
import NavItem from "./NavItem";
import ShoreWordmark from "./ShoreWordmark";
import useShoreMenu from "./useShoreMenu";
import { buildNav, monogram } from "./buildNav";

// The Shore shell (docs/shore-design-guide.md, "Layout"): one canvas
// background shared by the sidebar and the area around a raised page panel.
// Desktop has no top bar; phones get a 56px top bar and a slide-in sidebar.

const PHONE = `(max-width:${layout.phoneBreakpoint - 0.02}px)`;

export const SHELL_QUERY = gql`
  query getShoreShell($organizationId: String!) {
    currentUser {
      id
      roles(organizationId: $organizationId)
    }
    organization(id: $organizationId) {
      id
      name
    }
  }
`;

// Only supervolunteers and up may read this setting.
export const SHELL_ADMIN_QUERY = gql`
  query getShoreShellAdmin($organizationId: String!) {
    organization(id: $organizationId) {
      id
      phoneInventoryEnabled
    }
  }
`;

const useStyles = makeStyles({
  root: {
    display: "flex",
    minHeight: "100vh",
    backgroundColor: tokens.canvas,
    "@media print": { display: "block", backgroundColor: "#FFFFFF" }
  },
  sidebar: {
    width: layout.sidebarWidth,
    flexShrink: 0,
    position: "sticky",
    top: 0,
    height: "100vh",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    padding: "16px 12px 14px",
    backgroundColor: tokens.canvas,
    "@media print": { display: "none" }
  },
  drawerPaper: {
    width: layout.sidebarWidth,
    backgroundColor: tokens.canvas,
    borderRight: "none"
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "4px 6px 18px"
  },
  tile: {
    flexShrink: 0,
    borderRadius: 10,
    background: tokens.monogram,
    color: "#FFFFFF",
    fontFamily: fonts.heading,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    letterSpacing: "-0.02em"
  },
  brandName: {
    fontFamily: fonts.heading,
    fontWeight: 700,
    color: tokens.text,
    lineHeight: 1.2,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical"
  },
  nav: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: "0 2px"
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: tokens.dimmed,
    padding: "16px 10px 6px"
  },
  footer: {
    paddingTop: 10,
    display: "flex",
    flexDirection: "column",
    gap: 10
  },
  mark: { padding: "0 8px" },
  topBar: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    height: layout.phoneTopBar,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 8px",
    backgroundColor: tokens.canvas,
    "@media print": { display: "none" }
  },
  main: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column"
  },
  panel: {
    flex: 1,
    margin: `${layout.panelGap}px ${layout.panelGap}px ${layout.panelGap}px 0`,
    backgroundColor: tokens.panel,
    borderRadius: layout.panelRadius,
    border: `1px solid ${tokens.panelBorder}`,
    boxShadow: tokens.panelShadow,
    minWidth: 0,
    "@media print": {
      margin: 0,
      border: "none",
      borderRadius: 0,
      boxShadow: "none"
    }
  },
  panelPhone: {
    margin: 0,
    border: "none",
    borderRadius: 0,
    boxShadow: "none"
  },
  page: {
    maxWidth: layout.pageMaxWidth,
    margin: "0 auto",
    padding: `${layout.pagePadding.top}px ${layout.pagePadding.side}px ${layout.pagePadding.bottom}px`,
    boxSizing: "border-box"
  },
  pagePhone: {
    padding: `${layout.phonePagePadding.top}px ${layout.phonePagePadding.side}px ${layout.phonePagePadding.bottom}px`
  }
});

export function CampaignBrand({ name, small }) {
  const classes = useStyles();
  const size = small ? 32 : 46;
  return (
    <div className={classes.brand} style={small ? { padding: 0 } : undefined}>
      <div
        className={classes.tile}
        style={{ width: size, height: size, fontSize: small ? 13 : 17 }}
        aria-hidden
      >
        {monogram(name)}
      </div>
      <div className={classes.brandName} style={{ fontSize: small ? 14 : 17 }}>
        {name}
      </div>
    </div>
  );
}

CampaignBrand.propTypes = { name: PropTypes.string, small: PropTypes.bool };

export function SidebarContent({
  groups,
  brandName,
  showBrand,
  organizationId,
  onNavigate
}) {
  const classes = useStyles();
  return (
    <>
      {showBrand && brandName ? <CampaignBrand name={brandName} /> : null}
      <nav className={classes.nav} aria-label="Main">
        {groups.map((group, i) => (
          <div key={`${group.label || "group"}-${i}`}>
            {group.label ? (
              <div className={classes.groupLabel}>{group.label}</div>
            ) : null}
            {group.items.map(item => (
              <React.Fragment key={item.key}>
                <NavItem item={item} onNavigate={onNavigate} />
                {(item.subItems || []).map(subItem => (
                  <NavItem
                    key={subItem.key}
                    item={subItem}
                    sub
                    onNavigate={onNavigate}
                  />
                ))}
              </React.Fragment>
            ))}
          </div>
        ))}
      </nav>
      <div className={classes.footer}>
        <UserMenu orgId={organizationId} variant="sidebar" />
        <div className={classes.mark}>
          <ShoreWordmark />
        </div>
      </div>
    </>
  );
}

SidebarContent.propTypes = {
  groups: PropTypes.array.isRequired,
  brandName: PropTypes.string,
  showBrand: PropTypes.bool,
  organizationId: PropTypes.string,
  onNavigate: PropTypes.func
};

export default function ShoreShell({
  organizationId,
  currentPath,
  header,
  children
}) {
  const classes = useStyles();
  const isPhone = useMediaQuery(PHONE, { noSsr: true });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const shoreMenu = useShoreMenu(organizationId);

  const { data } = useQuery(SHELL_QUERY, {
    variables: { organizationId },
    skip: !organizationId
  });
  const roles = (data && data.currentUser && data.currentUser.roles) || [];
  const isAdmin = hasRole("SUPERVOLUNTEER", roles);
  const { data: adminData } = useQuery(SHELL_ADMIN_QUERY, {
    variables: { organizationId },
    skip: !organizationId || !isAdmin
  });

  const groups = buildNav({
    shoreMenu,
    organizationId,
    roles,
    currentPath,
    phoneInventoryEnabled: Boolean(
      adminData &&
        adminData.organization &&
        adminData.organization.phoneInventoryEnabled
    )
  });
  const brandName =
    (shoreMenu && shoreMenu.org && shoreMenu.org.name) ||
    (data && data.organization && data.organization.name) ||
    "";

  const sidebar = (
    <SidebarContent
      groups={groups}
      brandName={brandName}
      showBrand={!isPhone}
      organizationId={organizationId}
      onNavigate={isPhone ? () => setDrawerOpen(false) : undefined}
    />
  );

  return (
    <div className={classes.root}>
      {isPhone ? (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          classes={{ paper: classes.drawerPaper }}
        >
          <div className={classes.sidebar} style={{ position: "static" }}>
            {sidebar}
          </div>
        </Drawer>
      ) : (
        <aside className={classes.sidebar}>{sidebar}</aside>
      )}
      <div className={classes.main}>
        {isPhone ? (
          <div className={classes.topBar}>
            <IconButton
              aria-label="Open menu"
              onClick={() => setDrawerOpen(true)}
            >
              <IconMenu2 size={22} stroke={layout.iconStroke} />
            </IconButton>
            {brandName ? <CampaignBrand name={brandName} small /> : null}
          </div>
        ) : null}
        <main
          className={`${classes.panel} ${isPhone ? classes.panelPhone : ""}`}
        >
          <div
            className={`${classes.page} ${isPhone ? classes.pagePhone : ""}`}
          >
            {header}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

ShoreShell.propTypes = {
  organizationId: PropTypes.string,
  currentPath: PropTypes.string,
  header: PropTypes.node,
  children: PropTypes.node
};
