import PropTypes from "prop-types";
import React from "react";
import { hasRole } from "../lib";
import TopNav from "./TopNav";
import { gql } from "@apollo/client";
import { withRouter } from "react-router";
import loadData from "../containers/hoc/load-data";
import ShoreShell from "./ShoreShell/ShoreShell";
import SettingsTabs from "./ShoreShell/SettingsTabs";
import { settingsTabs } from "./ShoreShell/buildNav";

// Admin pages inside the Shore shell. The sidebar (with Spoke's pages as
// sub-items under Texting) comes from ShoreShell; this works out the page
// title and back link, and adds the tabs on the Settings pages.
class AdminDashboard extends React.Component {
  urlFromPath(path) {
    const organizationId = this.props.params.organizationId;
    return `/admin/${organizationId}/${path}`;
  }

  render() {
    const { location, children, params } = this.props;
    const { roles } = this.props.data.currentUser;

    // HACK: Setting params.adminPerms helps us hide non-supervolunteer functionality
    params.adminPerms = hasRole("ADMIN", roles || []);
    params.ownerPerms = hasRole("OWNER", roles || []);

    const organizationId = params.organizationId;
    const tabs = settingsTabs({
      organizationId,
      roles,
      phoneInventoryEnabled: this.props.data.organization.phoneInventoryEnabled,
      currentPath: location.pathname
    });
    const currentTab = tabs.find(tab => tab.active);

    const sections = [
      { name: "Campaigns", path: "campaigns" },
      { name: "Message Review", path: "incoming" }
    ];
    const currentSection = currentTab
      ? { name: "Settings", path: currentTab.to.split("/").pop() }
      : sections.find(section => location.pathname.match(`/${section.path}`)) ||
        null;

    const title = currentSection ? currentSection.name : "Admin";
    const backToURL =
      currentSection &&
      location.pathname.split("/").pop() !== currentSection.path
        ? this.urlFromPath(currentSection.path)
        : null;

    return (
      <ShoreShell
        organizationId={params.organizationId}
        currentPath={location.pathname}
        header={
          <>
            <TopNav
              title={title}
              backToURL={backToURL}
              orgId={params.organizationId}
            />
            {currentTab ? <SettingsTabs tabs={tabs} /> : null}
          </>
        }
      >
        {children}
      </ShoreShell>
    );
  }
}

AdminDashboard.propTypes = {
  router: PropTypes.object,
  params: PropTypes.object,
  children: PropTypes.object,
  location: PropTypes.object
};

const queries = {
  data: {
    query: gql`
      query getCurrentUserRoles($organizationId: String!) {
        currentUser {
          id
          roles(organizationId: $organizationId)
        }
        organization(id: $organizationId) {
          name
          phoneInventoryEnabled
        }
      }
    `,
    options: ownProps => ({
      variables: {
        organizationId: ownProps.params.organizationId
      }
    })
  }
};

export default loadData({ queries })(withRouter(AdminDashboard));
