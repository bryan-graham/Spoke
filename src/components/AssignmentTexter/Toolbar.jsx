import PropTypes from "prop-types";
import React from "react";
import { StyleSheet, css } from "aphrodite";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import { IconArrowLeft, IconLayoutSidebarRight } from "@tabler/icons-react";
import { v, fonts, layout } from "../../styles/shore-tokens";

// The texting screen's top bar, in Shore's style: the canvas colour, like
// Shore's sidebar and phone top bar, with a back link, the campaign's title,
// and (on phones) a button for the campaign's side panels.

export const headerStyles = StyleSheet.create({
  bar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minHeight: 56,
    padding: "0 12px",
    backgroundColor: v("canvas"),
    borderBottom: `1px solid ${v("panelBorder")}`,
    color: v("text"),
    boxSizing: "border-box"
  },
  iconButton: {
    width: 36,
    height: 36,
    flex: "0 0 36px",
    padding: 0,
    borderRadius: layout.controlRadius,
    color: v("dimmed"),
    ":hover": {
      backgroundColor: v("navHover"),
      color: v("text")
    }
  },
  bordered: {
    border: `1px solid ${v("border")}`,
    backgroundColor: v("surface")
  },
  titleArea: {
    flex: "1 1 auto",
    minWidth: 0
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: "16px",
    color: v("dimmed"),
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  title: {
    fontFamily: fonts.heading,
    fontWeight: 700,
    fontSize: 16,
    lineHeight: "22px",
    letterSpacing: "-0.01em",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  sideboxButton: {
    // the side panels show beside the conversation from 575px
    // (StyleControls sectionSideBox, Controls getSideboxDialogOpen)
    "@media(min-width: 575px)": {
      display: "none"
    }
  }
});

export const iconProps = { size: 20, stroke: layout.iconStroke };

const CampaignToolbar = props => (
  <div className={css(headerStyles.bar)}>
    <Tooltip title="Back to my assignments">
      <IconButton
        onClick={props.onExit}
        className={css(headerStyles.iconButton)}
        aria-label="Back to my assignments"
      >
        <IconArrowLeft {...iconProps} />
      </IconButton>
    </Tooltip>
    <div className={css(headerStyles.titleArea)}>
      <div className={css(headerStyles.eyebrow)}>
        Campaign {props.campaign.id}
      </div>
      <div className={css(headerStyles.title)} title={props.campaign.title}>
        {props.campaign.title}
      </div>
    </div>
    {props.onSideboxButtonClick && (
      <div className={css(headerStyles.sideboxButton)}>
        <Tooltip title="Open details">
          <IconButton
            onClick={props.onSideboxButtonClick}
            className={css(headerStyles.iconButton)}
            aria-label="Open details"
          >
            <IconLayoutSidebarRight {...iconProps} />
          </IconButton>
        </Tooltip>
      </div>
    )}
  </div>
);

CampaignToolbar.propTypes = {
  campaign: PropTypes.object,
  onSideboxButtonClick: PropTypes.func,
  onExit: PropTypes.func
};

export default CampaignToolbar;
