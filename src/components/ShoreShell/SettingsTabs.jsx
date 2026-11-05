import React from "react";
import PropTypes from "prop-types";
import { Link } from "react-router";
import { makeStyles } from "@material-ui/core/styles";
import { camelCase } from "lodash";
import { v, layout, palette } from "../../styles/shore-tokens";
import { iconFor } from "./icons";
import { dataTest } from "../../lib/attributes";

// The tabs across the top of the Settings pages, as on Shore's own Settings:
// icon and label, an underline under the current tab, and a rule beneath the
// row. On narrow screens the row scrolls sideways instead of wrapping.

const useStyles = makeStyles({
  bar: {
    display: "flex",
    gap: 4,
    marginBottom: 24,
    borderBottom: `1px solid ${v("border")}`,
    overflowX: "auto",
    scrollbarWidth: "none",
    "&::-webkit-scrollbar": { display: "none" }
  },
  tab: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
    padding: "10px 16px 12px",
    marginBottom: -1,
    borderBottom: "2px solid transparent",
    color: v("navText"),
    fontSize: 15,
    fontWeight: 500,
    textDecoration: "none",
    whiteSpace: "nowrap",
    borderRadius: `${layout.controlRadius}px ${layout.controlRadius}px 0 0`,
    "&:hover": { backgroundColor: v("navHover") },
    "&:focus-visible": {
      outline: `2px solid ${palette.navy[5]}`,
      outlineOffset: -2
    }
  },
  active: {
    color: v("text"),
    fontWeight: 600,
    borderBottomColor: palette.navy[5]
  }
});

export default function SettingsTabs({ tabs }) {
  const classes = useStyles();
  if (!tabs || tabs.length < 2) {
    return null;
  }
  return (
    <nav className={classes.bar} aria-label="Settings">
      {tabs.map(tab => {
        const Icon = iconFor(tab.icon);
        return (
          <Link
            key={tab.key}
            to={tab.to}
            className={`${classes.tab} ${tab.active ? classes.active : ""}`}
            aria-current={tab.active ? "page" : undefined}
            {...dataTest(camelCase(`settings tab ${tab.key}`))}
          >
            <Icon size={18} stroke={layout.iconStroke} aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

SettingsTabs.propTypes = {
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      icon: PropTypes.string,
      to: PropTypes.string.isRequired,
      active: PropTypes.bool
    })
  )
};
