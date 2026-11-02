import PropTypes from "prop-types";
import React, { Component } from "react";
import { flowRight as compose } from "lodash";
import { withRouter } from "react-router";
import { gql } from "@apollo/client";

import MenuItem from "@material-ui/core/MenuItem";
import MenuList from "@material-ui/core/MenuList";
import Popover from "@material-ui/core/Popover";
import ListSubheader from "@material-ui/core/ListSubheader";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import Avatar from "@material-ui/core/Avatar";
import IconButton from "@material-ui/core/IconButton";
import Divider from "@material-ui/core/Divider";
import ButtonBase from "@material-ui/core/ButtonBase";
import { v, palette } from "../styles/shore-tokens";
import { IconCheck } from "@tabler/icons-react";
import { ColorSchemeContext } from "../components/ColorScheme";

const APPEARANCE = [
  { value: "auto", label: "Match device" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" }
];

import { dataTest } from "../lib/attributes";
import loadData from "./hoc/load-data";
import withMuiTheme from "./hoc/withSetTheme";

export class UserMenuBase extends Component {
  static contextType = ColorSchemeContext;

  constructor(props) {
    super(props);
    this.state = {
      open: false,
      anchorEl: null
    };
    this.handleReturn = this.handleReturn.bind(this);
    this.handleRequestFaqs = this.handleRequestFaqs.bind(this);
  }

  handleTouchTap = event => {
    // This prevents ghost click.
    event.preventDefault();

    this.setState({
      open: true,
      anchorEl: event.currentTarget
    });
  };

  handleRequestClose = () => {
    this.setState({
      open: false
    });
  };

  handleMenuChange = (event, value) => {
    this.handleRequestClose();
    const { currentUser } = this.props.currentUser;
    if (value === "logout") {
      window.AuthService.logout();
    } else if (value === "account") {
      const { orgId } = this.props;
      if (orgId) {
        this.props.router.push(`/app/${orgId}/account/${currentUser.id}`);
      }
    } else {
      if (currentUser.superVolOrganizations.some(org => org.id === value)) {
        this.props.router.push(`/admin/${value}`);
      } else {
        this.props.router.push(`/app/${value}/todos`);
      }
    }
  };

  handleReturn = e => {
    e.preventDefault();
    const { orgId } = this.props;
    this.props.router.push(`/app/${orgId}/todos`);
  };

  handleRequestFaqs = e => {
    e.preventDefault();
    const { orgId } = this.props;
    this.props.router.push(`/app/${orgId}/faqs`);
  };

  handleAdminOrganizations = e => {
    e.preventDefault();
    this.props.router.push(`/organizations`);
  };

  handleOrgClick = id => {
    this.props.router.push(`/admin/${id}`);
  };

  renderAvatar(user) {
    return (
      <Avatar
        style={{
          color: this.props.muiTheme.palette.text.primary
        }}
      >
        {user.displayName.charAt(0)}
      </Avatar>
    );
  }

  // The Shore shell's sidebar footer: avatar, name and email (design guide,
  // "Sidebar, bottom").
  renderSidebarTrigger(user) {
    return (
      <ButtonBase
        {...dataTest("userMenuButton")}
        onClick={this.handleTouchTap}
        focusRipple
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: 8,
          borderRadius: 8,
          justifyContent: "flex-start",
          textAlign: "left"
        }}
      >
        <Avatar
          style={{
            width: 34,
            height: 34,
            fontSize: 14,
            backgroundColor: palette.navy[7],
            color: "#FFFFFF"
          }}
        >
          {user.displayName.charAt(0)}
        </Avatar>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span
            style={{
              display: "block",
              fontWeight: 600,
              fontSize: 14,
              color: v("text"),
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
          >
            {user.displayName}
          </span>
          <span
            style={{
              display: "block",
              fontSize: 12,
              color: v("dimmed"),
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
          >
            {user.email}
          </span>
        </span>
      </ButtonBase>
    );
  }

  // Light/dark mode. With Shore connected, Spoke follows the person's Shore
  // setting (so both apps match) and it's changed in Shore.
  renderAppearance() {
    const { preference, followsShore, setPreference } = this.context || {};
    const current =
      APPEARANCE.find(a => a.value === preference) || APPEARANCE[0];
    if (followsShore) {
      return (
        <div>
          <ListSubheader>Appearance</ListSubheader>
          <MenuItem {...dataTest("appearanceFromShore")} disabled>
            {current.label} (set in Shore)
          </MenuItem>
          <Divider />
        </div>
      );
    }
    return (
      <div>
        <ListSubheader>Appearance</ListSubheader>
        {APPEARANCE.map(option => (
          <MenuItem
            key={option.value}
            {...dataTest(`appearance-${option.value}`)}
            selected={option.value === current.value}
            onClick={() => {
              if (setPreference) {
                setPreference(option.value);
              }
            }}
          >
            <ListItemIcon style={{ minWidth: 28 }}>
              {option.value === current.value ? (
                <IconCheck size={16} stroke={1.7} />
              ) : (
                <span />
              )}
            </ListItemIcon>
            {option.label}
          </MenuItem>
        ))}
        <Divider />
      </div>
    );
  }

  renderAdminTools() {
    return (
      <div>
        <ListSubheader>Superadmin Tools</ListSubheader>
        <MenuItem
          value={"adminOrganizations"}
          onClick={this.handleAdminOrganizations}
        >
          Manage Organizations
        </MenuItem>
        <Divider />
      </div>
    );
  }

  render() {
    const { currentUser } = this.props.currentUser;
    if (!currentUser) {
      return <div />;
    }
    const organizations = [...currentUser.texterOrganizations].sort((a, b) =>
      a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1
    );
    const isSuperAdmin = currentUser.is_superadmin;
    return (
      <div>
        {this.props.variant === "sidebar" ? (
          this.renderSidebarTrigger(currentUser)
        ) : (
          <IconButton
            {...dataTest("userMenuButton")}
            onClick={this.handleTouchTap}
          >
            {this.renderAvatar(currentUser)}
          </IconButton>
        )}
        <Popover
          open={this.state.open}
          anchorEl={this.state.anchorEl}
          anchorOrigin={
            this.props.variant === "sidebar"
              ? { horizontal: "left", vertical: "top" }
              : { horizontal: "left", vertical: "bottom" }
          }
          transformOrigin={
            this.props.variant === "sidebar"
              ? { horizontal: "left", vertical: "bottom" }
              : { horizontal: "left", vertical: "top" }
          }
          onClose={this.handleRequestClose}
        >
          <MenuList onChange={this.handleMenuChange}>
            <MenuItem
              {...dataTest("userMenuDisplayName")}
              disabled={!this.props.orgId}
              onClick={event => {
                this.handleMenuChange(event, "account");
              }}
            >
              <ListItemIcon>{this.renderAvatar(currentUser)}</ListItemIcon>
              {currentUser.email} <br />
              {currentUser.displayName}
            </MenuItem>
            <Divider />
            {isSuperAdmin ? this.renderAdminTools() : <div />}
            <ListSubheader>Teams</ListSubheader>
            {organizations.map(organization => (
              <MenuItem
                key={organization.id}
                onClick={() => this.handleOrgClick(organization.id)}
              >
                {organization.name}
              </MenuItem>
            ))}
            <Divider />
            <MenuItem {...dataTest("home")} onClick={this.handleReturn}>
              Home
            </MenuItem>
            <MenuItem {...dataTest("FAQs")} onClick={this.handleRequestFaqs}>
              FAQs
            </MenuItem>
            <Divider />
            {this.renderAppearance()}
            <MenuItem
              {...dataTest("userMenuLogOut")}
              onClick={event => {
                this.handleMenuChange(event, "logout");
              }}
            >
              Log out
            </MenuItem>
          </MenuList>
        </Popover>
      </div>
    );
  }
}

UserMenuBase.propTypes = {
  data: PropTypes.object,
  orgId: PropTypes.string,
  router: PropTypes.object,
  variant: PropTypes.oneOf(["icon", "sidebar"])
};

const queries = {
  currentUser: {
    query: gql`
      query getCurrentUserForMenu {
        currentUser {
          id
          displayName
          email
          is_superadmin
          superVolOrganizations: organizations(role: "SUPERVOLUNTEER") {
            id
            name
          }
          texterOrganizations: organizations(role: "TEXTER") {
            id
            name
          }
        }
      }
    `,
    options: {
      fetchPolicy: "network-only"
    }
  }
};

export default compose(
  loadData({ queries }),
  withRouter,
  withMuiTheme
)(UserMenuBase);
