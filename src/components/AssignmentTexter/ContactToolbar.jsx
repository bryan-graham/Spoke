import PropTypes from "prop-types";
import React from "react";
import { StyleSheet, css } from "aphrodite";
import momenttz from "moment-timezone";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import {
  IconChevronLeft,
  IconChevronRight,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand
} from "@tabler/icons-react";
import PersonAvatar from "../PersonAvatar";
import { headerStyles, iconProps } from "./Toolbar";
import { v } from "../../styles/shore-tokens";
import { getLocalTime, getContactTimezone } from "../../lib/timezones";
import { getProcessEnvDstReferenceTimezone } from "../../lib/tz-helpers";

// The contact's header, in Shore's style: a button that shows and hides the
// contact list (when that's turned on), the person's avatar and first name,
// their local time and place, and previous/next.
const styles = StyleSheet.create({
  bar: {
    backgroundColor: v("panel"),
    minHeight: 64
  },
  name: {
    fontSize: 18,
    lineHeight: "24px"
  },
  navigation: {
    flex: "0 0 auto",
    display: "flex",
    alignItems: "center",
    gap: 6
  },
  position: {
    minWidth: "4.5em",
    textAlign: "center",
    fontSize: 13,
    fontWeight: 500,
    color: v("dimmed"),
    whiteSpace: "nowrap",
    fontVariantNumeric: "tabular-nums",
    "@media(max-width: 350px)": {
      minWidth: "auto"
    }
  }
});

const ContactToolbar = function ContactToolbar(props) {
  const { campaignContact, navigationToolbarChildren } = props;

  const { location } = campaignContact;

  let city = "";
  let state = "";
  let timezone = null;
  let offset;
  let hasDST;

  if (location) {
    city = location.city;
    state = location.state;
    timezone = location.timezone;
    if (timezone) {
      offset = timezone.offset || offset;
      hasDST = timezone.hasDST || hasDST;
    }
    const adjustedLocationTZ = getContactTimezone(props.campaign, location);
    if (adjustedLocationTZ && adjustedLocationTZ.timezone) {
      offset = adjustedLocationTZ.timezone.offset;
      hasDST = adjustedLocationTZ.timezone.hasDST;
    }
  }

  const formattedLocation = [city, state].filter(Boolean).join(", ");

  const campaignTimezone =
    props.campaign.timezone || getProcessEnvDstReferenceTimezone();
  let formattedLocalTime;
  if (offset === undefined) {
    const zone = momenttz.tz.zone(campaignTimezone);
    offset = zone.parse(Date.now()) / -60;
    hasDST = false;
  }

  formattedLocalTime = getLocalTime(offset, hasDST, campaignTimezone).format(
    "LT"
  ); // format('h:mm a')

  const details = [formattedLocalTime, formattedLocation]
    .filter(Boolean)
    .join(" · ");
  const navButton = css(headerStyles.iconButton, headerStyles.bordered);
  const ListIcon = props.contactListOpen
    ? IconLayoutSidebarLeftCollapse
    : IconLayoutSidebarLeftExpand;

  return (
    <div className={css(headerStyles.bar, styles.bar)}>
      {global.ASSIGNMENT_CONTACTS_SIDEBAR && props.toggleContactList ? (
        <Tooltip title="Show or hide the contact list">
          <IconButton
            className={css(headerStyles.iconButton)}
            onClick={props.toggleContactList}
            aria-label="Show or hide the contact list"
          >
            <ListIcon {...iconProps} />
          </IconButton>
        </Tooltip>
      ) : null}
      <PersonAvatar name={campaignContact.firstName} />
      <div className={css(headerStyles.titleArea)}>
        <div className={css(headerStyles.title, styles.name)}>
          {campaignContact.firstName}
        </div>
        <div className={css(headerStyles.eyebrow)}>{details}</div>
      </div>

      <div className={css(styles.navigation)}>
        <Tooltip title="Previous contact">
          {/*
           *  Tooltips can not wrap buttons that are disabled.
           *  A disabled element does not fire events.
           *  Tooltip needs to listen to the child element's events to display the title.
           */}
          <span>
            <IconButton
              onClick={navigationToolbarChildren.onPrevious}
              disabled={!navigationToolbarChildren.onPrevious}
              className={navButton}
              aria-label="Previous contact"
            >
              <IconChevronLeft {...iconProps} />
            </IconButton>
          </span>
        </Tooltip>
        <div className={css(styles.position)}>
          {navigationToolbarChildren.title}
        </div>
        <Tooltip title="Next contact">
          <span>
            <IconButton
              onClick={navigationToolbarChildren.onNext}
              disabled={!navigationToolbarChildren.onNext}
              className={navButton}
              aria-label="Next contact"
            >
              <IconChevronRight {...iconProps} />
            </IconButton>
          </span>
        </Tooltip>
      </div>
    </div>
  );
};

ContactToolbar.propTypes = {
  campaignContact: PropTypes.object, // contacts for current assignment
  campaign: PropTypes.object,
  navigationToolbarChildren: PropTypes.object,
  toggleContactList: PropTypes.func,
  contactListOpen: PropTypes.bool
};

export default ContactToolbar;
