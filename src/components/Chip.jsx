import PropTypes from "prop-types";
import React from "react";
import _ from "lodash";
import { v } from "../styles/shore-tokens";

// Credit to materialize CSS
// Material UI coming out with Chip
const styles = {
  chip: {
    display: "inline-block",
    height: "32px",
    fontSize: "13px",
    fontWeight: "500",
    color: v("dimmed"),
    lineHeight: "32px",
    padding: "0 12px",
    borderRadius: "16px",
    backgroundColor: v("subtle"),
    margin: 5
  },
  icon: {
    cursor: "pointer",
    float: "right",
    fontSize: "16px",
    lineHeight: "32px",
    height: "30px",
    width: "16px",
    paddingLeft: "8px",
    color: v("dimmed")
  }
};

function Chip({
  text,
  iconRightClass,
  onIconRightTouchTap,
  onClick,
  style = {}
}) {
  return (
    <div style={_.extend({}, styles.chip, style)} onClick={onClick}>
      {text}
      {iconRightClass
        ? React.createElement(iconRightClass, {
            style: styles.icon,
            onClick: onIconRightTouchTap
          })
        : ""}
    </div>
  );
}

Chip.propTypes = {
  text: PropTypes.string,
  iconRightClass: PropTypes.string,
  onIconRightTouchTap: PropTypes.func,
  onClick: PropTypes.func,
  style: PropTypes.object
};

export default Chip;
